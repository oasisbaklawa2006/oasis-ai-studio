import type { FastCreateDraftSnapshot } from "@/features/fastCreate/fastCreateDraft";
import type { ProductIntakeResult } from "./types";

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
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

  const patch = intake.draftPatch;
  const next: FastCreateDraftSnapshot = { ...current };

  if (hasValue(patch.productName)) {
    next.productName = patch.productName as string;
    next.suggestions = null;
  }
  if (hasValue(patch.categoryKey))
    next.categoryKey = patch.categoryKey as FastCreateDraftSnapshot["categoryKey"];
  if (hasValue(patch.saleType))
    next.saleType = patch.saleType as FastCreateDraftSnapshot["saleType"];
  if (hasValue(patch.packagingCode)) next.packagingCode = patch.packagingCode as string;
  if (hasValue(patch.packagingLabel)) next.packagingLabel = patch.packagingLabel as string;
  if (hasValue(patch.qtyPerPack)) next.qtyPerPack = patch.qtyPerPack as string;
  if (hasValue(patch.mrp)) next.mrp = patch.mrp as string;
  if (hasValue(patch.b2bPrice)) next.b2bPrice = patch.b2bPrice as string;
  if (hasValue(patch.b2bEnabled)) next.b2bEnabled = patch.b2bEnabled as boolean;
  if (hasValue(patch.heroUrl)) next.heroUrl = patch.heroUrl as string;
  if (hasValue(patch.resolvedSku)) next.resolvedSku = patch.resolvedSku as string;
  if (hasValue(patch.editedDescription)) next.editedDescription = patch.editedDescription as string;
  if (hasValue(patch.editedAliases)) next.editedAliases = patch.editedAliases as string;
  if (hasValue(patch.editedWhatsappKeywords)) {
    next.editedWhatsappKeywords = patch.editedWhatsappKeywords as string;
  }

  return next;
}

export function intakeBlocksDraftApply(intake: ProductIntakeResult): boolean {
  return intake.status === "duplicate_barcode" || intake.status === "unsupported";
}
