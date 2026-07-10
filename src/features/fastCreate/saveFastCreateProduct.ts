import { supabase } from "@/integrations/supabase/client";
import { insertProductAliases, type ProductAliasInsertInput } from "@/lib/aliasSchemaAdapter";
import { stripUnapprovedComplianceFields } from "@/lib/compliance/aiComplianceSafety";
import {
  canWriteProductsDirectly,
  isCatalogueContributor,
} from "@/shared/auth/centralPermissions";
import { submitCatalogueDraft } from "@/features/catalogueDrafts/draftService";
import type { FastCreateCategoryKey } from "@/features/productDefaults/categoryDefaults";
import { productClassForSaleType, type SaleType } from "@/features/productAuthority/saleType";
import { generateFastCreateSku, type FastCreateSuggestions } from "./fastCreateSuggestions";
import { resolveFastCreateSkuCodes, type FastCreateSkuCodeSet } from "./fastCreateSkuCodes";
import type { AliasSeed } from "@/features/productLanguage/aliasSeedRules";
import {
  formToDbProductPayload,
  formatProductSaveError,
  productSaveValidationMessage,
  validateProductSavePayload,
} from "@/features/productAuthority/productSchemaAdapter";
import { assertStructuredSkuForSave } from "@/features/productAuthority/skuGuard";

export const FAST_CREATE_SKU_BLOCK_MESSAGE =
  "Structured SKU could not be generated. Ensure sku_code_rules are configured and generate_oasis_sku RPC is deployed. Placeholder SKUs (DRAFT-*, OAS-FC-*) are blocked.";

/** Packaging segment (5th of 6 dash-separated parts) of a structured OAS-DIV-CAT-SUBCAT-PKG-SEQ SKU. */
function skuPackagingSegment(sku: string): string | null {
  const parts = sku.trim().toUpperCase().split("-");
  return parts.length === 6 && parts[0] === "OAS" ? parts[4] : null;
}

/** Resolve structured Oasis SKU for Fast Create — throws if RPC/rules unavailable. */
export async function requireFastCreateSku(
  categoryKey: FastCreateCategoryKey = "other",
  existing?: string | null,
  packagingCode?: string | null,
): Promise<{ sku: string; codes: FastCreateSkuCodeSet }> {
  const trimmed = existing?.trim();
  if (trimmed) {
    const existingCheck = assertStructuredSkuForSave(trimmed);
    if (existingCheck.ok) {
      const skuPackaging = skuPackagingSegment(existingCheck.sku);
      // Only reuse the existing SKU as-is when its own packaging segment still agrees with
      // the operator's current selection — otherwise it's stale (packaging changed after this
      // SKU was generated) and must be regenerated, not reused with mismatched preset codes.
      if (!packagingCode || skuPackaging === packagingCode) {
        return {
          sku: existingCheck.sku,
          codes: {
            ...resolveFastCreateSkuCodes(categoryKey),
            ...(skuPackaging ? { packaging_code: skuPackaging } : {}),
          },
        };
      }
    }
  }

  const generated = await generateFastCreateSku(
    categoryKey,
    packagingCode ? { packaging_code: packagingCode } : undefined,
  );
  if (!generated) {
    throw new Error(FAST_CREATE_SKU_BLOCK_MESSAGE);
  }

  const check = assertStructuredSkuForSave(generated.sku);
  // Explicit `=== false` (not `!check.ok`) — with strictNullChecks off in this project's
  // tsconfig, boolean-negation doesn't narrow discriminated unions reliably.
  if (check.ok === false) {
    throw new Error(check.reason || FAST_CREATE_SKU_BLOCK_MESSAGE);
  }
  return generated;
}

export const FAST_CREATE_UNSUPPORTED_CLASS_MESSAGE_PREFIX = "has no supported catalogue classification yet";

export type FastCreateSaveInput = {
  suggestions: FastCreateSuggestions;
  heroUrl: string | null;
  roles: string[];
  categoryKey: FastCreateCategoryKey;
  /** Pre-resolved SKU shown in UI before save (optional). */
  resolvedSku?: string | null;
  /** Extra form fields from the Fast Create draft (sale-type patch, pack data, packaging). */
  extraFormPatch?: Record<string, unknown>;
  /** Sale type selected in Fast Create — used to guard product_class defaulting. */
  saleType?: SaleType;
};

