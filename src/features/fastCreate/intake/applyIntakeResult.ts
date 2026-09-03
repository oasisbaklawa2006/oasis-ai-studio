import type { FastCreateDraftSnapshot } from "@/features/fastCreate/fastCreateDraft";
import type { SaleType } from "@/features/productAuthority/saleType";
import type { FastCreateCategoryKey } from "@/features/productDefaults/categoryDefaults";
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
    next.productName = String(productName);
    next.suggestions = null;
  }
  if (hasValue(categoryKey)) {
    next.categoryKey = categoryKey as FastCreateCategoryKey;
  }
  if (hasValue(saleType)) {
    next.saleType = saleType as SaleType;
  }
  if (hasValue(packagingCode)) next.packagingCode = String(packagingCode);
  if (hasValue(packagingLabel)) next.packagingLabel = String(packagingLabel);
  if (hasValue(qtyPerPack)) next.qtyPerPack = String(qtyPerPack);
  if (hasValue(mrp)) next.mrp = String(mrp);
  if (hasValue(b2bPrice)) next.b2bPrice = String(b2bPrice);
  if (hasValue(b2bEnabled)) next.b2bEnabled = Boolean(b2bEnabled);
  if (hasValue(heroUrl)) next.heroUrl = String(heroUrl);
  if (hasValue(resolvedSku)) next.resolvedSku = String(resolvedSku);
  if (hasValue(editedDescription)) next.editedDescription = String(editedDescription);
  if (hasValue(editedAliases)) next.editedAliases = String(editedAliases);
  if (hasValue(editedWhatsappKeywords)) {
    next.editedWhatsappKeywords = String(editedWhatsappKeywords);
  }

  return next;
}

export function intakeBlocksDraftApply(intake: ProductIntakeResult): boolean {
  return intake.status === "duplicate_barcode" || intake.status === "unsupported";
}
