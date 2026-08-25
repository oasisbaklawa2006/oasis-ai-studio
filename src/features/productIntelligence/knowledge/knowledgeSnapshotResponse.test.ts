import { describe, expect, it } from "vitest";
import { PHASE2A_FIXTURE_CATALOG } from "../runtime/fixtures/phase2aCatalog";
import {
  buildKnowledgePublicationCandidate,
  buildWhatsAppIntelligenceKnowledge,
} from "./knowledgeBundle";
import { evaluateHandoffSubmission } from "./publishSubmissionState";
import {
  parseKnowledgeSnapshotResponse,
  type SubmitKnowledgeDraftDeps,
  submitKnowledgeDraftToCore,
} from "./submitKnowledgeDraft";

const EXPECTED_CHECKSUM = "a".repeat(64);

function validDraftPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const knowledge = buildWhatsAppIntelligenceKnowledge(PHASE2A_FIXTURE_CATALOG, [
    "11111111-1111-4111-8111-111111111111",
  ]);
  return {
    id: "ab000000-0000-0000-0000-000000000099",
    schema_version: "wa-knowledge/v1",
    lifecycle: "DRAFT",
    source_catalogue_version_ids: ["11111111-1111-4111-8111-111111111111"],
    knowledge,
    content_checksum: EXPECTED_CHECKSUM,
    created_by: "actor-1",
    created_at: "2026-08-25T00:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    approved_by: null,
    approved_at: null,
    published_at: null,
    activated_at: null,
    superseded_at: null,
    superseded_by: null,
    ...overrides,
  };
}

function expectInvalidResponse(payload: Record<string, unknown>, expectedDetail: string): void {
  try {
    parseKnowledgeSnapshotResponse(payload, EXPECTED_CHECKSUM);
    throw new Error("expected parser to reject response");
  } catch (error) {
    expect(error).toMatchObject({
      classified: {
        code: "INVALID_CORE_RESPONSE",
        message: expect.stringContaining(expectedDetail),
      },
    });
  }
}

describe("parseKnowledgeSnapshotResponse", () => {
  it("rejects missing id", () => {
    const payload = validDraftPayload();
    delete payload.id;
    expectInvalidResponse(payload, "snapshot id");
  });

  it("rejects null id", () => {
    expectInvalidResponse(validDraftPayload({ id: null }), "snapshot id");
  });

  it("rejects missing lifecycle", () => {
    const payload = validDraftPayload();
    delete payload.lifecycle;
    expectInvalidResponse(payload, "lifecycle");
  });

  it("rejects APPROVED lifecycle", () => {
    expectInvalidResponse(validDraftPayload({ lifecycle: "APPROVED" }), "lifecycle must be DRAFT");
  });

  it("rejects ACTIVE lifecycle", () => {
    expectInvalidResponse(validDraftPayload({ lifecycle: "ACTIVE" }), "lifecycle must be DRAFT");
  });

  it("rejects missing content_checksum", () => {
    const payload = validDraftPayload();
    delete payload.content_checksum;
    expectInvalidResponse(payload, "content_checksum");
  });

  it("rejects mismatched content_checksum", () => {
    expectInvalidResponse(
      validDraftPayload({ content_checksum: "b".repeat(64) }),
      "content_checksum does not match submitted candidate",
    );
  });

  it("rejects missing schema_version", () => {
    const payload = validDraftPayload();
    delete payload.schema_version;
    expectInvalidResponse(payload, "schema_version");
  });

  it("rejects malformed source_catalogue_version_ids", () => {
    expectInvalidResponse(
      validDraftPayload({ source_catalogue_version_ids: "not-an-array" }),
      "source_catalogue_version_ids",
    );
    expectInvalidResponse(
      validDraftPayload({ source_catalogue_version_ids: [123] }),
      "source_catalogue_version_ids",
    );
  });

  it("rejects null knowledge", () => {
    expectInvalidResponse(
      validDraftPayload({ knowledge: null }),
      "knowledge must be a JSON object",
    );
  });

  it("rejects array knowledge", () => {
    expectInvalidResponse(validDraftPayload({ knowledge: [] }), "knowledge must be a JSON object");
  });

  it("rejects scalar knowledge", () => {
    expectInvalidResponse(
      validDraftPayload({ knowledge: "not-an-object" }),
      "knowledge must be a JSON object",
    );
  });

  it("rejects missing created_at", () => {
    const payload = validDraftPayload();
    delete payload.created_at;
    expectInvalidResponse(payload, "created_at");
  });

  it("rejects completely empty object", () => {
    expectInvalidResponse({}, "snapshot id");
  });

  it("accepts valid Core DRAFT response", () => {
    const parsed = parseKnowledgeSnapshotResponse(validDraftPayload(), EXPECTED_CHECKSUM);
    expect(parsed.id).toBe("ab000000-0000-0000-0000-000000000099");
    expect(parsed.lifecycle).toBe("DRAFT");
    expect(parsed.content_checksum).toBe(EXPECTED_CHECKSUM);
    expect(parsed.knowledge).toEqual(expect.any(Object));
  });

  it("retains authoritative snapshot id and matching checksum", () => {
    const parsed = parseKnowledgeSnapshotResponse(validDraftPayload(), EXPECTED_CHECKSUM);
    expect(parsed.id).toBe("ab000000-0000-0000-0000-000000000099");
    expect(parsed.content_checksum).toBe(EXPECTED_CHECKSUM);
    expect(parsed.id).not.toBe("undefined");
    expect(parsed.id).not.toBe("null");
  });

  it("never coerces undefined or null into success strings", () => {
    expectInvalidResponse(validDraftPayload({ id: undefined }), "snapshot id");
    expect(() =>
      parseKnowledgeSnapshotResponse(validDraftPayload(), EXPECTED_CHECKSUM),
    ).not.toThrow();
    const parsed = parseKnowledgeSnapshotResponse(validDraftPayload(), EXPECTED_CHECKSUM);
    expect(parsed.id).not.toMatch(/undefined|null/);
  });
});

describe("malformed Core RPC response submission flow", () => {
  it("fails closed and never becomes SUBMITTED_TO_CORE", async () => {
    const candidate = await buildKnowledgePublicationCandidate({
      knowledge: buildWhatsAppIntelligenceKnowledge(PHASE2A_FIXTURE_CATALOG, [
        "11111111-1111-4111-8111-111111111111",
      ]),
      candidateStatus: "PUBLICATION_CANDIDATE",
      handoffEligibility: "HANDOFF_READY",
      provenanceReason: "immutable_catalogue_versions_resolved",
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

    const deps: SubmitKnowledgeDraftDeps = {
      rpc: async () => ({
        data: validDraftPayload({ id: null, lifecycle: "DRAFT" }),
        error: null,
      }),
    };

    await expect(submitKnowledgeDraftToCore(candidate, {}, deps)).rejects.toMatchObject({
      classified: { code: "INVALID_CORE_RESPONSE" },
    });

    const evaluation = evaluateHandoffSubmission({
      candidate,
      isFixture: false,
      goldenSummary: candidate.golden_test_summary,
      currentChecksum: candidate.content_checksum,
      submittedChecksum: null,
      isSubmitting: false,
      submissionFailed: true,
    });
    expect(evaluation.uiState).toBe("SUBMISSION_FAILED");
    expect(evaluation.uiState).not.toBe("SUBMITTED_TO_CORE");
  });
});
