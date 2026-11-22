/**
 * Point 34 — ProductEdit direct `products` write persistence gate.
 * Canonical shelf-life validation runs before adapter payload construction;
 * invalid zero/negative/fractional values throw (never coerced to null).
 */
import { fullEditorContentQuantity } from "@/features/productAuthority/fullEditorContentQuantity";
import { formToDbProductPayload } from "@/features/productAuthority/productSchemaAdapter";
import { factualCompositionSaveValidation } from "./productFactualCompositionCanonical";

/** Shelf-life fields ProductEdit coerces via NUMERIC_FIELDS before live products write. */
export const PRODUCT_EDIT_SHELF_LIFE_NUMERIC_FIELDS = [
  "shelf_life_days",
  "frozen_shelf_life_days",
  "post_processing_shelf_life_days",
] as const;

export function assertFactualCompositionValidForProductsWrite(
  record: Record<string, unknown>,
): void {
  const validation = factualCompositionSaveValidation(record);
  if (validation.ok !== true) {
    throw new Error(validation.message);
  }
}

/** Build the products-row payload only after canonical factual-composition validation passes. */
export function productEditDirectProductsRow(
  safePayload: Record<string, unknown>,
): Record<string, unknown> {
  assertFactualCompositionValidForProductsWrite(safePayload);
  const content = fullEditorContentQuantity(safePayload);
  if (!content.ok) throw new Error(content.message);
  const row = formToDbProductPayload(safePayload);
  if (Object.hasOwn(safePayload, "net_weight_g")) {
    row.net_weight_grams = row.net_weight_g;
  }
  if (content.quantity?.unit === "pcs") {
    row.pcs_per_pack = content.quantity.value;
  } else if (content.quantity) {
    const grams = content.quantity.value * (content.quantity.unit === "kg" ? 1000 : 1);
    // Both columns exist in Core; net_weight_grams is the Core #505 authority.
    row.net_weight_grams = grams;
    row.net_weight_g = grams;
    // A weight does not assert pieces. Preserve any independently saved Core count.
    delete row.pcs_per_pack;
  }
  return row;
}
