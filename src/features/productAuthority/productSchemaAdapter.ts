/**
 * Canonical products-table column allowlist (Studio schema + documented Central compat).
 * Source: src/integrations/supabase/types.ts products Insert + shared DB image_url.
 */
import type { Database } from "@/integrations/supabase/types";

export type ProductsInsert = Database["public"]["Tables"]["products"]["Insert"];
export type ProductsRow = Database["public"]["Tables"]["products"]["Row"];

/** Columns safe to send on insert/update per generated Studio types. */
export const PRODUCTS_INSERT_ALLOWLIST: ReadonlySet<string> = new Set(
  Object.keys({
    approximate_piece_weight_g: true,
    avg_qty_per_tray_g: true,
    b2b_price: true,
    b2b_price_basis: true,
    b2b_price_inr: true,
    b2b_uom: true,
    bom_required: true,
    carton_dimensions_cm: true,
    carton_logic: true,
    carton_qty: true,
    carton_uom: true,
    category: true,
    category_code: true,
    cbm: true,
    color_finish_notes: true,
    created_at: true,
    currency: true,
    customization_allowed: true,
    customization_caution: true,
    customization_note: true,
    description: true,
    dimension_h_cm: true,
    dimension_l_cm: true,
    dimension_w_cm: true,
    division_code: true,
    export_price: true,
    export_price_usd: true,
    external_reference_code: true,
    fixed_carton_required: true,
    frozen_shelf_life_days: true,
    grammage_g: true,
    gross_weight_g: true,
    gross_weight_kg: true,
    gst_rate: true,
    hero_image_url: true,
    hsn_code: true,
    id: true,
    import_confidence: true,
    increment_uom: true,
    increment_value: true,
    is_active: true,
    is_catalogue_ready: true,
    is_sample: true,
    label_status: true,
    legacy_sku: true,
    main_department: true,
    master_carton_qty: true,
    master_carton_uom: true,
    material_type: true,
    media_status: true,
    moq_rule_type: true,
    moq_text: true,
    moq_uom: true,
    moq_value: true,
    mrp: true,
    net_weight_g: true,
    operational_notes: true,
    pack_size: true,
    packaging_code: true,
    pcs_per_carton: true,
    pcs_per_pack: true,
    pdf_primary_packaging: true,
    pdf_secondary_packaging: true,
    pdf_shelf_life: true,
    pdf_status: true,
    pdf_storage_condition: true,
    pieces_per_kg: true,
    post_processing_shelf_life_days: true,
    price_basis: true,
    pricing_notes: true,
    primary_uom: true,
    private_label_allowed: true,
    private_label_cost_per_unit: true,
    private_label_moq: true,
    private_label_moq_uom: true,
    private_label_upfront_cost: true,
    product_class: true,
    product_dimensions_cm: true,
    product_name: true,
    product_type: true,
    production_department: true,
    qty_per_carton_kg: true,
    retail_price_basis: true,
    retail_uom: true,
    serial_no: true,
    shelf_life_days: true,
    short_description: true,
    short_name: true,
    sku: true,
    sku_generated_at: true,
    sku_locked: true,
    sku_version: true,
    source_collection: true,
    source_document: true,
    source_notes: true,
    source_page: true,
    source_pdf_sku: true,
    storage_instructions: true,
    subcategory: true,
    subcategory_code: true,
    temperature_requirement: true,
    thawing_instruction: true,
    unit_conversion_note: true,
    updated_at: true,
  } satisfies Record<keyof ProductsInsert, true>),
);

/**
 * Optional on shared Oasis Supabase (Central writes `image_url`).
 * Not in Studio migration — owner must confirm column exists before relying on dual-write.
 */
export const CENTRAL_COMPAT_PRODUCT_COLUMNS = ["image_url"] as const;

export const PRODUCTS_WRITE_ALLOWLIST: ReadonlySet<string> = new Set([
  ...PRODUCTS_INSERT_ALLOWLIST,
  ...CENTRAL_COMPAT_PRODUCT_COLUMNS,
]);

