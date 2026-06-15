/**
 * Channel pricing authority — product_pricing_rules only (never products table).
 */
import type { Database } from "@/integrations/supabase/types";

export type ProductPricingRuleInsert =
  Database["public"]["Tables"]["product_pricing_rules"]["Insert"];

/** Form keys that carry channel price values (UI / legacy — not products columns). */
export const CHANNEL_PRICING_FORM_FIELD_KEYS = [
  "b2b_price",
  "b2b_price_inr",
  "mrp",
  "mrp_price",
  "retail_price",
  "bulk_price",
  "wholesale_price",
  "horeca_price",
  "export_price",
  "export_price_usd",
  "franchisee_price",
  "own_outlet_price",
  "special_price",
  "costing_price",
] as const;

/** Form keys for channel price basis metadata — never products columns. */
export const CHANNEL_PRICING_BASIS_FORM_FIELD_KEYS = [
  "price_basis",
  "b2b_price_basis",
  "mrp_price_basis",
  "retail_price_basis",
  "bulk_price_basis",
  "wholesale_price_basis",
  "horeca_price_basis",
  "export_price_basis",
  "franchisee_price_basis",
  "own_outlet_price_basis",
  "special_price_basis",
  "costing_price_basis",
] as const;

export type ChannelPricingFormField = (typeof CHANNEL_PRICING_FORM_FIELD_KEYS)[number];
export type ChannelPricingBasisFormField = (typeof CHANNEL_PRICING_BASIS_FORM_FIELD_KEYS)[number];

/** Map legacy/compliance form fields → product_pricing_rules.price_channel. */
export const FORM_FIELD_TO_PRICE_CHANNEL: Record<ChannelPricingFormField, string> = {
  mrp: "mrp",
  mrp_price: "mrp",
  retail_price: "retail",
  bulk_price: "bulk",
  wholesale_price: "wholesale",
  horeca_price: "horeca",
  b2b_price: "b2b",
  b2b_price_inr: "b2b",
  export_price: "export",
  export_price_usd: "export",
  franchisee_price: "franchisee",
  own_outlet_price: "own_outlet",
  special_price: "special",
  costing_price: "costing",
};

function toNum(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const RETAIL_LIKE_CHANNELS = new Set([
  "retail",
  "mrp",
  "own_outlet",
  "modern_trade",
  "promotional",
  "b2c",
]);

const B2B_LIKE_CHANNELS = new Set([
  "b2b",
  "bulk",
  "wholesale",
  "horeca",
  "distributor",
  "export",
  "private_label",
  "corporate_gifting",
  "special_customer",
  "franchisee",
]);

/** Derive per-channel UOM label from product UOM tab fields. */
export function resolveChannelUom(
  channel: string,
  product: Record<string, unknown>,
): string | null {
  const ch = String(channel ?? "").toLowerCase();
  if (RETAIL_LIKE_CHANNELS.has(ch)) {
    return (
      (product.retail_uom as string | null | undefined) ??
      (product.retail_price_basis as string | null | undefined) ??
      (product.primary_uom as string | null | undefined) ??
      null
    );
  }
  if (B2B_LIKE_CHANNELS.has(ch)) {
    return (
      (product.b2b_uom as string | null | undefined) ??
      (product.b2b_price_basis as string | null | undefined) ??
      (product.primary_uom as string | null | undefined) ??
      null
    );
  }
  return (product.primary_uom as string | null | undefined) ?? null;
}

/** True when a form/payload key is a channel price basis field. */
export function isPriceBasisFormField(key: string): boolean {
  if (key === "price_basis") return true;
  if (key.endsWith("_price_basis")) return true;
  return (CHANNEL_PRICING_BASIS_FORM_FIELD_KEYS as readonly string[]).includes(key);
}

/** True when a form/payload key is a channel price value. */
export function isChannelPricingFormField(key: string): boolean {
  if (isPriceBasisFormField(key)) return false;
  if ((CHANNEL_PRICING_FORM_FIELD_KEYS as readonly string[]).includes(key)) return true;
  if (key.endsWith("_price")) return true;
  return false;
}

/** Any pricing value or basis field that must never be written to products. */
export function isProductsPricingOrBasisField(key: string): boolean {
  return isChannelPricingFormField(key) || isPriceBasisFormField(key);
}

/**
 * Extract channel pricing rows for product_pricing_rules upsert.
 * Ignores empty / non-numeric values. Last write wins per channel.
 */
export function extractChannelPricingFromForm(
  form: Record<string, unknown>,
  productId: string,
  writeMode: "direct" | "draft" = "draft",
): ProductPricingRuleInsert[] {
  const currency = String(form.currency ?? "INR");
  const approval_status = writeMode === "direct" ? "approved" : "draft";
  const byChannel = new Map<string, ProductPricingRuleInsert>();

  for (const field of CHANNEL_PRICING_FORM_FIELD_KEYS) {
    const price = toNum(form[field]);
    if (price == null) continue;
    const channel = FORM_FIELD_TO_PRICE_CHANNEL[field];
    byChannel.set(channel, {
      product_id: productId,
      price_channel: channel,
      price_type: "fixed_price",
      base_price: price,
      calculated_price: price,
      currency,
      uom: resolveChannelUom(channel, form),
      approval_status,
      source: "catalogue_local",
    });
  }

  return Array.from(byChannel.values());
}
