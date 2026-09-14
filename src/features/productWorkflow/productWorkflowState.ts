/**
 * Point 38 — canonical product workflow state / transition contract.
 *
 * Ownership:
 * - Catalogue AI Studio copy drafts: Core `catalogue_ai_studio_drafts.status`
 * - Contributor drafts (7 types): Core draft tables + Approval Inbox RPCs
 * - Catalogue versions: Core `catalogue_versions.status` (publication = Point 54)
 *
 * Boundaries (referenced, not implemented here):
 * - Point 39 — correction / resubmission after rejection (`create_new_version` only)
 * - Point 40 — version history read model (`productVersionHistory.ts`)
 * - Point 54 — publication (`published` / `synced` phases)
 *
 * AI Studio owns pure transition guards and UI bindings — never Core transactional authority.
 */
import type { CatalogueDraftStatus } from "@/features/catalogueAiStudio/catalogueDraftTypes";
import type { CatalogueVersionStatus } from "@/features/catalogueSnapshot/types";

/** Normalized lifecycle phases owned by Point 38. */
export const POINT_38_CANONICAL_PHASES = [
  "pre_draft",
  "draft",
  "submitted",
  "approved",
  "rejected",
] as const;

export type ProductWorkflowPhase = (typeof POINT_38_CANONICAL_PHASES)[number];

/** Point 54 publication phase — fail-closed skip guard only; not a Point 38 transition target. */
export const POINT_54_PUBLICATION_PHASE = "published" as const;

export type ProductWorkflowPhaseWithPublication =
  | ProductWorkflowPhase
  | typeof POINT_54_PUBLICATION_PHASE;

export type ProductWorkflowDomain =
  | "catalogue_ai_studio_draft"
  | "contributor_draft"
  | "catalogue_version";

export type ContributorDraftStatus = "pending_approval" | "approved" | "rejected";

export type WorkflowActorRole = "contributor" | "reviewer";

export type WorkflowTransitionAction =
  | "save"
  | "submit"
  | "approve"
  | "reject"
  | "create_new_version"
  | "publish";

export type WorkflowTransitionContext = {
  domain: ProductWorkflowDomain;
  fromPhase: ProductWorkflowPhaseWithPublication;
  action: WorkflowTransitionAction;
  actorRole: WorkflowActorRole;
};

export type WorkflowTransitionResult = {
  allowed: boolean;
  toPhase: ProductWorkflowPhaseWithPublication | null;
  blockReason: string | null;
};

export const POINT_38_BOUNDARIES = {
  point39:
    "Correction/resubmission after rejection — save creates a new DRAFT version; Point 39 owns audit persistence.",
  point54:
    "Publication (`published` / `synced`) — Core/Central authority; AI Studio never transitions directly.",
} as const;

export const POINT_38_CORE_DEPENDENCIES = {
  catalogueAiStudioDrafts: ["catalogue_ai_studio_drafts", "catalogue_ai_studio_draft_audit_log"],
  contributorDrafts: [
    "catalogue_product_drafts",
    "catalogue_media_submissions",
    "catalogue_alias_drafts",
    "catalogue_bom_drafts",
    "catalogue_tag_drafts",
    "catalogue_moq_drafts",
    "catalogue_pricing_drafts",
  ],
  catalogueVersions: ["catalogue_versions"],
} as const;

const PHASE_LABEL: Record<ProductWorkflowPhaseWithPublication, string> = {
  pre_draft: "Pre-draft (readiness gating)",
  draft: "Draft",
  submitted: "Submitted for review",
  approved: "Approved",
  rejected: "Rejected — correction required",
  published: "Published (Point 54)",
};

/** Allowed canonical transitions keyed by action. */
const ACTION_TARGET_PHASE: Partial<
  Record<WorkflowTransitionAction, ProductWorkflowPhaseWithPublication>
> = {
  save: "draft",
  submit: "submitted",
  approve: "approved",
  reject: "rejected",
  create_new_version: "draft",
  publish: POINT_54_PUBLICATION_PHASE,
};

const REVIEWER_ACTIONS: ReadonlySet<WorkflowTransitionAction> = new Set(["approve", "reject"]);
const CONTRIBUTOR_ACTIONS: ReadonlySet<WorkflowTransitionAction> = new Set([
  "save",
  "submit",
  "create_new_version",
]);

/** Domain status → canonical phase (fail-closed on unknown values). */
export function mapCatalogueDraftStatus(status: CatalogueDraftStatus | null): ProductWorkflowPhase {
  switch (status) {
    case "DRAFT":
      return "draft";
    case "UNDER_REVIEW":
      return "submitted";
    case "APPROVED":
      return "approved";
    case "REJECTED":
      return "rejected";
    default:
      return "pre_draft";
  }
}

export function mapContributorDraftStatus(status: ContributorDraftStatus): ProductWorkflowPhase {
  switch (status) {
    case "pending_approval":
      return "submitted";
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    default:
      return "draft";
  }
}

export function mapCatalogueVersionStatus(
  status: CatalogueVersionStatus,
): ProductWorkflowPhaseWithPublication {
  switch (status) {
    case "draft":
      return "draft";
    case "pending_approval":
      return "submitted";
    case "approved":
      return "approved";
    case "published":
    case "synced":
      return POINT_54_PUBLICATION_PHASE;
    default:
      return "draft";
  }
}

