/**
 * Classifies a product into one work-queue category for the Catalogue Studio operator cockpit,
 * from data already computed elsewhere (readiness overall label, draft status) — no new formula,
 * no new schema. "Needs Human Review" and "Ready for Approval" describe the exact same underlying
 * state (`UNDER_REVIEW`) from two different operator perspectives (submitter vs. reviewer); rather
 * than invent a distinction the data model doesn't have, both filter aliases resolve to one
 * canonical status/label pair.
 *
 * Point 38: work-queue labels map to canonical `ProductWorkflowPhase` via `mapCatalogueDraftStatus`.
 */

import {
  mapCatalogueDraftStatus,
  type ProductWorkflowPhase,
} from "@/features/productWorkflow/productWorkflowState";
import type { CatalogueDraftStatus } from "./catalogueDraftTypes";
import type { ReadinessResult } from "./catalogueProductReadiness";

export type WorkQueueStatus =
  | "needs_truth"
  | "ready_for_generation"
  | "draft"
  | "under_review"
  | "rejected"
  | "approved";

export const WORK_QUEUE_STATUSES: readonly WorkQueueStatus[] = [
  "needs_truth",
  "ready_for_generation",
  "draft",
  "under_review",
  "rejected",
  "approved",
];

export const WORK_QUEUE_STATUS_LABEL: Record<WorkQueueStatus, string> = {
  needs_truth: "Needs Product Truth",
  ready_for_generation: "Ready for Generation",
  draft: "Draft",
  under_review: "Needs Human Review / Ready for Approval",
  rejected: "Rejected — Correction Required",
  approved: "Approved",
};

export interface WorkQueueClassificationInput {
  readinessOverallLabel: ReadinessResult["overallLabel"] | null;
  draftStatus: CatalogueDraftStatus | null;
}

/** Maps canonical Point 38 phase to operator work-queue label. */
export function workQueueStatusFromPhase(phase: ProductWorkflowPhase): WorkQueueStatus {
  switch (phase) {
    case "submitted":
      return "under_review";
    case "rejected":
      return "rejected";
    case "approved":
      return "approved";
    case "draft":
      return "draft";
    case "pre_draft":
      return "needs_truth";
    default:
      return "ready_for_generation";
  }
}

export function classifyWorkQueueStatus(input: WorkQueueClassificationInput): WorkQueueStatus {
  if (input.draftStatus) {
    return workQueueStatusFromPhase(mapCatalogueDraftStatus(input.draftStatus));
  }
  if (input.readinessOverallLabel === "Not ready") return "needs_truth";
  return "ready_for_generation";
}
