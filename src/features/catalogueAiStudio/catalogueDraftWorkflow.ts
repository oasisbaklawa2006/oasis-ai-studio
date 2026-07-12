/**
 * Pure workflow rules for Catalogue Product AI Studio drafts.
 * No I/O — status transitions and editability only. Persistence lives in catalogueDraftRepository.ts.
 */
import { exportBundleHasMissingFieldPlaceholder } from "./catalogueContentGenerators";
import type { CatalogueDraftContent, CatalogueDraftStatus } from "./catalogueDraftTypes";

export const STATUS_LABEL: Record<CatalogueDraftStatus, string> = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export function canSubmitForReview(status: CatalogueDraftStatus): boolean {
  return status === "DRAFT";
}

export function canApprove(status: CatalogueDraftStatus): boolean {
  return status === "UNDER_REVIEW";
}

export function canReject(status: CatalogueDraftStatus): boolean {
  return status === "UNDER_REVIEW";
}

/**
 * Owner-smoke-test finding: a REJECTED (or otherwise not-yet-approved) draft's Export tab let
 * "Copy bundle" hand out buyer-facing text unchanged — including unsupported historical claims and
 * raw missing-field placeholders — with no adjacent warning. Governance intent for this workspace
 * has never permitted external distribution of anything short of an Approved, complete draft, so
 * the bundle is distributable only when both hold: the persisted draft is APPROVED, and none of its
 * content blocks still carry a missing-field placeholder. A draft with no persisted status yet
 * (`null`, never saved) is never distributable either.
 */
export function isExportBundleDistributable(
  status: CatalogueDraftStatus | null,
  content: CatalogueDraftContent,
): boolean {
  return status === "APPROVED" && !exportBundleHasMissingFieldPlaceholder(content);
}
