/**
 * Infer BOM requirement from product class / department.
 * Used for UI when products.bom_required is not yet readable from live Central.
 */
export function inferBomRequiredFromProduct(input: {
  main_department?: string | null;
  product_class?: string | null;
  bom_required?: boolean | null;
}): boolean {
  if (input.main_department === "packing_assembly") return true;
  const cls = String(input.product_class ?? "").toLowerCase();
  if (cls === "gift_hamper" || cls === "ready_pack") return true;
  return !!input.bom_required;
}
