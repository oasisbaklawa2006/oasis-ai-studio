import type { Category1AuthorityRow, ValidationIssue } from "./types";

const DEPARTMENTS = new Set([
  "ready_goods_store",
  "packing_assembly",
  "third_party_goods_store",
]);

const PRODUCTION_DEPARTMENTS = new Set([
  "arabic_sweets",
  "dragees",
  "fusion_sweets",
  "chocolates_confectionery",
  "seasoned_nuts_mixes",
  "bakery",
]);

const UOMS = new Set([
  "kg",
  "grams",
  "pcs",
  "box",
  "carton",
  "tray",
  "pack",
  "litre",
  "ml",
  "bundle",
  "basket",
  "jar",
  "packet",
  "tub",
]);

function isPositiveNumber(value: number | null | undefined): boolean {
  return value != null && Number.isFinite(value) && value >= 0;
}

export function validateCategory1Row(row: Category1AuthorityRow): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!row.product_name?.trim()) {
    issues.push({
      level: "error",
      code: "missing_product_name",
      message: "Product name is required",
    });
  }

  if (!row.category?.trim()) {
    issues.push({
      level: "error",
      code: "missing_category",
      message: "Category is required",
    });
  }

  if (!row.sku?.trim()) {
    issues.push({
      level: "warning",
      code: "missing_sku",
      message: "SKU missing — admin will assign during approval",
    });
  } else if (row.sku.length > 64) {
    issues.push({
      level: "error",
      code: "sku_too_long",
      message: "SKU must be 64 characters or fewer",
    });
  }

  if (row.main_department && !DEPARTMENTS.has(row.main_department)) {
    issues.push({
      level: "warning",
      code: "unknown_department",
      message: `Unknown main_department "${row.main_department}" — will need review`,
    });
  }

  if (
    row.main_department === "ready_goods_store" &&
    row.production_department &&
    !PRODUCTION_DEPARTMENTS.has(row.production_department)
  ) {
    issues.push({
      level: "warning",
      code: "unknown_production_department",
      message: `Unknown production_department "${row.production_department}"`,
    });
  }

  if (row.primary_uom && !UOMS.has(row.primary_uom.toLowerCase())) {
    issues.push({
      level: "warning",
      code: "unknown_uom",
      message: `UOM "${row.primary_uom}" is not in the standard list`,
    });
  }

  for (const [field, value] of [
    ["mrp", row.mrp],
    ["b2b_price", row.b2b_price],
    ["export_price", row.export_price],
    ["gst_rate", row.gst_rate],
    ["moq_value", row.moq_value],
    ["approximate_piece_weight_g", row.approximate_piece_weight_g],
  ] as const) {
    if (value != null && !isPositiveNumber(value)) {
      issues.push({
        level: "error",
        code: `invalid_${field}`,
        message: `${field} must be a non-negative number`,
      });
    }
  }

  if (row.gst_rate != null && (row.gst_rate < 0 || row.gst_rate > 100)) {
    issues.push({
      level: "warning",
      code: "gst_out_of_range",
      message: "GST rate is outside 0–100%",
    });
  }

  if (row.source_page != null && (!Number.isInteger(row.source_page) || row.source_page < 1)) {
    issues.push({
      level: "warning",
      code: "invalid_source_page",
      message: "source_page should be a positive integer",
    });
  }

  return issues;
}
