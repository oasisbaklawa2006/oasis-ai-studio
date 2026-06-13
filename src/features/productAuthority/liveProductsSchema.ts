/**
 * Live shared Central `products` write contract.
 * Studio migrations may define columns absent from the shared DB.
 * See docs/AI_STUDIO_SCHEMA_WRITE_CONTRACT.md
 */
import {
  CHANNEL_PRICING_BASIS_FORM_FIELD_KEYS,
  CHANNEL_PRICING_FORM_FIELD_KEYS,
  isProductsPricingOrBasisField,
} from "@/features/productAuthority/channelPricingMapper";

/** Studio-only columns confirmed absent on live shared products table. */
export const LIVE_PRODUCTS_STUDIO_ONLY_COLUMNS: ReadonlySet<string> = new Set([
  "approximate_piece_weight_g",
  "pieces_per_kg",
]);

/** Studio pricing columns absent on live shared products — never write. */
export const LIVE_PRODUCTS_PRICING_EXCLUDED_COLUMNS: ReadonlySet<string> = new Set([
  "b2b_price",
  "b2b_price_inr",
  "mrp",
  "export_price",
  "export_price_usd",
]);

/** Combined exclusion set (studio-only + pricing columns on Studio types). */
export const LIVE_PRODUCTS_EXCLUDED_COLUMNS: ReadonlySet<string> = new Set([
  ...LIVE_PRODUCTS_STUDIO_ONLY_COLUMNS,
  ...LIVE_PRODUCTS_PRICING_EXCLUDED_COLUMNS,
]);

/** UI form keys that must never be sent on products insert/update (pricing authority). */
export const LIVE_PRODUCTS_PRICING_FORM_KEYS: ReadonlySet<string> = new Set(
  CHANNEL_PRICING_FORM_FIELD_KEYS,
);

export const LIVE_PRODUCTS_PRICING_BASIS_FORM_KEYS: ReadonlySet<string> = new Set(
  CHANNEL_PRICING_BASIS_FORM_FIELD_KEYS,
);

/**
 * Live Central columns supported for write but missing from Studio generated Insert types.
 */
export const CENTRAL_COMPAT_PRODUCT_COLUMNS = [
  "image_url",
  "grams_per_piece",
  "pcs_per_kg",
  "weight_per_pc_grams",
] as const;

export type CentralCompatProductColumn = (typeof CENTRAL_COMPAT_PRODUCT_COLUMNS)[number];

/**
 * Idempotent migration that must be applied on live Central (tcxvcatsqqertcnycuop)
 * before product-media uploads and products.bom_required writes succeed.
 */
export const LIVE_CENTRAL_MIGRATION_PRODUCT_MEDIA_AND_BOM =
  "20260613130000_live_central_product_media_bucket_and_bom_required";

export const LIVE_CENTRAL_SUPABASE_PROJECT_REF = "tcxvcatsqqertcnycuop";

/** UI form keys that map to live DB columns (never sent under UI key names). */
export const UI_TO_LIVE_PRODUCT_FIELD_MAP = {
  approximate_piece_weight_g: "grams_per_piece",
  pieces_per_kg: "pcs_per_kg",
} as const;

/** True when a column must never be written to live products. */
export function isLiveProductsBlockedColumn(key: string): boolean {
  if (LIVE_PRODUCTS_EXCLUDED_COLUMNS.has(key)) return true;
  if (LIVE_PRODUCTS_PRICING_FORM_KEYS.has(key)) return true;
  if (LIVE_PRODUCTS_PRICING_BASIS_FORM_KEYS.has(key)) return true;
  return isProductsPricingOrBasisField(key);
}