export type ProductSaveValidation = {
  ok: boolean;
  missing: string[];
  stripped: string[];
};

const NUMERIC_DB_FIELDS = new Set([
  "approximate_piece_weight_g",
  "avg_qty_per_tray_g",
  "b2b_price",
  "b2b_price_inr",
  "carton_qty",
  "cbm",
  "dimension_h_cm",
  "dimension_l_cm",
  "dimension_w_cm",
  "export_price",
  "export_price_usd",
  "grammage_g",
  "gross_weight_g",
  "gross_weight_kg",
  "gst_rate",
  "increment_value",
  "master_carton_qty",
  "moq_value",
  "mrp",
  "net_weight_g",
  "pcs_per_carton",
  "pcs_per_pack",
  "pieces_per_kg",
  "private_label_cost_per_unit",
  "private_label_moq",
  "private_label_upfront_cost",
  "qty_per_carton_kg",
  "serial_no",
  "shelf_life_days",
  "frozen_shelf_life_days",
  "post_processing_shelf_life_days",
  "source_page",
  "sku_version",
]);

const BOOLEAN_DB_FIELDS = new Set([
  "bom_required",
  "customization_allowed",
  "fixed_carton_required",
  "is_active",
  "is_catalogue_ready",
  "is_sample",
  "private_label_allowed",
  "sku_locked",
]);

function toBlank(v: unknown): string {
  return v == null ? "" : String(v);
}

function toNum(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toBool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1 || v === "1") return true;
  if (v === "false" || v === 0 || v === "0") return false;
  return fallback;
}

function buildDimensionsText(form: Record<string, unknown>): string | null {
  if (form.product_dimensions_cm) return String(form.product_dimensions_cm);
  if (form.dimensions) return String(form.dimensions);
  const l = form.dimension_l_cm;
  const w = form.dimension_w_cm;
  const h = form.dimension_h_cm;
  if (l || w || h) {
    return [l ? `L ${l} cm` : null, w ? `W ${w} cm` : null, h ? `H ${h} cm` : null]
      .filter(Boolean)
      .join(" × ");
  }
  return null;
}

/** Strip keys not in products write allowlist (prevents Central-legacy field rejects). */
export function stripUnknownProductFields(
  payload: Record<string, unknown>,
): { payload: Record<string, unknown>; stripped: string[] } {
  const stripped: string[] = [];
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (PRODUCTS_WRITE_ALLOWLIST.has(key)) {
      out[key] = value;
    } else {
      stripped.push(key);
    }
  }
  return { payload: out, stripped };
}

export function validateProductSavePayload(
  payload: Record<string, unknown>,
  mode: "create" | "update" = "create",
): ProductSaveValidation {
  const missing: string[] = [];
  if (!payload.product_name || !String(payload.product_name).trim()) {
    missing.push("product_name");
  }
  if (mode === "create") {
    if (!payload.sku || !String(payload.sku).trim()) missing.push("sku");
  }
  if (
    payload.main_department === "ready_goods_store" &&
    !payload.production_department
  ) {
    missing.push("production_department");
  }
  return { ok: missing.length === 0, missing, stripped: [] };
}

export function formatProductSaveError(error: unknown): string {
  if (!error || typeof error !== "object") return "Product save failed.";
  const e = error as { message?: string; code?: string; details?: string; hint?: string };
  const parts = [e.message, e.details, e.hint, e.code].filter(Boolean);
  const msg = parts.join(" — ") || "Product save failed.";
  if (/Could not find the '([^']+)' column/i.test(msg)) {
    return `${msg} (schema mismatch — field not on products table; check AI_STUDIO_SCHEMA_WRITE_CONTRACT.md)`;
  }
  if (/violates foreign key|violates check|duplicate key/i.test(msg)) {
    return `${msg} (constraint — verify SKU uniqueness and department rules)`;
  }
  return msg;
}

/**
 * UI form → products row (Studio canonical columns only).
 * Compliance text fields (ingredients, allergens) are UI-only until label/nutrition tables own them.
 */