export async function saveFastCreateProduct(
  input: FastCreateSaveInput,
): Promise<{ id: string; sku: string } | { draft: true }> {
  const form: Record<string, unknown> = {
    ...input.suggestions.formPatch,
    ...(input.extraFormPatch ?? {}),
    hero_image_url: input.heroUrl,
    is_active: true,
    is_catalogue_ready: false,
  };

  if (!form.product_name || !form.category) {
    throw new Error("Product name and category are required.");
  }

  const direct = await canWriteProductsDirectly(input.roles);
  const contributor = input.roles.includes("catalogue_contributor") || (await isCatalogueContributor());

  if (direct) {
    // Sale types without a persisted product_class (internal_bom, export,
    // packaging_material — see saleType.ts) must never silently become a sellable
    // "bulk_loose_product": that would make an internal/not-for-sale item look and gate
    // like customer-facing B2B stock. This check is unconditional — not just when
    // form.product_class happens to be empty — because buildHeuristicSuggestions'
    // category defaults always set a product_class regardless of the chosen sale type,
    // so an emptiness check alone never fires for the exact case it exists to catch.
    if (input.saleType && !productClassForSaleType(input.saleType)) {
      throw new Error(
        `Sale type "${input.saleType}" ${FAST_CREATE_UNSUPPORTED_CLASS_MESSAGE_PREFIX}. ` +
          "Submit for admin review as a catalogue draft instead of direct creation, or choose a sale type with a supported product class.",
      );
    }
    if (!form.product_class) form.product_class = "bulk_loose_product";
    if (!form.main_department) form.main_department = "ready_goods_store";

    const skuResult = await requireFastCreateSku(
      input.categoryKey,
      input.resolvedSku ?? (form.sku as string | null),
      (input.extraFormPatch?.packaging_code as string | null) ?? null,
    );
    form.sku = skuResult.sku;
    form.division_code = skuResult.codes.division_code;
    form.category_code = skuResult.codes.category_code;
    form.subcategory_code = skuResult.codes.subcategory_code;
    form.packaging_code = skuResult.codes.packaging_code;
    form.sku_locked = true;
    form.sku_generated_at = new Date().toISOString();

    const safePayload = stripUnapprovedComplianceFields(form, input.roles, {}, {});
    const productRow = formToDbProductPayload(safePayload);

    const validation = validateProductSavePayload(productRow, "create");
    if (!validation.ok) {
      throw new Error(productSaveValidationMessage(validation));
    }

    const skuGuard = assertStructuredSkuForSave(productRow.sku as string);
    if (skuGuard.ok === false) {
      throw new Error(skuGuard.reason);
    }

    const res = await (supabase as any).from("products").insert(productRow).select("id, sku").single();
    if (res.error) {
      throw new Error(formatProductSaveError(res.error));
    }

    await persistFastCreateAliases(
      res.data.id,
      input.suggestions.aliases,
      input.suggestions.whatsappKeywords,
      input.suggestions.searchKeywords,
    );

    return { id: res.data.id, sku: String(res.data.sku ?? form.sku) };
  }

  if (contributor) {
    const groupedPayload = {
      identity: {
        product_name: form.product_name,
        product_class: form.product_class,
        product_type: form.product_type,
        category: form.category,
        subcategory: form.subcategory,
        description: form.description,
        short_description: form.short_description,
        main_department: form.main_department,
        production_department: form.production_department,
      },
      compliance: {
        hsn_code: form.hsn_code,
        gst_rate: form.gst_rate,
        shelf_life_days: form.shelf_life_days,
        ingredients: form.ingredients,
        allergen_warnings: form.allergen_warnings,
        storage_instructions: form.storage_instructions,
      },
      media: {
        hero_image_url: input.heroUrl,
      },
      search: {
        suggested_aliases: input.suggestions.aliases.map((a) => a.alias),
        whatsapp_keywords: input.suggestions.whatsappKeywords,
        search_keywords: input.suggestions.searchKeywords,
      },
      sku_draft: {
        note: "SKU must be finalized via generate_oasis_sku during admin approval — DRAFT-* blocked.",
      },
    };

    const draftRes = await submitCatalogueDraft({
      draftType: "product",
      operation: "create",
      payload: groupedPayload,
      targetRecordId: null,
    });
    if (!draftRes.ok) throw new Error(draftRes.message);
    return { draft: true };
  }

  throw new Error("You do not have permission to create products. Contact an administrator.");
}

async function persistFastCreateAliases(
  productId: string,
  aliases: AliasSeed[],
  whatsappKeywords: string[],
  searchKeywords: string[],
) {
  const seen = new Set<string>();
  const rows: ProductAliasInsertInput[] = [];

  const push = (alias: string, alias_type: string, language?: string | null, script?: string | null) => {
    const key = alias.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    rows.push({
      product_id: productId,
      alias: alias.trim(),
      alias_type,
      language: language ?? null,
      script: script ?? null,
      is_active: true,
      source: "fast_create",
      confidence_score: 0.85,
    });
  };

  for (const a of aliases.slice(0, 6)) {
    push(a.alias, a.alias_type ?? "official_alias", a.language, a.script);
  }
  for (const k of whatsappKeywords.slice(0, 4)) {
    push(k, "whatsapp_keyword");
  }
  for (const k of searchKeywords.slice(0, 4)) {
    push(k, "search_keyword");
  }

  if (!rows.length) return;

  const { error } = await insertProductAliases(supabase, rows);
  if (error) {
    console.warn("[FastCreate] alias insert failed:", error.message);
  }
}
