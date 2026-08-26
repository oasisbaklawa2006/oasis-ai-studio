import { describe, expect, it } from "vitest";
import { PHASE2A_FIXTURE_CATALOG } from "../runtime/fixtures/phase2aCatalog";
import {
  buildKnowledgePublicationCandidate,
  buildWhatsAppIntelligenceKnowledge,
  type WhatsAppKnowledgePublicationCandidate,
} from "./knowledgeBundle";
import {
  evaluateHandoffSubmission,
  goldenTestsBlocking,
  submissionStateShouldReset,
} from "./publishSubmissionState";

async function handoffReadyCandidate(): Promise<WhatsAppKnowledgePublicationCandidate> {
  const knowledge = buildWhatsAppIntelligenceKnowledge(PHASE2A_FIXTURE_CATALOG, [
    "11111111-1111-4111-8111-111111111111",
  ]);
  return buildKnowledgePublicationCandidate({
    knowledge,
    candidateStatus: "PUBLICATION_CANDIDATE",
    handoffEligibility: "HANDOFF_READY",
    provenanceReason: "immutable_catalogue_versions_resolved",
    sourceSummary: {
      mode: "live_catalogue",
      product_count: Object.keys(knowledge.sku_map).length,
      alias_count: Object.keys(knowledge.aliases).length,
      ambiguous_term_count: knowledge.ambiguous_terms.length,
    },
    goldenSummary: {
      phase2a_passed: 10,
      phase2a_total: 10,
      production_passed: 5,
      production_total: 5,
    },
  });
}

function baseRetryInput(
  candidate: WhatsAppKnowledgePublicationCandidate,
  overrides: Partial<Parameters<typeof evaluateHandoffSubmission>[0]> = {},
) {
  return {
    candidate,
    isFixture: false,
    goldenSummary: candidate.golden_test_summary,
    currentChecksum: candidate.content_checksum,
    submittedChecksum: null,
    isSubmitting: false,
    submissionFailed: true,
    ...overrides,
  };
}

describe("submissionStateShouldReset", () => {
  const identity = (checksum: string, provenance: string[]) =>
    `wa-knowledge-handoff:${checksum}:${[...provenance].sort().join(",")}`;

  it("resets after failed submission when handoff identity changes", () => {
    const checksum = "a".repeat(64);
    expect(
      submissionStateShouldReset({
        priorHandoffIdentity: identity(checksum, ["11111111-1111-4111-8111-111111111111"]),
        nextHandoffIdentity: identity(checksum, ["22222222-2222-4222-8222-222222222222"]),
        submittedChecksum: null,
        candidateChecksum: checksum,
      }),
    ).toBe(true);
  });

  it("resets after failed submission when content checksum changes", () => {
    expect(
      submissionStateShouldReset({
        priorHandoffIdentity: identity("a".repeat(64), ["11111111-1111-4111-8111-111111111111"]),
        nextHandoffIdentity: identity("b".repeat(64), ["11111111-1111-4111-8111-111111111111"]),
        submittedChecksum: null,
        candidateChecksum: "b".repeat(64),
      }),
    ).toBe(true);
  });

  it("does not reset while retrying the same handoff identity after failure", () => {
    const checksum = "a".repeat(64);
    const key = identity(checksum, ["11111111-1111-4111-8111-111111111111"]);
    expect(
      submissionStateShouldReset({
        priorHandoffIdentity: key,
        nextHandoffIdentity: key,
        submittedChecksum: null,
        candidateChecksum: checksum,
      }),
    ).toBe(false);
  });

  it("resets when a prior successful submission identity is stale", () => {
    expect(
      submissionStateShouldReset({
        priorHandoffIdentity: identity("a".repeat(64), ["11111111-1111-4111-8111-111111111111"]),
        nextHandoffIdentity: identity("b".repeat(64), ["11111111-1111-4111-8111-111111111111"]),
        submittedChecksum: "a".repeat(64),
        candidateChecksum: "b".repeat(64),
      }),
    ).toBe(true);
  });

  it("skips reset on initial handoff identity computation", () => {
    expect(
      submissionStateShouldReset({
        priorHandoffIdentity: null,
        nextHandoffIdentity: identity("a".repeat(64), ["11111111-1111-4111-8111-111111111111"]),
        submittedChecksum: null,
        candidateChecksum: "a".repeat(64),
      }),
    ).toBe(false);
  });
});

describe("goldenTestsBlocking", () => {
  it("blocks all-zero golden summaries", () => {
    expect(
      goldenTestsBlocking({
        phase2a_passed: 0,
        phase2a_total: 0,
        production_passed: 0,
        production_total: 0,
      }),
    ).toBe(true);
  });

  it("blocks inconsistent passed counts above totals", () => {
    expect(
      goldenTestsBlocking({
        phase2a_passed: 11,
        phase2a_total: 10,
        production_passed: 5,
        production_total: 5,
      }),
    ).toBe(true);
  });
});

