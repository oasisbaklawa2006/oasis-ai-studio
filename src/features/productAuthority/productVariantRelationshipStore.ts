/**
 * Point 32 follow-up (#229) — live `product_variants` CRUD against canonical Core #310 authority.
 *
 * This module performs the actual reads/writes; Core's RLS (`public.is_admin()`) and triggers
 * (`enforce_product_variant_identity_v1`, `enforce_product_point32_identity_immutable_v1`) remain
 * the sole write authority — nothing here bypasses them, and no shadow schema or service-role
 * path is introduced.
 *
 * Honest limitation: Core PR #310 ships table-level RLS/triggers, not a single atomic RPC for
 * "link product to basis product". Establishing a relationship therefore takes two writes
 * (`products.basis_product_id`, then a `product_variants` insert) that are not transactional from
 * the client. Each function here compensates on partial failure and reports the resulting state
 * plainly rather than pretending the operation is atomic — see `createProductVariantRelationship`
 * and `changeProductVariantBasis`.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ProductVariantRow = Database["public"]["Tables"]["product_variants"]["Row"];

export type BasisProductCandidate = {
  id: string;
  sku: string;
  product_name: string;
};

export type VariantMutationErrorCode =
  | "validation"
  | "not_found"
  | "rls_denied"
  | "identity_locked"
  | "conflict"
  | "stale_state"
  | "network"
  | "unknown";

export type VariantMutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: VariantMutationErrorCode; message: string };

const GENERIC_NETWORK_MESSAGE = "Could not reach the server. Check your connection and try again.";

function fail<T = never>(
  code: VariantMutationErrorCode,
  message: string,
): VariantMutationResult<T> {
  return { ok: false, code, message };
}

/** Translate raw PostgREST/Postgres errors (including Core's POINT32_* trigger messages) into UI-safe results. */
function classifyPostgrestError<T = never>(error: {
  message: string;
  code?: string;
}): VariantMutationResult<T> {
  const message = error.message ?? "Unknown error";

  if (message.includes("POINT32_PRODUCT_IDENTITY_LOCKED")) {
    return fail(
      "identity_locked",
      "This product's SKU or basis product can no longer change — it already has a variant relationship attached. Remove the relationship first.",
    );
  }
  if (message.includes("POINT32_BASIS_PRODUCT_MISMATCH")) {
    return fail(
      "stale_state",
      "The basis product link changed on the server since this page loaded. Reload and try again.",
    );
  }
  if (
    message.includes("POINT32_BASIS_SKU_REQUIRED") ||
    message.includes("POINT32_VARIANT_SKU_REQUIRED")
  ) {
    return fail(
      "validation",
      "Both the variant product and its basis product need a SKU assigned before they can be linked.",
    );
  }
  if (error.code === "23505" || /duplicate key/i.test(message)) {
    return fail(
      "conflict",
      "That variant key is already used under this basis product, or this product already has a variant relationship.",
    );
  }
  if (error.code === "42501" || /row-level security/i.test(message)) {
    return fail(
      "rls_denied",
      "You don't have permission to change product/variant relationships — this requires admin authority.",
    );
  }
  if (error.code === "23503" || /foreign key/i.test(message)) {
    return fail(
      "not_found",
      "The selected basis product no longer exists. Reload and pick another.",
    );
  }
  return fail("unknown", message);
}

export async function loadProductVariantRelationship(
  productId: string,
): Promise<VariantMutationResult<ProductVariantRow | null>> {
  try {
    const { data, error } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .maybeSingle();
    if (error) return classifyPostgrestError(error);
    return { ok: true, data: data ?? null };
  } catch {
    return fail("network", GENERIC_NETWORK_MESSAGE);
  }
}

export async function loadBasisProductSummary(
  basisProductId: string,
): Promise<VariantMutationResult<BasisProductCandidate | null>> {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("id, sku, product_name")
      .eq("id", basisProductId)
      .maybeSingle();
    if (error) return classifyPostgrestError(error);
    return { ok: true, data: data ?? null };
  } catch {
    return fail("network", GENERIC_NETWORK_MESSAGE);
  }
}

export async function searchBasisProductCandidates(
  query: string,
  excludeProductId: string | null,
): Promise<VariantMutationResult<BasisProductCandidate[]>> {
  const q = query.trim();
  if (q.length < 2) return { ok: true, data: [] };
  const safeQ = q.replaceAll("%", "").replaceAll(",", " ");

  try {
    let builder = supabase
      .from("products")
      .select("id, sku, product_name")
      .or(`sku.ilike.%${safeQ}%,product_name.ilike.%${safeQ}%`)
      .order("product_name", { ascending: true })
      .limit(12);
    if (excludeProductId) builder = builder.neq("id", excludeProductId);
    const { data, error } = await builder;
    if (error) return classifyPostgrestError(error);
    return { ok: true, data: data ?? [] };
  } catch {
    return fail("network", GENERIC_NETWORK_MESSAGE);
  }
}

export type CreateVariantRelationshipInput = {
  productId: string;
  productSku: string;
  basisProductId: string;
  basisSku: string;
  variantKey: string;
};

/**
 * Establish a new variant relationship. Two writes, not transactional (see module docstring):
 * sets `products.basis_product_id` first, then inserts the `product_variants` row. On insert
 * failure the `products` write is rolled back best-effort. A duplicate-submit / lost-response
 * retry that lands on the row it already created is treated as success (idempotent-safe).
 */
