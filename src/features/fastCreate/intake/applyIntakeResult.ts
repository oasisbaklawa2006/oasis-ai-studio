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

  const {
    productName,
    categoryKey,
    saleType,
    packagingCode,
    packagingLabel,
    qtyPerPack,
    mrp,
    b2bPrice,
    b2bEnabled,
    heroUrl,
    resolvedSku,
    editedDescription,
    editedAliases,
    editedWhatsappKeywords,
  } = intake.draftPatch;

  const next: FastCreateDraftSnapshot = { ...current };

  if (hasValue(productName)) {
    next.productName = productName as string;
    next.suggestions = null;
  }
  if (hasValue(categoryKey))
    next.categoryKey = categoryKey as FastCreateDraftSnapshot["categoryKey"];
  if (hasValue(saleType)) next.saleType = saleType as FastCreateDraftSnapshot["saleType"];
  if (hasValue(packagingCode)) next.packagingCode = packagingCode as string;
  if (hasValue(packagingLabel)) next.packagingLabel = packagingLabel as string;
  if (hasValue(qtyPerPack)) next.qtyPerPack = qtyPerPack as string;
  if (hasValue(mrp)) next.mrp = mrp as string;
  if (hasValue(b2bPrice)) next.b2bPrice = b2bPrice as string;
  if (hasValue(b2bEnabled)) next.b2bEnabled = b2bEnabled as boolean;
  if (hasValue(heroUrl)) next.heroUrl = heroUrl as string;
  if (hasValue(resolvedSku)) next.resolvedSku = resolvedSku as string;
  if (hasValue(editedDescription)) next.editedDescription = editedDescription as string;
  if (hasValue(editedAliases)) next.editedAliases = editedAliases as string;
  if (hasValue(editedWhatsappKeywords))
    next.editedWhatsappKeywords = editedWhatsappKeywords as string;

  return next;
}

export function intakeBlocksDraftApply(intake: ProductIntakeResult): boolean {
  return intake.status === "duplicate_barcode" || intake.status === "unsupported";
}
