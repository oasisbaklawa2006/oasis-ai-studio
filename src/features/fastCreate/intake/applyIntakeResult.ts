import type { FastCreateDraftSnapshot } from "@/features/fastCreate/fastCreateDraft";
import type { FastCreateCategoryKey } from "@/features/productDefaults/categoryDefaults";
import type { ProductIntakeFieldSuggestion, ProductIntakeResult } from "./types";

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

function collectDraftFieldValues(suggestions: ProductIntakeFieldSuggestion[]): DraftFieldValues {
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

  const values = collectDraftFieldValues(intake.suggestions);
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