export async function createProductVariantRelationship(
  input: CreateVariantRelationshipInput,
): Promise<VariantMutationResult<ProductVariantRow>> {
  const variantKey = input.variantKey.trim();
  if (!variantKey) return fail("validation", "Variant key is required.");
  if (!input.basisProductId) return fail("validation", "Select a basis product first.");
  if (input.basisProductId === input.productId) {
    return fail("validation", "A product cannot be its own basis product.");
  }

  try {
    const { error: productsError } = await supabase
      .from("products")
      .update({ basis_product_id: input.basisProductId })
      .eq("id", input.productId);
    if (productsError) return classifyPostgrestError(productsError);

    const { data, error: insertError } = await supabase
      .from("product_variants")
      .insert({
        product_id: input.productId,
        basis_product_id: input.basisProductId,
        variant_key: variantKey,
        basis_sku: input.basisSku,
        sku: input.productSku,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        // Duplicate submit / accepted-but-response-lost: check whether the row that now
        // exists already matches what we intended before treating this as a real conflict.
        const existing = await loadProductVariantRelationship(input.productId);
        if (
          existing.ok &&
          existing.data &&
          existing.data.basis_product_id === input.basisProductId &&
          existing.data.variant_key === variantKey
        ) {
          await supabase
            .from("products")
            .update({ basis_product_id: input.basisProductId })
            .eq("id", input.productId);
          return { ok: true, data: existing.data };
        }
      }
      // Compensate: don't leave products.basis_product_id pointing at a basis with no
      // product_variants row behind it.
      await supabase.from("products").update({ basis_product_id: null }).eq("id", input.productId);
      return classifyPostgrestError(insertError);
    }

    return { ok: true, data };
  } catch {
    return fail("network", GENERIC_NETWORK_MESSAGE);
  }
}

export type UpdateVariantKeyInput = {
  productId: string;
  variantKey: string;
  expectedUpdatedAt: string;
};

/** Update the governed variant key only. Optimistic-concurrency guarded via `updated_at`. */
export async function updateProductVariantKey(
  input: UpdateVariantKeyInput,
): Promise<VariantMutationResult<ProductVariantRow>> {
  const variantKey = input.variantKey.trim();
  if (!variantKey) return fail("validation", "Variant key is required.");

  try {
    const { data, error } = await supabase
      .from("product_variants")
      .update({ variant_key: variantKey })
      .eq("product_id", input.productId)
      .eq("updated_at", input.expectedUpdatedAt)
      .select()
      .maybeSingle();
    if (error) return classifyPostgrestError(error);

    if (!data) {
      // Zero rows matched: either RLS silently denied the update, or the row moved out from
      // under the expected updated_at (concurrent update / stale editor data).
      const current = await loadProductVariantRelationship(input.productId);
      if (current.ok && current.data && current.data.updated_at !== input.expectedUpdatedAt) {
        return fail(
          "stale_state",
          "This relationship changed elsewhere since it was loaded. Reload and try again.",
        );
      }
      return fail(
        "rls_denied",
        "You don't have permission to change product/variant relationships — this requires admin authority.",
      );
    }

    return { ok: true, data };
  } catch {
    return fail("network", GENERIC_NETWORK_MESSAGE);
  }
}

/**
 * Remove the relationship: deletes the `product_variants` row, then clears
 * `products.basis_product_id`. If the second write fails, the failure is surfaced explicitly
 * rather than reporting a clean removal — the two tables would otherwise disagree.
 */
export async function removeProductVariantRelationship(
  productId: string,
): Promise<VariantMutationResult<null>> {
  try {
    const { error: deleteError } = await supabase
      .from("product_variants")
      .delete()
      .eq("product_id", productId);
    if (deleteError) return classifyPostgrestError(deleteError);

    const { error: clearError } = await supabase
      .from("products")
      .update({ basis_product_id: null })
      .eq("id", productId);
    if (clearError) {
      return fail(
        "unknown",
        `Variant relationship removed, but clearing the basis product link failed: ${clearError.message}. Reload and retry.`,
      );
    }

    return { ok: true, data: null };
  } catch {
    return fail("network", GENERIC_NETWORK_MESSAGE);
  }
}

export type ChangeVariantBasisInput = {
  productId: string;
  productSku: string;
  newBasisProductId: string;
  basisSku: string;
  variantKey: string;
};

/**
 * Re-parent to a different basis product. Core has no atomic "move" primitive, so this removes
 * the existing relationship (required to clear the immutability lock) and then creates the new
 * one. If creation fails after removal succeeds, the product is left with no relationship at
 * all — the error message says so explicitly; nothing here pretends the old link survives.
 */
export async function changeProductVariantBasis(
  input: ChangeVariantBasisInput,
): Promise<VariantMutationResult<ProductVariantRow>> {
  const removed = await removeProductVariantRelationship(input.productId);
  if (!removed.ok) return removed;

  const created = await createProductVariantRelationship({
    productId: input.productId,
    productSku: input.productSku,
    basisProductId: input.newBasisProductId,
    basisSku: input.basisSku,
    variantKey: input.variantKey,
  });
  if (!created.ok) {
    return {
      ok: false,
      code: created.code,
      message: `Previous basis relationship was removed, but the new one could not be created: ${created.message}`,
    };
  }
  return created;
}
