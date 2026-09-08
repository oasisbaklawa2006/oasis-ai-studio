/**
 * Point 34 — ProductEdit direct `products` write persistence gate.
 * Canonical shelf-life validation runs before adapter payload construction;
 * invalid zero/negative/fractional values throw (never coerced to null).
 */
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
  if (!validation.ok) {
    throw new Error(validation.message);
  }
}

/** Build the products-row payload only after canonical factual-composition validation passes. */
export function productEditDirectProductsRow(
  safePayload: Record<string, unknown>,
): Record<string, unknown> {
  assertFactualCompositionValidForProductsWrite(safePayload);
  return formToDbProductPayload(safePayload);
}
