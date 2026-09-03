import type { FastCreateDraftSnapshot } from "@/features/fastCreate/fastCreateDraft";
import { draftFieldValuesFromSuggestions } from "./parsedFieldsMapping";
import type { ProductIntakeResult } from "./types";

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
