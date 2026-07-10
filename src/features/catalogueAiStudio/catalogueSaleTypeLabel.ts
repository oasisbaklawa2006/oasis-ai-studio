/**
 * Human-readable sale-type label for display (Catalogue Studio's product anchor, etc.).
 * saleTypeFromForm() (saleType.ts) returns the internal slug (e.g. "b2b_horeca") — never render
 * that slug directly to an operator; always resolve it through SALE_TYPES first.
 */
import { SALE_TYPES, saleTypeFromForm } from "@/features/productAuthority/saleType";

export function saleTypeLabelFromForm(form: Record<string, unknown>): string {
  const key = saleTypeFromForm(form);
  return SALE_TYPES.find((t) => t.key === key)?.label ?? key;
}
