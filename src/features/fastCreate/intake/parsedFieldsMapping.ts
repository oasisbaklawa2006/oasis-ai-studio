import type { FastCreateDraftSnapshot } from "@/features/fastCreate/fastCreateDraft";
import type { FastCreateCategoryKey } from "@/features/productDefaults/categoryDefaults";
import { intakeFieldSuggestion } from "./intakeFieldSuggestion";
import type {
  ParsedProductTextFields,
  ProductIntakeFieldSuggestion,
  ProductIntakeResult,
} from "./types";

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

type DraftFieldValues = {
  productName: string | null;
  categoryKey: FastCreateCategoryKey | null;
  mrp: string | null;
  b2bPrice: string | null;
  qtyPerPack: string | null;
  resolvedSku: string | null;
  clearSuggestions: boolean;
};

function emptyDraftFieldValues(): DraftFieldValues {
  return {
    productName: null,
    categoryKey: null,
    mrp: null,
    b2bPrice: null,
    qtyPerPack: null,
    resolvedSku: null,
    clearSuggestions: false,
  };
}

export function draftFieldValuesFromSuggestions(
  suggestions: ProductIntakeFieldSuggestion[],
): DraftFieldValues {
  const values = emptyDraftFieldValues();
  for (const suggestion of suggestions) {
    if (suggestion.field === "productName") {
      if (!suggestion.value) continue;
      values.productName = suggestion.value;
      values.clearSuggestions = true;
      continue;
    }
    if (suggestion.field === "category") {
      if (!suggestion.value) continue;
      values.categoryKey = suggestion.value as FastCreateCategoryKey;
      continue;
    }
    if (suggestion.field === "mrp") {
      if (!suggestion.value) continue;
      values.mrp = suggestion.value;
      continue;
    }
    if (suggestion.field === "b2bPrice") {
      if (!suggestion.value) continue;
      values.b2bPrice = suggestion.value;
      continue;
    }
    if (suggestion.field === "qtyPerPack") {
      if (!suggestion.value) continue;
      values.qtyPerPack = suggestion.value;
      continue;
    }
    if (suggestion.field === "sku" && suggestion.value) {
      values.resolvedSku = suggestion.value;
    }
  }
  return values;
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

/**
 * Merge a reviewable intake result into the canonical Fast Create draft snapshot.
 */
export function applyIntakeToDraft(
  current: FastCreateDraftSnapshot,
  intake: ProductIntakeResult,
): FastCreateDraftSnapshot {
  if (intakeBlocksDraftApply(intake) || intake.status === "empty") {
    return current;
  }

  const values = draftFieldValuesFromSuggestions(intake.suggestions);
  return {
    ...current,
    productName: values.productName ?? current.productName,
    categoryKey: values.categoryKey ?? current.categoryKey,
    mrp: values.mrp ?? current.mrp,
    b2bPrice: values.b2bPrice ?? current.b2bPrice,
    qtyPerPack: values.qtyPerPack ?? current.qtyPerPack,
    resolvedSku: values.resolvedSku ?? current.resolvedSku,
    suggestions: values.clearSuggestions ? null : current.suggestions,
  };
}

export function intakeBlocksDraftApply(intake: ProductIntakeResult): boolean {
  return intake.status === "duplicate_barcode" || intake.status === "unsupported";
}
