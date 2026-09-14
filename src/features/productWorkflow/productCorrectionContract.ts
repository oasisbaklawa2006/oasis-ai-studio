/**
 * Point 39 — correction / rejection / resubmission canonical closure.
 *
 * Delegates state-transition legality to Point 38 (`productWorkflowState.ts`).
 * Owns fail-closed correction semantics: immutable terminal snapshots, required
 * rejection reasons, predecessor linkage, and governed new-version creation.
 *
 * Boundaries (not absorbed):
 * - Point 40 — version/audit history presentation
 * - Point 54 — publication (`published` / `synced`)
 */
import type { CatalogueDraftStatus } from "@/features/catalogueAiStudio/catalogueDraftTypes";
import {
  assertValidWorkflowTransition,
  evaluateWorkflowTransition,
  mapCatalogueDraftStatus,
  mapContributorDraftStatus,
  type ContributorDraftStatus,
  type WorkflowActorRole,
} from "./productWorkflowState";

export const REJECTION_REASON_REQUIRED_MESSAGE = "Rejection reason is required.";

export const TERMINAL_SNAPSHOT_IMMUTABLE_MESSAGE =
  "Approved or rejected snapshots are immutable — corrections require a new version.";

export type CorrectionKind = "post_rejection" | "post_approval" | "initial";

/** Audit metadata persisted when a governed new version starts from a terminal predecessor. */
export type PredecessorLinkage = {
  predecessor_draft_id: string;
  predecessor_version_number: number;
  predecessor_status: CatalogueDraftStatus;
  correction_kind: CorrectionKind;
  previous_version_rejection_reason?: string;
};

export function normalizeRejectionReason(reason: string): string {
  return reason.trim();
}

export function assertRejectionReasonRequired(reason: string): void {
  if (!normalizeRejectionReason(reason)) {
    throw new Error(REJECTION_REASON_REQUIRED_MESSAGE);
  }
}

export function correctionKindFromPredecessorStatus(
  status: CatalogueDraftStatus,
): CorrectionKind {
  if (status === "REJECTED") return "post_rejection";
  if (status === "APPROVED") return "post_approval";
  return "initial";
}

export function isTerminalDraftStatus(status: CatalogueDraftStatus): boolean {
  return status === "APPROVED" || status === "REJECTED";
}

/**
 * Builds immutable predecessor linkage for CREATE_NEW_VERSION audit rows.
 * Preserves reviewer rejection reason when correcting from a rejected version.
 */
export function buildPredecessorLinkage(params: {
  predecessorDraftId: string;
  predecessorVersionNumber: number;
  predecessorStatus: CatalogueDraftStatus;
  rejectionReason?: string | null;
}): PredecessorLinkage {
  const kind = correctionKindFromPredecessorStatus(params.predecessorStatus);
  const linkage: PredecessorLinkage = {
    predecessor_draft_id: params.predecessorDraftId,
    predecessor_version_number: params.predecessorVersionNumber,
    predecessor_status: params.predecessorStatus,
    correction_kind: kind,
  };
  if (kind === "post_rejection" && params.rejectionReason) {
    linkage.previous_version_rejection_reason = params.rejectionReason;
  }
  return linkage;
}

export function buildRejectAuditMetadata(reason: string): Record<string, unknown> {
  const normalized = normalizeRejectionReason(reason);
  assertRejectionReasonRequired(normalized);
  return { rejection_reason: normalized };
}

/** Fail-closed: terminal reviewed snapshots must never be updated in place. */
export function assertTerminalSnapshotNotMutatedInPlace(status: CatalogueDraftStatus): void {
  if (isTerminalDraftStatus(status)) {
    throw new Error(TERMINAL_SNAPSHOT_IMMUTABLE_MESSAGE);
  }
}

/** Asserts Point 38 `create_new_version` legality before inserting a successor draft row. */
export function assertCorrectionResubmissionAllowed(params: {
  fromStatus: CatalogueDraftStatus;
  actorRole: WorkflowActorRole;
}): void {
  assertValidWorkflowTransition({
    domain: "catalogue_ai_studio_draft",
    fromPhase: mapCatalogueDraftStatus(params.fromStatus),
    action: "create_new_version",
    actorRole: params.actorRole,
  });
}

/**
 * Evaluates whether a contributor save is legal and whether it will spawn a new version
 * (correction/resubmission) versus updating the open DRAFT row.
 */
export function evaluateCorrectionSave(params: {
  latestStatus: CatalogueDraftStatus | null;
  actorRole: WorkflowActorRole;
}): {
  allowed: boolean;
  createsNewVersion: boolean;
  blockReason: string | null;
} {
  const result = evaluateWorkflowTransition({
    domain: "catalogue_ai_studio_draft",
    fromPhase: mapCatalogueDraftStatus(params.latestStatus),
    action: "save",
    actorRole: params.actorRole,
  });
  const createsNewVersion =
    params.latestStatus === "APPROVED" || params.latestStatus === "REJECTED";
  return {
    allowed: result.allowed,
    createsNewVersion,
    blockReason: result.blockReason,
  };
}

/** Contributor drafts in `rejected` require a fresh submission — never in-place mutation. */
export function contributorDraftRequiresNewSubmission(status: ContributorDraftStatus): boolean {
  return status === "rejected";
}

/**
 * Pure correction contract for Approval Inbox contributor draft types.
 * Resubmission after rejection is a new Core draft row (RPC), not an in-place update.
 */
export function evaluateContributorCorrection(params: {
  status: ContributorDraftStatus;
  actorRole: WorkflowActorRole;
  action: "resubmit" | "approve" | "reject";
  rejectionReason?: string;
}): { allowed: boolean; blockReason: string | null } {
  if (params.action === "resubmit") {
    if (!contributorDraftRequiresNewSubmission(params.status)) {
      return {
        allowed: false,
        blockReason: "Only rejected contributor drafts require a new submission.",
      };
    }
    if (params.actorRole !== "contributor") {
      return { allowed: false, blockReason: "Only a contributor may resubmit." };
    }
    return { allowed: true, blockReason: null };
  }

  if (params.action === "reject") {
    try {
      assertRejectionReasonRequired(params.rejectionReason ?? "");
    } catch (err) {
      return {
        allowed: false,
        blockReason: err instanceof Error ? err.message : REJECTION_REASON_REQUIRED_MESSAGE,
      };
    }
  }

  const workflowAction = params.action === "approve" ? "approve" : "reject";
  const result = evaluateWorkflowTransition({
    domain: "contributor_draft",
    fromPhase: mapContributorDraftStatus(params.status),
    action: workflowAction,
    actorRole: params.actorRole,
  });
  return { allowed: result.allowed, blockReason: result.blockReason };
}

/** Detects stale-version races when optimistic status guards fail. */
export function isStaleDraftStatus(
  expected: CatalogueDraftStatus,
  actual: CatalogueDraftStatus,
): boolean {
  return expected !== actual;
}
