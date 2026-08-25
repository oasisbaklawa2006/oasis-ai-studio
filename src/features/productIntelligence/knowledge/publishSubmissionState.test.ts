import { describe, expect, it } from "vitest";
import { PHASE2A_FIXTURE_CATALOG } from "../runtime/fixtures/phase2aCatalog";
import {
  buildKnowledgePublicationCandidate,
  buildWhatsAppIntelligenceKnowledge,
  type WhatsAppKnowledgePublicationCandidate,
} from "./knowledgeBundle";
import { evaluateHandoffSubmission } from "./publishSubmissionState";

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

describe("evaluateHandoffSubmission retry gates", () => {
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