export function formToDbProductPayload(form: Record<string, unknown>): Record<string, unknown> {
  const hero = (form.hero_image_url as string) ?? null;
  const dims = buildDimensionsText(form);

  const raw: Record<string, unknown> = {
    product_name: form.product_name ?? null,
    short_name: form.short_name ?? null,
    category: form.category ?? null,
    subcategory: form.subcategory ?? null,
    product_type: form.product_type ?? form.product_family ?? null,
    product_class: form.product_class ?? null,
    description: form.description ?? form.short_description ?? null,
    short_description: form.short_description ?? null,
    pack_size: form.pack_size ?? null,
    net_weight_g: toNum(form.net_weight_g),
    gross_weight_g: toNum(form.gross_weight_g),
    shelf_life_days: toNum(form.shelf_life_days),
    storage_instructions: form.storage_instructions ?? null,
    hsn_code: form.hsn_code ?? null,
    gst_rate: toNum(form.gst_rate),
    mrp: toNum(form.mrp),
    b2b_price: toNum(form.b2b_price),
    export_price: toNum(form.export_price),
    export_price_usd: toNum(form.export_price_usd),
    currency: form.currency ?? "INR",
    hero_image_url: hero,
    image_url: hero,
    is_active: toBool(form.is_active, true),
    is_catalogue_ready: toBool(form.is_catalogue_ready, false),
    sku: form.sku ?? null,
    sku_locked: toBool(form.sku_locked, true),
    legacy_sku: form.legacy_sku ?? null,
    division_code: form.division_code ?? null,
    category_code: form.category_code ?? null,
    subcategory_code: form.subcategory_code ?? null,
    packaging_code: form.packaging_code ?? null,
    serial_no: toNum(form.serial_no),
    main_department: form.main_department ?? null,
    production_department:
      form.main_department === "ready_goods_store" ? form.production_department ?? null : null,
    primary_uom: form.primary_uom || form.b2b_uom || form.retail_uom || null,
    b2b_uom: form.b2b_uom ?? form.primary_uom ?? null,
    retail_uom: form.retail_uom ?? form.primary_uom ?? null,
    price_basis: form.price_basis ?? null,
    b2b_price_basis: form.b2b_price_basis ?? null,
    retail_price_basis: form.retail_price_basis ?? null,
    unit_conversion_note: form.unit_conversion_note ?? null,
    moq_rule_type: form.moq_rule_type ?? null,
    moq_value: toNum(form.moq_value),
    moq_uom: form.moq_uom ?? null,
    moq_text: form.moq_text ?? null,
    increment_value: toNum(form.increment_value),
    increment_uom: form.increment_uom ?? null,
    fixed_carton_required: toBool(form.fixed_carton_required, false),
    carton_qty: toNum(form.carton_qty),
    carton_uom: form.carton_uom ?? null,
    master_carton_qty: toNum(form.master_carton_qty),
    master_carton_uom: form.master_carton_uom ?? null,
    dimension_l_cm: toNum(form.dimension_l_cm),
    dimension_w_cm: toNum(form.dimension_w_cm),
    dimension_h_cm: toNum(form.dimension_h_cm),
    product_dimensions_cm: dims,
    approximate_piece_weight_g: toNum(form.approximate_piece_weight_g),
    pieces_per_kg: toNum(form.pieces_per_kg),
    pcs_per_pack: toNum(form.pcs_per_pack),
    pcs_per_carton: toNum(form.pcs_per_carton),
    private_label_allowed: toBool(form.private_label_allowed, false),
    private_label_moq: toNum(form.private_label_moq),
    private_label_moq_uom: form.private_label_moq_uom ?? null,
    private_label_cost_per_unit: toNum(form.private_label_cost_per_unit),
    private_label_upfront_cost: toNum(form.private_label_upfront_cost),
    customization_allowed: toBool(form.customization_allowed, false),
    customization_note: form.customization_note ?? null,
    customization_caution: form.customization_caution ?? null,
    bom_required: toBool(form.bom_required, false),
    pricing_notes: form.pricing_notes ?? null,
    operational_notes: form.operational_notes ?? null,
    frozen_shelf_life_days: toNum(form.frozen_shelf_life_days),
    post_processing_shelf_life_days: toNum(form.post_processing_shelf_life_days),
    temperature_requirement: form.temperature_requirement ?? null,
    thawing_instruction: form.thawing_instruction ?? null,
    material_type: form.material_type ?? form.material ?? null,
    color_finish_notes: form.color_finish_notes ?? null,
    label_status: form.label_status ?? null,
    media_status: form.media_status ?? null,
    carton_logic: form.carton_logic ?? null,
    external_reference_code: form.external_reference_code ?? null,
  };

  for (const key of NUMERIC_DB_FIELDS) {
    if (key in raw && raw[key] !== null && raw[key] !== undefined) {
      raw[key] = toNum(raw[key]);
    }
  }
  for (const key of BOOLEAN_DB_FIELDS) {
    if (key in raw) raw[key] = toBool(raw[key]);
  }

  Object.keys(raw).forEach((k) => {
    if (raw[k] === "") raw[k] = null;
  });

  return stripUnknownProductFields(raw).payload;
}

