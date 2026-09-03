import type { FastCreateDraftSnapshot } from "@/features/fastCreate/fastCreateDraft";
import type { FastCreateCategoryKey } from "@/features/productDefaults/categoryDefaults";
import type { ProductIntakeFieldSuggestion, ProductIntakeResult } from "./types";

function applySuggestion(
  next: FastCreateDraftSnapshot,
  suggestion: ProductIntakeFieldSuggestion,
): void {
  const value = suggestion.value;
  if (!value) return;

  if (suggestion.field === "productName") {
    next.productName = value;
    next.suggestions = null;
    return;
  }
  if (suggestion.field === "category") {
    next.categoryKey = value as FastCreateCategoryKey;
    return;
  }
  if (suggestion.field === "mrp") {
    next.mrp = value;
    return;
  }
  if (suggestion.field === "b2bPrice") {
    next.b2bPrice = value;
    return;
  }
  if (suggestion.field === "qtyPerPack") {
    next.qtyPerPack = value;
    return;
  }
  if (suggestion.field === "sku") {
    next.resolvedSku = value;
  }
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

  const next: FastCreateDraftSnapshot = { ...current };
  for (const suggestion of intake.suggestions) {
    applySuggestion(next, suggestion);
  }
  return next;
}

export function intakeBlocksDraftApply(intake: ProductIntakeResult): boolean {
  return intake.status === "duplicate_barcode" || intake.status === "unsupported";
}
