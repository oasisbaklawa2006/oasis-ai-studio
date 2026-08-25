import type { WhatsAppKnowledgePublicationCandidate } from "./knowledgeBundle";

export type PublicationSubmissionUiState =
  | "NOT_READY"
  | "TESTING"
  | "FAILURES_FOUND"
  | "HANDOFF_READY"
  | "SUBMITTING"
  | "SUBMITTED_TO_CORE"
  | "SUBMISSION_BLOCKED"
  | "SUBMISSION_FAILED";

export type HandoffBlockReason =
  | "CATALOG_NOT_LOADED"
  | "FIXTURE_SOURCE"
  | "NOT_HANDOFF_READY"
  | "TEST_CANDIDATE"
  | "MISSING_CATALOGUE_PROVENANCE"
  | "MISSING_CHECKSUM"
  | "GOLDEN_FAILURES"
  | "STALE_CANDIDATE"
  | "FORBIDDEN_TRANSACTIONAL_FIELDS";

export type GoldenTestSummary = {
  phase2a_passed: number;
  phase2a_total: number;
  production_passed: number;
  production_total: number;
};

export type EvaluateHandoffInput = {
  candidate: WhatsAppKnowledgePublicationCandidate | null;
  isFixture: boolean;
  goldenSummary: GoldenTestSummary | null;
  currentChecksum: string | null;
  submittedChecksum: string | null;
  isSubmitting: boolean;
  submissionFailed: boolean;
};

export type HandoffEvaluation = {
  uiState: PublicationSubmissionUiState;
  canSubmit: boolean;
  blockReason: HandoffBlockReason | null;
  blockMessage: string | null;
};

export function goldenTestsBlocking(summary: GoldenTestSummary | null): boolean {
  if (!summary) return true;
  return (
    summary.phase2a_total <= 0 ||
    summary.production_total <= 0 ||
    summary.phase2a_passed !== summary.phase2a_total ||
    summary.production_passed !== summary.production_total
  );
}

type BlockingGateContext = {
  candidate: WhatsAppKnowledgePublicationCandidate;
  isFixture: boolean;
  goldenSummary: GoldenTestSummary | null;
  currentChecksum: string;
};

/** Authoritative eligibility gates — must run before any retry-after-failure path. */
function evaluateBlockingGates(ctx: BlockingGateContext): HandoffEvaluation | null {
  const { candidate, isFixture, goldenSummary, currentChecksum } = ctx;

  if (isFixture || candidate.candidate_status === "TEST_CANDIDATE") {
    return {
      uiState: "SUBMISSION_BLOCKED",
      canSubmit: false,
      blockReason: isFixture ? "FIXTURE_SOURCE" : "TEST_CANDIDATE",
      blockMessage: "Fixture and TEST_CANDIDATE sources cannot be submitted to Core.",
    };
  }

  if (goldenTestsBlocking(goldenSummary)) {
    return {
      uiState: "FAILURES_FOUND",
      canSubmit: false,
      blockReason: "GOLDEN_FAILURES",
      blockMessage: "Resolve blocking golden test failures before handoff.",
    };
  }

  if (candidate.handoff_eligibility !== "HANDOFF_READY") {
    return {
      uiState: "SUBMISSION_BLOCKED",
      canSubmit: false,
      blockReason: "NOT_HANDOFF_READY",
      blockMessage: "Candidate is not HANDOFF_READY. Complete catalogue provenance first.",
    };
  }

  if (!candidate.source_catalogue_version_ids.length) {
    return {
      uiState: "SUBMISSION_BLOCKED",
      canSubmit: false,
      blockReason: "MISSING_CATALOGUE_PROVENANCE",
      blockMessage: "Catalogue version provenance is required for Core handoff.",
    };
  }

  if (currentChecksum !== candidate.content_checksum) {
    return {
      uiState: "SUBMISSION_BLOCKED",
      canSubmit: false,
      blockReason: "STALE_CANDIDATE",
      blockMessage: "Checksum is stale relative to the prepared candidate. Wait for regeneration.",
    };
  }

  return null;
}

export function evaluateHandoffSubmission(input: EvaluateHandoffInput): HandoffEvaluation {
  const {
    candidate,
    isFixture,
    goldenSummary,
    currentChecksum,
    submittedChecksum,
    isSubmitting,
    submissionFailed,
  } = input;

  if (!candidate || !currentChecksum) {
    return {
      uiState: "NOT_READY",
      canSubmit: false,
      blockReason: "CATALOG_NOT_LOADED",
      blockMessage: "Catalogue knowledge is still loading.",
    };
  }

  if (isSubmitting) {
    return {
      uiState: "SUBMITTING",
      canSubmit: false,
      blockReason: null,
      blockMessage: null,
    };
  }

  if (
    submittedChecksum &&
    submittedChecksum === currentChecksum &&
    currentChecksum === candidate.content_checksum
  ) {
    return {
      uiState: "SUBMITTED_TO_CORE",
      canSubmit: false,
      blockReason: null,
      blockMessage: null,
    };
  }

  if (submittedChecksum && submittedChecksum !== candidate.content_checksum) {
    return {
      uiState: "SUBMISSION_BLOCKED",
      canSubmit: false,
      blockReason: "STALE_CANDIDATE",
      blockMessage:
        "Knowledge changed after a prior submission identity. Reconcile the new checksum before publishing again.",
    };
  }

  const blocked = evaluateBlockingGates({
    candidate,
    isFixture,
    goldenSummary,
    currentChecksum,
  });
  if (blocked) {
    return blocked;
  }

  if (submissionFailed) {
    return {
      uiState: "SUBMISSION_FAILED",
      canSubmit: true,
      blockReason: null,
      blockMessage: null,
    };
  }

  return {
    uiState: "HANDOFF_READY",
    canSubmit: true,
    blockReason: null,
    blockMessage: null,
  };
}

export function publicationUiLabel(state: PublicationSubmissionUiState): string {
  switch (state) {
    case "NOT_READY":
      return "Preparing knowledge candidate…";
    case "TESTING":
      return "Testing knowledge…";
    case "FAILURES_FOUND":
      return "Submission blocked — resolve test failures";
    case "HANDOFF_READY":
      return "Ready to hand off";
    case "SUBMITTING":
      return "Submitting to Core…";
    case "SUBMITTED_TO_CORE":
      return "Submitted to Core as Draft";
    case "SUBMISSION_BLOCKED":
      return "Submission blocked";
    case "SUBMISSION_FAILED":
      return "Submission failed";
    default:
      return state;
  }
}