/** DB row → UI form (reads Studio + Central legacy column names). */
export function dbRowToProductForm(
  data: Record<string, unknown>,
  empty: Record<string, unknown>,
): Record<string, unknown> {
  const weightPerPiece =
    data.approximate_piece_weight_g ?? data.weight_per_pc_grams ?? data.grams_per_piece;
  const hero = data.hero_image_url ?? data.image_url ?? null;

  return {
    ...empty,
    ...data,
    product_name: toBlank(data.product_name ?? data.name),
    short_name: toBlank(data.short_name),
    category: toBlank(data.category),
    subcategory: toBlank(data.subcategory ?? data.sub_category),
    product_type: toBlank(data.product_type ?? data.product_family),
    description: toBlank(data.description),
    short_description: toBlank(data.short_description),
    pack_size: toBlank(data.pack_size),
    hero_image_url: toBlank(hero),
    main_department: toBlank(data.main_department ?? data.department),
    production_department: toBlank(data.production_department),
    net_weight_g: toBlank(data.net_weight_g ?? data.net_weight_grams),
    gross_weight_g: toBlank(data.gross_weight_g ?? data.gross_weight_grams),
    shelf_life_days: toBlank(data.shelf_life_days),
    storage_instructions: toBlank(data.storage_instructions),
    hsn_code: toBlank(data.hsn_code),
    gst_rate: toBlank(data.gst_rate ?? data.gst_percentage),
    mrp: toBlank(data.mrp),
    b2b_price: toBlank(data.b2b_price ?? data.price_b2b ?? data.base_price),
    export_price: toBlank(data.export_price),
    sku: data.sku ?? null,
    legacy_sku: data.legacy_sku ?? data.barcode_sku ?? null,
    is_active: data.is_active ?? true,
    is_catalogue_ready: data.is_catalogue_ready ?? data.visible_in_catalog ?? false,
    primary_uom: toBlank(data.primary_uom ?? data.uom),
    b2b_uom: toBlank(data.b2b_uom ?? data.uom),
    retail_uom: toBlank(data.retail_uom ?? data.uom),
    approximate_piece_weight_g: toBlank(weightPerPiece),
    pieces_per_kg:
      data.pieces_per_kg ??
      (weightPerPiece ? Number((1000 / Number(weightPerPiece)).toFixed(2)) : ""),
    moq_value: toBlank(data.moq_value ?? data.moq ?? data.moq_packs),
    moq_uom: toBlank(data.moq_uom ?? data.primary_uom ?? data.uom),
    product_class: toBlank(data.product_class),
    material_type: toBlank(data.material_type ?? data.material),
    product_dimensions_cm: toBlank(data.product_dimensions_cm ?? data.dimensions),
    // UI-only compliance text (not persisted on products row)
    ingredients: toBlank(data.ingredients),
    allergen_warnings: toBlank(data.allergen_warnings),
    nutritional_info: data.nutritional_info ?? data.nutrition_facts ?? "",
  };
}
