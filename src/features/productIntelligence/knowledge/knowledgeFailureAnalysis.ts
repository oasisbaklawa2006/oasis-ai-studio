import type { KnowledgeGoldenFailure } from "./goldenHarness";

export type KnowledgeFailureActionCategory =
  | "ADD_OR_EDIT_ALIAS"
  | "FIX_CANONICAL_NAME"
  | "FIX_FAMILY_OR_VERSION_RELATION"
  | "MARK_AMBIGUOUS"
  | "PACKAGING_SEMANTIC_REVIEW"
  | "NO_CHANGE_EXPECTED_CLARIFICATION";

export type KnowledgeFailureInsight = KnowledgeGoldenFailure & {
  expectedOutcome: string;
  actualOutcome: string;
  candidateSkus: string[];
  failureCategory: string;
  ambiguityReason: string | null;
  suggestedAction: KnowledgeFailureActionCategory;
};

function classifyFailure(failure: KnowledgeGoldenFailure): KnowledgeFailureInsight {
  const reason = failure.reason.toLowerCase();
  let suggestedAction: KnowledgeFailureActionCategory = "ADD_OR_EDIT_ALIAS";
  let failureCategory = "Resolver mismatch";
  let ambiguityReason: string | null = null;

  if (
    failure.clarificationRequired ||
    reason.includes("unresolved") ||
    reason.includes("ambiguous")
  ) {
    suggestedAction = "NO_CHANGE_EXPECTED_CLARIFICATION";
    failureCategory = "Expected clarification";
    ambiguityReason = failure.reason;
  } else if (reason.includes("family")) {
    suggestedAction = "FIX_FAMILY_OR_VERSION_RELATION";
    failureCategory = "Family/version ambiguity";
  } else if (reason.includes("packaging") || reason.includes("pc")) {
    suggestedAction = "PACKAGING_SEMANTIC_REVIEW";
    failureCategory = "Packaging-specific resolution";
  } else if (reason.includes("duplicate") || reason.includes("one of")) {
    suggestedAction = "MARK_AMBIGUOUS";
    failureCategory = "Duplicate canonical ownership";
    ambiguityReason = failure.reason;
  } else if (reason.includes("canonical")) {
    suggestedAction = "FIX_CANONICAL_NAME";
    failureCategory = "Canonical naming drift";
  }

  return {
    ...failure,
    expectedOutcome: failure.reason.startsWith("expected")
      ? failure.reason
      : "Golden expectation not met",
    actualOutcome: failure.resolvedSku
      ? `Resolved to ${failure.resolvedSku}`
      : failure.clarificationRequired
        ? "Clarification required"
        : "Unresolved",
    candidateSkus: failure.resolvedSku ? [failure.resolvedSku] : [],
    failureCategory,
    ambiguityReason,
    suggestedAction,
  };
}

export function analyzeKnowledgeFailures(
  failures: KnowledgeGoldenFailure[],
): KnowledgeFailureInsight[] {
  return failures.map(classifyFailure);
}

export function suggestedActionLabel(action: KnowledgeFailureActionCategory): string {
  switch (action) {
    case "ADD_OR_EDIT_ALIAS":
      return "Add or edit alias";
    case "FIX_CANONICAL_NAME":
      return "Fix canonical name";
    case "FIX_FAMILY_OR_VERSION_RELATION":
      return "Fix family/version relation";
    case "MARK_AMBIGUOUS":
      return "Mark ambiguous";
    case "PACKAGING_SEMANTIC_REVIEW":
      return "Packaging semantic review";
    case "NO_CHANGE_EXPECTED_CLARIFICATION":
      return "No change — expected clarification";
  }
}
