import type { FastCreateDraftSnapshot } from "@/features/fastCreate/fastCreateDraft";
import type { ProductIntakeResult } from "./types";

/**
 * Merge a reviewable intake result into the canonical Fast Create draft snapshot.
 * Never overwrites with empty values; duplicate/unsupported intake is a no-op.
 */
export function applyIntakeToDraft(
  current: FastCreateDraftSnapshot,
  intake: ProductIntakeResult,
): FastCreateDraftSnapshot {
  if (intakeBlocksDraftApply(intake) || intake.status === "empty") {
    return current;
  }

  const patch = pickDefined(intake.draftPatch);
  const next: FastCreateDraftSnapshot = { ...current, ...patch };

  if (patch.productName) {
    next.suggestions = null;
  }

  return next;
}

function pickDefined(patch: Partial<FastCreateDraftSnapshot>): Partial<FastCreateDraftSnapshot> {
  const out: Partial<FastCreateDraftSnapshot> = {};
  for (const [key, value] of Object.entries(patch) as [keyof FastCreateDraftSnapshot, unknown][]) {
    if (value !== undefined && value !== null && value !== "") {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}

export function intakeBlocksDraftApply(intake: ProductIntakeResult): boolean {
  return intake.status === "duplicate_barcode" || intake.status === "unsupported";
}
