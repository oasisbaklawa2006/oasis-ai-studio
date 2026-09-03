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
    next.productName = String(patch.productName);
    next.suggestions = null;
  }
  if (hasValue(patch.categoryKey)) {
    next.categoryKey = patch.categoryKey as FastCreateDraftSnapshot["categoryKey"];
  }
  if (hasValue(patch.saleType)) {
    next.saleType = patch.saleType as FastCreateDraftSnapshot["saleType"];
  }
  if (hasValue(patch.packagingCode)) next.packagingCode = String(patch.packagingCode);
  if (hasValue(patch.packagingLabel)) next.packagingLabel = String(patch.packagingLabel);
  if (hasValue(patch.qtyPerPack)) next.qtyPerPack = String(patch.qtyPerPack);
  if (hasValue(patch.mrp)) next.mrp = String(patch.mrp);
  if (hasValue(patch.b2bPrice)) next.b2bPrice = String(patch.b2bPrice);
  if (hasValue(patch.b2bEnabled)) next.b2bEnabled = Boolean(patch.b2bEnabled);
  if (hasValue(patch.heroUrl)) next.heroUrl = String(patch.heroUrl);
  if (hasValue(patch.resolvedSku)) next.resolvedSku = String(patch.resolvedSku);
  if (hasValue(patch.editedDescription)) next.editedDescription = String(patch.editedDescription);
  if (hasValue(patch.editedAliases)) next.editedAliases = String(patch.editedAliases);
  if (hasValue(patch.editedWhatsappKeywords)) {
    next.editedWhatsappKeywords = String(patch.editedWhatsappKeywords);
  }

  return next;
}

export function intakeBlocksDraftApply(intake: ProductIntakeResult): boolean {
  return intake.status === "duplicate_barcode" || intake.status === "unsupported";
}
