import { supabase } from "@/integrations/supabase/client";
import { extractChannelPricingFromForm } from "./channelPricingMapper";

export const PRODUCT_AGGREGATE_SAVE_SCHEMA = "oasis.product-aggregate-save.v1" as const;

type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
};

export type AtomicProductSaveInput = {
  idempotencyKey: string;
  operation: "create" | "update";
  productId: string | null;
  expectedUpdatedAt: string | null;
  expectedAggregateRevision: number | null;
  product: Record<string, unknown>;
  sourceForm: Record<string, unknown>;
};

export type AtomicProductSaveResponse = {
  schema_version: typeof PRODUCT_AGGREGATE_SAVE_SCHEMA;
  status: "saved" | "replayed";
  operation: "create" | "update";
  product_id: string;
  product: Record<string, unknown>;
  pricing_rules_written: number;
  moq_rules_written: number;
  updated_at: string;
  aggregate_revision: number;
};

export type AtomicProductSaveFailureKind =
  | "auth"
  | "conflict"
  | "validation"
  | "not_found"
  | "server";

export type AtomicProductSaveResult =
  | { ok: true; value: AtomicProductSaveResponse }
  | { ok: false; kind: AtomicProductSaveFailureKind; message: string };

const PLACEHOLDER_PRODUCT_ID = "00000000-0000-0000-0000-000000000000";

function hasValue(value: unknown): boolean {
  return value !== "" && value !== null && value !== undefined;
}

/**
 * The RPC owns product_id and approval evidence. Only editable pricing fields cross
 * the browser/server boundary; spoofed actor or approval columns are never sent.
 */
export function buildAtomicPricingRules(
  form: Record<string, unknown>,
): Array<Record<string, unknown>> {
  return extractChannelPricingFromForm(form, PLACEHOLDER_PRODUCT_ID, "direct").map((row) => ({
    price_channel: row.price_channel,
    price_type: row.price_type,
    base_price: row.base_price,
    discount_percent: row.discount_percent,
    calculated_price: row.calculated_price,
    currency: row.currency,
    uom: row.uom,
    tax_inclusive: row.tax_inclusive,
    gst_rate: row.gst_rate,
    valid_from: row.valid_from,
    valid_until: row.valid_until,
    notes: row.notes,
    source: row.source,
  }));
}

/**
 * The primary Full Editor MOQ fields mirror one governed B2B rule. Rich per-channel
 * rules continue to be edited by ChannelMoqRules; this aggregate never deletes rows
 * that are absent from the form.
 */
export function buildAtomicMoqRules(
  form: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const hasRule = [
    "moq_value",
    "moq_uom",
    "increment_value",
    "increment_uom",
    "carton_qty",
    "carton_logic",
  ].some((key) => hasValue(form[key]));

  if (!hasRule) return [];

  return [
    {
      channel: "b2b",
      customer_type: null,
      moq_applicable: true,
      moq_value: hasValue(form.moq_value) ? Number(form.moq_value) : null,
      moq_uom: form.moq_uom || form.primary_pack_uom || form.primary_uom || null,
      increment_value: hasValue(form.increment_value) ? Number(form.increment_value) : null,
      increment_uom:
        form.increment_uom || form.primary_pack_uom || form.primary_uom || null,
      min_carton_qty: hasValue(form.carton_qty) ? Number(form.carton_qty) : null,
      carton_logic: form.carton_logic || null,
      allow_override: false,
      override_requires_approval: true,
      notes: "Full Editor primary MOQ",
    },
  ];
}

function readError(error: unknown): { code: string; message: string } {
  if (!error || typeof error !== "object") return { code: "", message: "" };
  const value = error as { code?: unknown; message?: unknown; details?: unknown };
  return {
    code: typeof value.code === "string" ? value.code : "",
    message: [value.message, value.details].filter((part) => typeof part === "string").join(" "),
  };
}

/** Maps database diagnostics to operator-safe, actionable messages. */
export function mapAtomicProductSaveError(error: unknown): {
  kind: AtomicProductSaveFailureKind;
  message: string;
} {
  const diagnostic = readError(error);
  const text = diagnostic.message;

  if (
    diagnostic.code === "42501" ||
    /OASIS_(AUTH_REQUIRED|PRODUCT_WRITE_FORBIDDEN)/.test(text)
  ) {
    return {
      kind: "auth",
      message: "Your session or product-write permission is no longer valid. Your draft is preserved; sign in again or ask an administrator to verify your role.",
    };
  }
  if (
    diagnostic.code === "40001" ||
    /OASIS_(PRODUCT_VERSION_CONFLICT|PRODUCT_AGGREGATE_REVISION_CONFLICT|IDEMPOTENCY_CONFLICT)/.test(text)
  ) {
    return {
      kind: "conflict",
      message: "This product or save attempt changed elsewhere. Your draft is preserved; reload the latest authority before saving again.",
    };
  }
  if (diagnostic.code === "P0002" || /OASIS_PRODUCT_NOT_FOUND/.test(text)) {
    return {
      kind: "not_found",
      message: "This product no longer exists. Your draft is preserved; return to Products and verify its status.",
    };
  }
  if (diagnostic.code === "23505") {
    return {
      kind: "validation",
      message: "This SKU or channel rule already exists. No aggregate changes were committed, and your draft is preserved.",
    };
  }
  if (
    diagnostic.code === "22023" ||
    /OASIS_(INVALID|UNKNOWN|REQUIRED|TOO_LARGE|MUST_BE)/.test(text)
  ) {
    return {
      kind: "validation",
      message: "The server rejected one or more product, pricing, or MOQ values. Your draft is preserved; review the highlighted data and try again.",
    };
  }
  return {
    kind: "server",
    message: "The atomic product save did not complete. No product, pricing, or MOQ changes were committed, and your draft is preserved.",
  };
}

function isAtomicResponse(value: unknown): value is AtomicProductSaveResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Partial<AtomicProductSaveResponse>;
  return (
    row.schema_version === PRODUCT_AGGREGATE_SAVE_SCHEMA &&
    (row.status === "saved" || row.status === "replayed") &&
    (row.operation === "create" || row.operation === "update") &&
    typeof row.product_id === "string" &&
    !!row.product &&
    typeof row.product === "object" &&
    !Array.isArray(row.product) &&
    typeof row.updated_at === "string" &&
    typeof row.aggregate_revision === "number" &&
    typeof row.pricing_rules_written === "number" &&
    typeof row.moq_rules_written === "number"
  );
}

export async function saveProductAggregateAtomic(
  input: AtomicProductSaveInput,
  client: RpcClient = supabase as unknown as RpcClient,
): Promise<AtomicProductSaveResult> {
  const { data, error } = await client.rpc("save_product_aggregate_v1", {
    _idempotency_key: input.idempotencyKey,
    _operation: input.operation,
    _product_id: input.productId,
    _expected_updated_at: input.expectedUpdatedAt,
    _expected_aggregate_revision: input.expectedAggregateRevision,
    _product: input.product,
    _pricing_rules: buildAtomicPricingRules(input.sourceForm),
    _moq_rules: buildAtomicMoqRules(input.sourceForm),
  });

  if (error) return { ok: false, ...mapAtomicProductSaveError(error) };
  if (!isAtomicResponse(data)) {
    return {
      ok: false,
      kind: "server",
      message: "The server returned an invalid product-save receipt. Your draft is preserved and the editor will not claim success.",
    };
  }
  return { ok: true, value: data };
}
