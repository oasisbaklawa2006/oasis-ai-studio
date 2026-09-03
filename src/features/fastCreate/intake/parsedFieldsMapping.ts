import type { FastCreateDraftSnapshot } from "@/features/fastCreate/fastCreateDraft";
import { intakeFieldSuggestion } from "./intakeFieldSuggestion";
import type { ParsedProductTextFields, ProductIntakeFieldSuggestion } from "./types";

export function parsedFieldsToDraft(
  parsed: ParsedProductTextFields,
): Partial<FastCreateDraftSnapshot> {
  const patch: Partial<FastCreateDraftSnapshot> = {};
  if (parsed.productName) patch.productName = parsed.productName;
  if (parsed.categoryKey) patch.categoryKey = parsed.categoryKey;
  if (parsed.mrp) patch.mrp = parsed.mrp;
  if (parsed.b2bPrice) patch.b2bPrice = parsed.b2bPrice;
  if (parsed.qtyPerPack) patch.qtyPerPack = parsed.qtyPerPack;
  if (parsed.sku) patch.resolvedSku = parsed.sku;
  return patch;
}

export function parsedFieldsToSuggestions(
  parsed: ParsedProductTextFields,
): ProductIntakeFieldSuggestion[] {
  const out: ProductIntakeFieldSuggestion[] = [];
  if (parsed.productName)
    out.push(intakeFieldSuggestion("productName", parsed.productName, "medium", "text_parse"));
  if (parsed.categoryKey)
    out.push(intakeFieldSuggestion("category", parsed.categoryKey, "low", "text_parse"));
  if (parsed.mrp) out.push(intakeFieldSuggestion("mrp", parsed.mrp, "medium", "text_parse"));
  if (parsed.b2bPrice)
    out.push(intakeFieldSuggestion("b2bPrice", parsed.b2bPrice, "medium", "text_parse"));
  if (parsed.qtyPerPack)
    out.push(intakeFieldSuggestion("qtyPerPack", parsed.qtyPerPack, "medium", "text_parse"));
  if (parsed.sku) out.push(intakeFieldSuggestion("sku", parsed.sku, "high", "text_parse"));
  if (parsed.barcode)
    out.push(intakeFieldSuggestion("barcode", parsed.barcode, "medium", "text_parse"));
  if (parsed.notes) out.push(intakeFieldSuggestion("notes", parsed.notes, "low", "text_parse"));
  return out;
}
