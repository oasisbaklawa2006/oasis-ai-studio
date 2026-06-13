/**
 * Live shared Central `products` write contract.
 * Studio migrations may define columns absent from the shared DB — exclude those here.
 * See docs/AI_STUDIO_SCHEMA_WRITE_CONTRACT.md
 */

/** Studio-only columns confirmed absent on live shared products table. */
export const LIVE_PRODUCTS_EXCLUDED_COLUMNS: ReadonlySet<string> = new Set([
  "approximate_piece_weight_g",
  "pieces_per_kg",
]);

/**
 * Live Central columns supported for write but missing from Studio generated Insert types.
 * Owner-verified via packaging audits and live PGRST204 reports.
 */
export const CENTRAL_COMPAT_PRODUCT_COLUMNS = [
  "image_url",
  "grams_per_piece",
  "pcs_per_kg",
  "weight_per_pc_grams",
] as const;

export type CentralCompatProductColumn = (typeof CENTRAL_COMPAT_PRODUCT_COLUMNS)[number];

/** UI form keys that map to live DB columns (never sent under UI key names). */
export const UI_TO_LIVE_PRODUCT_FIELD_MAP = {
  approximate_piece_weight_g: "grams_per_piece",
  pieces_per_kg: "pcs_per_kg",
} as const;