export function phaseLabel(phase: ProductWorkflowPhaseWithPublication): string {
  return PHASE_LABEL[phase];
}

export function isPoint54PublicationPhase(phase: ProductWorkflowPhaseWithPublication): boolean {
  return phase === POINT_54_PUBLICATION_PHASE;
}

export function isPoint39CorrectionPhase(phase: ProductWorkflowPhase): boolean {
  return phase === "rejected";
}

/** True when external distribution / handoff is permitted at the workflow layer. */
export function isWorkflowExternallyDistributable(phase: ProductWorkflowPhase): boolean {
  return phase === "approved";
}

/**
 * Evaluates whether a workflow action is legal from the current canonical phase.
 * Fail-closed: illegal skips (draft→approved, draft→published, rejected→approved) return allowed=false.
 */
export function evaluateWorkflowTransition(
  ctx: WorkflowTransitionContext,
): WorkflowTransitionResult {
  const targetPhase = ACTION_TARGET_PHASE[ctx.action];
  if (!targetPhase) {
    return {
      allowed: false,
      toPhase: null,
      blockReason: `Unknown workflow action: ${ctx.action}`,
    };
  }

  if (ctx.action === "publish") {
    return {
      allowed: false,
      toPhase: null,
      blockReason: "Publication is Point 54 authority — AI Studio cannot publish directly.",
    };
  }

  if (REVIEWER_ACTIONS.has(ctx.action) && ctx.actorRole !== "reviewer") {
    return {
      allowed: false,
      toPhase: null,
      blockReason: `Only a reviewer may ${ctx.action} a draft.`,
    };
  }

  if (CONTRIBUTOR_ACTIONS.has(ctx.action) && ctx.actorRole !== "contributor") {
    return {
      allowed: false,
      toPhase: null,
      blockReason: `Only a contributor may ${ctx.action}.`,
    };
  }

  const from = ctx.fromPhase;

  if (isPoint54PublicationPhase(from)) {
    return {
      allowed: false,
      toPhase: null,
      blockReason: "Published records are immutable at the workflow layer.",
    };
  }

  switch (ctx.action) {
    case "save":
      if (from === "submitted") {
        return blocked("Cannot edit while submitted for review. Reject or wait for review first.");
      }
      if (from === "approved" || from === "rejected") {
        return allowed(targetPhase);
      }
      if (from === "draft" || from === "pre_draft") {
        return allowed(targetPhase);
      }
      return blocked(`Cannot save from phase ${phaseLabel(from)}.`);

    case "submit":
      if (from !== "draft") {
        return blocked("Only an open draft can be submitted for review.");
      }
      return allowed(targetPhase);

    case "approve":
      if (from !== "submitted") {
        return blocked(
          "Only a submitted draft can be approved — draft→approved skips are forbidden.",
        );
      }
      return allowed(targetPhase);

    case "reject":
      if (from !== "submitted") {
        return blocked("Only a submitted draft can be rejected.");
      }
      return allowed(targetPhase);

    case "create_new_version":
      if (from !== "approved" && from !== "rejected") {
        return blocked(
          "New versions may only start from an approved or rejected terminal state (Point 39 boundary).",
        );
      }
      return allowed(targetPhase);

    default:
      return blocked(`Action ${ctx.action} is not supported in Point 38 scope.`);
  }
}

export function canPerformWorkflowAction(ctx: WorkflowTransitionContext): boolean {
  return evaluateWorkflowTransition(ctx).allowed;
}

export function assertValidWorkflowTransition(ctx: WorkflowTransitionContext): void {
  const result = evaluateWorkflowTransition(ctx);
  if (!result.allowed) {
    throw new Error(result.blockReason ?? "Illegal workflow transition.");
  }
}

/** Guards against stale status inference when persisted status disagrees with expected phase. */
export function workflowStatusStale(
  expectedPhase: ProductWorkflowPhaseWithPublication,
  actualPhase: ProductWorkflowPhaseWithPublication,
): boolean {
  return expectedPhase !== actualPhase;
}

export type Point38WorkflowSnapshot = {
  schema: "point38_v1";
  phase: ProductWorkflowPhase;
  domain: ProductWorkflowDomain;
  domain_status: string | null;
  externally_distributable: boolean;
  point39_correction_boundary: boolean;
  point54_publication_boundary: boolean;
};

export function serializeWorkflowStateForSnapshot(input: {
  domain: ProductWorkflowDomain;
  domainStatus: string | null;
  phase: ProductWorkflowPhase;
}): Point38WorkflowSnapshot {
  return {
    schema: "point38_v1",
    phase: input.phase,
    domain: input.domain,
    domain_status: input.domainStatus,
    externally_distributable: isWorkflowExternallyDistributable(input.phase),
    point39_correction_boundary: isPoint39CorrectionPhase(input.phase),
    point54_publication_boundary: false,
  };
}

function allowed(toPhase: ProductWorkflowPhaseWithPublication): WorkflowTransitionResult {
  return { allowed: true, toPhase, blockReason: null };
}

function blocked(reason: string): WorkflowTransitionResult {
  return { allowed: false, toPhase: null, blockReason: reason };
}
