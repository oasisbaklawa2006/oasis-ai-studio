/**
 * Pure workflow rules for Catalogue Product AI Studio drafts.
 * No I/O — status transitions and editability only. Persistence lives in catalogueDraftRepository.ts.
 *
 * Point 38: delegates transition authority to `productWorkflowState.ts`.
 */

import {
  canPerformWorkflowAction,
  isWorkflowExternallyDistributable,
  mapCatalogueDraftStatus,
} from "@/features/productWorkflow/productWorkflowState";
import { exportBundleHasMissingFieldPlaceholder } from "./catalogueContentGenerators";
import type { CatalogueDraftContent, CatalogueDraftStatus } from "./catalogueDraftTypes";

export const STATUS_LABEL: Record<CatalogueDraftStatus, string> = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

function draftPhase(status: CatalogueDraftStatus): ReturnType<typeof mapCatalogueDraftStatus> {
  return mapCatalogueDraftStatus(status);
}

export function canSubmitForReview(status: CatalogueDraftStatus): boolean {
  return canPerformWorkflowAction({
    domain: "catalogue_ai_studio_draft",
    fromPhase: draftPhase(status),
    action: "submit",
    actorRole: "contributor",
  });
}

export function canApprove(status: CatalogueDraftStatus): boolean {
  return canPerformWorkflowAction({
    domain: "catalogue_ai_studio_draft",
    fromPhase: draftPhase(status),
    action: "approve",
    actorRole: "reviewer",
  });
}

export function canReject(status: CatalogueDraftStatus): boolean {
  return canPerformWorkflowAction({
    domain: "catalogue_ai_studio_draft",
    fromPhase: draftPhase(status),
    action: "reject",
    actorRole: "reviewer",
  });
}

export function canSaveDraft(status: CatalogueDraftStatus | null): boolean {
  return canPerformWorkflowAction({
    domain: "catalogue_ai_studio_draft",
    fromPhase: mapCatalogueDraftStatus(status),
    action: "save",
    actorRole: "contributor",
  });
}

export function canCreateNewVersion(status: CatalogueDraftStatus): boolean {
  return canPerformWorkflowAction({
    domain: "catalogue_ai_studio_draft",
    fromPhase: draftPhase(status),
    action: "create_new_version",
    actorRole: "contributor",
  });
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
  const phase = mapCatalogueDraftStatus(status);
  return (
    isWorkflowExternallyDistributable(phase) && !exportBundleHasMissingFieldPlaceholder(content)
  );
}
