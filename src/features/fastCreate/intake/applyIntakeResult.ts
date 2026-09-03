import type { FastCreateDraftSnapshot } from "@/features/fastCreate/fastCreateDraft";
import type { ProductIntakeResult } from "./types";

const DRAFT_PATCH_KEYS = [
  "productName",
  "categoryKey",
  "saleType",
  "packagingCode",
  "packagingLabel",
  "qtyPerPack",
  "mrp",
  "b2bPrice",
  "b2bEnabled",
  "heroUrl",
  "resolvedSku",
  "suggestions",
  "editedDescription",
  "editedAliases",
  "editedWhatsappKeywords",
] as const satisfies readonly (keyof FastCreateDraftSnapshot)[];

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
  for (const key of DRAFT_PATCH_KEYS) {
    const value = intake.draftPatch[key];
    if (value !== undefined && value !== null && value !== "") {
      next[key] = value as never;
    }
  }

  if (intake.draftPatch.productName) {
    next.suggestions = null;
  }

  return next;
}

export function intakeBlocksDraftApply(intake: ProductIntakeResult): boolean {
  return intake.status === "duplicate_barcode" || intake.status === "unsupported";
}
