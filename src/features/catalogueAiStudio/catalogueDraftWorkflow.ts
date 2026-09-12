/**
 * Pure workflow rules for Catalogue Product AI Studio drafts.
 * No I/O — status transitions and editability only. Persistence lives in catalogueDraftRepository.ts.
 */

import {
  type DeferredDetailManifest,
  deferredDetailFromCatalogueContent,
  evaluateTransitionGate,
  parseDeferredDetailManifest,
  type WorkflowStage,
} from "@/features/productAuthority/deferredDetailContract";
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
  deferredDetail?: DeferredDetailManifest | null,
): boolean {
  if (status !== "APPROVED") return false;
  if (exportBundleHasMissingFieldPlaceholder(content)) return false;
  const manifest =
    deferredDetail ??
    ({
      contract_version: 1,
      fields: deferredDetailFromCatalogueContent(content),
    } as DeferredDetailManifest);
  return evaluateTransitionGate(manifest, "publication").allowed;
}

/** Fail-closed approval gate — blocks when deferred/unknown/pending fields remain. */
export function canApproveWithDeferredDetail(
  status: CatalogueDraftStatus,
  content: CatalogueDraftContent,
  sourceSnapshot?: Record<string, unknown> | null,
): boolean {
  if (!canApprove(status)) return false;
  const persisted = sourceSnapshot
    ? parseDeferredDetailManifest(sourceSnapshot.deferred_detail)
    : null;
  const manifest: DeferredDetailManifest = persisted ?? {
    contract_version: 1,
    fields: deferredDetailFromCatalogueContent(content),
  };
  return evaluateTransitionGate(manifest, "approval").allowed;
}

/** Evaluate transition gate for an arbitrary workflow stage using content + optional snapshot. */
export function evaluateCatalogueDraftTransition(
  stage: WorkflowStage,
  content: CatalogueDraftContent,
  sourceSnapshot?: Record<string, unknown> | null,
) {
  const persisted = sourceSnapshot
    ? parseDeferredDetailManifest(sourceSnapshot.deferred_detail)
    : null;
  const manifest: DeferredDetailManifest = persisted ?? {
    contract_version: 1,
    fields: deferredDetailFromCatalogueContent(content),
  };
  return evaluateTransitionGate(manifest, stage);
}