describe("evaluateHandoffSubmission retry gates", () => {
  it("never makes all-zero golden summary retryable after failure", async () => {
    const candidate = await handoffReadyCandidate();
    const evaluation = evaluateHandoffSubmission(
      baseRetryInput(candidate, {
        goldenSummary: {
          phase2a_passed: 0,
          phase2a_total: 0,
          production_passed: 0,
          production_total: 0,
        },
      }),
    );
    expect(evaluation.uiState).toBe("FAILURES_FOUND");
    expect(evaluation.canSubmit).toBe(false);
    expect(evaluation.blockReason).toBe("GOLDEN_FAILURES");
  });

  it("allows retry for valid HANDOFF_READY candidate after transient failure", async () => {
    const candidate = await handoffReadyCandidate();
    const evaluation = evaluateHandoffSubmission(baseRetryInput(candidate));
    expect(evaluation.uiState).toBe("SUBMISSION_FAILED");
    expect(evaluation.canSubmit).toBe(true);
  });

  it("never makes fixture source retryable after failure", async () => {
    const candidate = await handoffReadyCandidate();
    const evaluation = evaluateHandoffSubmission(baseRetryInput(candidate, { isFixture: true }));
    expect(evaluation.uiState).toBe("SUBMISSION_BLOCKED");
    expect(evaluation.canSubmit).toBe(false);
    expect(evaluation.blockReason).toBe("FIXTURE_SOURCE");
  });

  it("never makes TEST_CANDIDATE retryable after failure", async () => {
    const candidate = await buildKnowledgePublicationCandidate({
      knowledge: buildWhatsAppIntelligenceKnowledge(PHASE2A_FIXTURE_CATALOG),
      candidateStatus: "TEST_CANDIDATE",
      handoffEligibility: "NOT_HANDOFF_ELIGIBLE",
      provenanceReason: "fixture",
      sourceSummary: {
        mode: "phase2a_fixture",
        product_count: 1,
        alias_count: 0,
        ambiguous_term_count: 0,
      },
      goldenSummary: {
        phase2a_passed: 10,
        phase2a_total: 10,
        production_passed: 5,
        production_total: 5,
      },
    });
    const evaluation = evaluateHandoffSubmission(baseRetryInput(candidate));
    expect(evaluation.uiState).toBe("SUBMISSION_BLOCKED");
    expect(evaluation.canSubmit).toBe(false);
    expect(evaluation.blockReason).toBe("TEST_CANDIDATE");
  });

  it("never makes golden-failing candidate retryable after failure", async () => {
    const candidate = await handoffReadyCandidate();
    const evaluation = evaluateHandoffSubmission(
      baseRetryInput(candidate, {
        goldenSummary: {
          phase2a_passed: 9,
          phase2a_total: 10,
          production_passed: 5,
          production_total: 5,
        },
      }),
    );
    expect(evaluation.uiState).toBe("FAILURES_FOUND");
    expect(evaluation.canSubmit).toBe(false);
    expect(evaluation.blockReason).toBe("GOLDEN_FAILURES");
  });

  it("never makes NOT_HANDOFF_READY candidate retryable after failure", async () => {
    const candidate = await buildKnowledgePublicationCandidate({
      knowledge: buildWhatsAppIntelligenceKnowledge(PHASE2A_FIXTURE_CATALOG),
      candidateStatus: "PUBLICATION_CANDIDATE",
      handoffEligibility: "NOT_HANDOFF_READY",
      provenanceReason: "missing provenance",
      sourceSummary: {
        mode: "live_catalogue",
        product_count: 1,
        alias_count: 0,
        ambiguous_term_count: 0,
      },
      goldenSummary: {
        phase2a_passed: 10,
        phase2a_total: 10,
        production_passed: 5,
        production_total: 5,
      },
    });
    const evaluation = evaluateHandoffSubmission(baseRetryInput(candidate));
    expect(evaluation.uiState).toBe("SUBMISSION_BLOCKED");
    expect(evaluation.canSubmit).toBe(false);
    expect(evaluation.blockReason).toBe("NOT_HANDOFF_READY");
  });

  it("never makes missing provenance retryable after failure", async () => {
    const candidate = await handoffReadyCandidate();
    candidate.source_catalogue_version_ids = [];
    const evaluation = evaluateHandoffSubmission(baseRetryInput(candidate));
    expect(evaluation.uiState).toBe("SUBMISSION_BLOCKED");
    expect(evaluation.canSubmit).toBe(false);
    expect(evaluation.blockReason).toBe("MISSING_CATALOGUE_PROVENANCE");
  });

  it("never makes stale-checksum candidate retryable after failure", async () => {
    const candidate = await handoffReadyCandidate();
    const evaluation = evaluateHandoffSubmission(
      baseRetryInput(candidate, {
        currentChecksum: "deadbeef".repeat(8),
      }),
    );
    expect(evaluation.uiState).toBe("SUBMISSION_BLOCKED");
    expect(evaluation.canSubmit).toBe(false);
    expect(evaluation.blockReason).toBe("STALE_CANDIDATE");
  });
});
