import type { Category1AuthorityRow, ColumnMappingEntry } from "./types";

/** Authority file header aliases → canonical Category 1 field. */
export const CATEGORY1_COLUMN_ALIASES: Record<string, keyof Category1AuthorityRow> = {
  sku: "sku",
  product_sku: "sku",
  barcode_sku: "sku",
  legacy_sku: "sku",
  product_name: "product_name",
  name: "product_name",
  productname: "product_name",
  short_name: "short_name",
  original_name: "short_name",
  category: "category",
  subcategory: "subcategory",
  sub_category: "subcategory",
  product_class: "product_class",
  product_type: "product_type",
  producttype: "product_type",
  description: "description",
  short_description: "short_description",
  main_department: "main_department",
  department: "main_department",
  production_department: "production_department",
  primary_uom: "primary_uom",
  uom: "primary_uom",
  b2b_uom: "b2b_uom",
  retail_uom: "retail_uom",
  approximate_piece_weight_g: "approximate_piece_weight_g",
  piece_weight_g: "approximate_piece_weight_g",
  weight_per_pc_grams: "approximate_piece_weight_g",
  grams_per_piece: "approximate_piece_weight_g",
  pack_size: "pack_size",
  primary_pack_type: "primary_pack_type",
  carton_type: "primary_pack_type",
  primary_pack_uom: "primary_pack_uom",
  pack_uom: "primary_pack_uom",
  qty_per_pack: "qty_per_pack",
  pcs_per_pack: "qty_per_pack",
  qty_content_uom: "qty_content_uom",
  net_weight_g: "net_weight_g",
  net_weight_grams: "net_weight_g",
  gross_weight_g: "gross_weight_g",
  gross_weight_grams: "gross_weight_g",
  mrp: "mrp",
  b2b_price: "b2b_price",
  price_b2b: "b2b_price",
  export_price: "export_price",
  gst_rate: "gst_rate",
  gst_percentage: "gst_rate",
  hsn_code: "hsn_code",
  hsn: "hsn_code",
  currency: "currency",
  moq_value: "moq_value",
  moq: "moq_value",
  moq_uom: "moq_uom",
  increment_value: "increment_value",
  increment_uom: "increment_uom",
  shelf_life_days: "shelf_life_days",
  storage_instructions: "storage_instructions",
  ingredients: "ingredients",
  allergen_warnings: "allergen_warnings",
  allergen_information: "allergen_warnings",
  source_document: "source_document",
  source_page: "source_page",
  source_pdf_sku: "source_pdf_sku",
  import_confidence: "import_confidence",
  is_active: "is_active",
  is_catalogue_ready: "is_catalogue_ready",
  visible_in_catalog: "is_catalogue_ready",
};

const BOOL_TRUE = new Set(["true", "1", "yes", "y"]);

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseNumber(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null || value.trim() === "") return defaultValue;
  return BOOL_TRUE.has(value.trim().toLowerCase());
}

export function buildColumnMappings(
  raw: Record<string, string>,
): ColumnMappingEntry[] {
  return Object.entries(raw).map(([authorityColumn, sampleValue]) => {
    const key = normalizeHeader(authorityColumn);
    const targetField = CATEGORY1_COLUMN_ALIASES[key] ?? "ignored";
    return { authorityColumn, targetField, sampleValue: sampleValue ?? "" };
  });
}

export function mapRawRowToCategory1(
  raw: Record<string, string>,
  rowIndex: number,
  defaultSourceDocument: string,
): Category1AuthorityRow {
  const mapped: Partial<Record<keyof Category1AuthorityRow, string>> = {};

  for (const [header, value] of Object.entries(raw)) {
    const field = CATEGORY1_COLUMN_ALIASES[normalizeHeader(header)];
    if (!field || field === "rowIndex") continue;
    mapped[field] = value;
  }

  return {
    rowIndex,
    product_name: (mapped.product_name ?? "").trim(),
    sku: mapped.sku?.trim() || null,
    short_name: mapped.short_name?.trim() || null,
    category: mapped.category?.trim() || null,
    subcategory: mapped.subcategory?.trim() || null,
    product_class: mapped.product_class?.trim() || null,
    product_type: mapped.product_type?.trim() || null,
    description: mapped.description?.trim() || null,
    short_description: mapped.short_description?.trim() || null,
    main_department: mapped.main_department?.trim() || null,
    production_department: mapped.production_department?.trim() || null,
    primary_uom: mapped.primary_uom?.trim() || null,
    b2b_uom: mapped.b2b_uom?.trim() || null,
    retail_uom: mapped.retail_uom?.trim() || null,
    approximate_piece_weight_g: parseNumber(mapped.approximate_piece_weight_g),
    pack_size: mapped.pack_size?.trim() || null,
    primary_pack_type: mapped.primary_pack_type?.trim() || null,
    primary_pack_uom: mapped.primary_pack_uom?.trim() || null,
    qty_per_pack: parseNumber(mapped.qty_per_pack),
    qty_content_uom: mapped.qty_content_uom?.trim() || null,
    net_weight_g: parseNumber(mapped.net_weight_g),
    gross_weight_g: parseNumber(mapped.gross_weight_g),
    mrp: parseNumber(mapped.mrp),
    b2b_price: parseNumber(mapped.b2b_price),
    export_price: parseNumber(mapped.export_price),
    gst_rate: parseNumber(mapped.gst_rate),
    hsn_code: mapped.hsn_code?.trim() || null,
    currency: mapped.currency?.trim() || "INR",
    moq_value: parseNumber(mapped.moq_value),
    moq_uom: mapped.moq_uom?.trim() || null,
    increment_value: parseNumber(mapped.increment_value),
    increment_uom: mapped.increment_uom?.trim() || null,
    shelf_life_days: parseNumber(mapped.shelf_life_days),
    storage_instructions: mapped.storage_instructions?.trim() || null,
    ingredients: mapped.ingredients?.trim() || null,
    allergen_warnings: mapped.allergen_warnings?.trim() || null,
    source_document: mapped.source_document?.trim() || defaultSourceDocument,
    source_page: parseNumber(mapped.source_page ?? undefined),
    source_pdf_sku: mapped.source_pdf_sku?.trim() || null,
    import_confidence: mapped.import_confidence?.trim() || null,
    is_active: parseBool(mapped.is_active, true),
    is_catalogue_ready: parseBool(mapped.is_catalogue_ready, false),
  };
}

export const CATEGORY1_TARGET_FIELDS: (keyof Category1AuthorityRow)[] = [
  "product_name",
  "sku",
  "category",
  "subcategory",
  "main_department",
  "production_department",
  "primary_uom",
  "mrp",
  "b2b_price",
  "moq_value",
  "pack_size",
  "hsn_code",
  "gst_rate",
  "source_document",
  "source_page",
  "source_pdf_sku",
];
