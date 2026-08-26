import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
  publicationUiLabel,
} from "./publishSubmissionState";
import {
  buildKnowledgeSubmissionIdempotencyKey,
  CORE_SUBMIT_KNOWLEDGE_DRAFT_RPC,
  classifyKnowledgeSubmissionError,
  parseKnowledgeSnapshotResponse,
  type SubmitKnowledgeDraftDeps,
  submitKnowledgeDraftToCore,
  toCoreSubmitKnowledgeDraftRpcArgs,
} from "./submitKnowledgeDraft";

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

function mockDeps(impl: SubmitKnowledgeDraftDeps["rpc"]): SubmitKnowledgeDraftDeps {
  return { rpc: impl };
}

describe("publishSubmissionState", () => {
  it("blocks DRAFT/non-ready and TEST_CANDIDATE candidates from submit", async () => {
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
    const evaluation = evaluateHandoffSubmission({
      candidate,
      isFixture: true,
      goldenSummary: candidate.golden_test_summary,
      currentChecksum: candidate.content_checksum,
      submittedChecksum: null,
      isSubmitting: false,
      submissionFailed: false,
    });
    expect(evaluation.canSubmit).toBe(false);
    expect(evaluation.uiState).toBe("SUBMISSION_BLOCKED");
  });

  it("requires golden tests to pass before HANDOFF_READY publish", async () => {
    const candidate = await handoffReadyCandidate();
    const failingGolden = {
      phase2a_passed: 9,
      phase2a_total: 10,
      production_passed: 5,
      production_total: 5,
    };
    expect(goldenTestsBlocking(failingGolden)).toBe(true);
    const evaluation = evaluateHandoffSubmission({
      candidate,
      isFixture: false,
      goldenSummary: failingGolden,
      currentChecksum: candidate.content_checksum,
      submittedChecksum: null,
      isSubmitting: false,
      submissionFailed: false,
    });
    expect(evaluation.uiState).toBe("FAILURES_FOUND");
    expect(evaluation.canSubmit).toBe(false);
  });

  it("marks successful Core DRAFT submission state without implying approval", async () => {
    const candidate = await handoffReadyCandidate();
    const evaluation = evaluateHandoffSubmission({
      candidate,
      isFixture: false,
      goldenSummary: candidate.golden_test_summary,
      currentChecksum: candidate.content_checksum,
      submittedChecksum: candidate.content_checksum,
      isSubmitting: false,
      submissionFailed: false,
    });
    expect(evaluation.uiState).toBe("SUBMITTED_TO_CORE");
    expect(publicationUiLabel(evaluation.uiState)).toBe("Submitted to Core as Draft");
    expect(publicationUiLabel(evaluation.uiState)).not.toMatch(/approved|active|published/i);
  });

  it("blocks stale candidate after knowledge edit from publishing", async () => {
    const candidate = await handoffReadyCandidate();
    const evaluation = evaluateHandoffSubmission({
      candidate,
      isFixture: false,
      goldenSummary: candidate.golden_test_summary,
      currentChecksum: candidate.content_checksum,
      submittedChecksum: "deadbeef".repeat(8),
      isSubmitting: false,
      submissionFailed: false,
    });
    expect(evaluation.uiState).toBe("SUBMISSION_BLOCKED");
    expect(evaluation.blockReason).toBe("STALE_CANDIDATE");
  });
});

describe("submitKnowledgeDraftToCore", () => {
  it("calls canonical Core RPC with exact payload for HANDOFF_READY candidate", async () => {
    const candidate = await handoffReadyCandidate();
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const deps = mockDeps(async (fn, args) => {
      calls.push({ fn, args });
      return {
        data: {
          id: "snap-1",
          schema_version: candidate.schema_version,
          lifecycle: "DRAFT",
          source_catalogue_version_ids: candidate.source_catalogue_version_ids,
          knowledge: candidate.knowledge,
          content_checksum: candidate.content_checksum,
          created_by: "user-1",
          created_at: "2026-08-25T00:00:00.000Z",
          reviewed_by: null,
          reviewed_at: null,
          approved_by: null,
          approved_at: null,
          published_at: null,
          activated_at: null,
          superseded_at: null,
          superseded_by: null,
        },
        error: null,
      };
    });

    const result = await submitKnowledgeDraftToCore(candidate, {}, deps);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.fn).toBe(CORE_SUBMIT_KNOWLEDGE_DRAFT_RPC);
    expect(calls[0]?.args).toEqual(
      toCoreSubmitKnowledgeDraftRpcArgs(candidate, result.idempotencyKey),
    );
    expect(calls[0]?.args.p_content_checksum).toBe(candidate.content_checksum);
    expect(calls[0]?.args.p_source_catalogue_version_ids).toEqual(
      candidate.source_catalogue_version_ids,
    );
    expect(result.snapshot.lifecycle).toBe("DRAFT");
    expect(result.snapshot.id).toBe("snap-1");
  });

  it("reuses the same idempotency key for unchanged candidate retries", async () => {
    const candidate = await handoffReadyCandidate();
    const key = buildKnowledgeSubmissionIdempotencyKey(candidate);
    const retryKey = buildKnowledgeSubmissionIdempotencyKey(candidate);
    expect(key).toBe(retryKey);
    expect(key).toContain(candidate.content_checksum);
  });

  it("changes idempotency key when canonical knowledge checksum changes", async () => {
    const left = await handoffReadyCandidate();
    const knowledge = buildWhatsAppIntelligenceKnowledge(PHASE2A_FIXTURE_CATALOG, [
      "22222222-2222-4222-8222-222222222222",
    ]);
    const right = await buildKnowledgePublicationCandidate({
      knowledge,
      candidateStatus: "PUBLICATION_CANDIDATE",
      handoffEligibility: "HANDOFF_READY",
      provenanceReason: "immutable_catalogue_versions_resolved",
      sourceSummary: left.source_summary,
      goldenSummary: left.golden_test_summary,
    });
    expect(buildKnowledgeSubmissionIdempotencyKey(left)).not.toBe(
      buildKnowledgeSubmissionIdempotencyKey(right),
    );
  });

  it("surfaces 23505 idempotency conflict without pretending success", async () => {
    const candidate = await handoffReadyCandidate();
    const deps = mockDeps(async () => ({
      data: null,
      error: { message: "idempotency key reused with conflicting payload", code: "23505" },
    }));
    await expect(submitKnowledgeDraftToCore(candidate, {}, deps)).rejects.toMatchObject({
      classified: { code: "IDEMPOTENCY_CONFLICT" },
    });
  });

  it("surfaces lifecycle conflict from Core", async () => {
    const candidate = await handoffReadyCandidate();
    const deps = mockDeps(async () => ({
      data: null,
      error: {
        message: "knowledge snapshot lifecycle conflict for checksum replay: ACTIVE",
        code: "55000",
      },
    }));
    await expect(submitKnowledgeDraftToCore(candidate, {}, deps)).rejects.toMatchObject({
      classified: { code: "LIFECYCLE_CONFLICT" },
    });
  });

  it("surfaces checksum validation failure", () => {
    const classified = classifyKnowledgeSubmissionError({
      message: "content_checksum does not match canonical knowledge payload",
      code: "22023",
    });
    expect(classified.code).toBe("CHECKSUM_MISMATCH");
  });

  it("surfaces catalogue provenance rejection", () => {
    const classified = classifyKnowledgeSubmissionError({
      message: "catalogue version provenance cannot contain NULL",
      code: "22023",
    });
    expect(classified.code).toBe("CATALOGUE_PROVENANCE_INVALID");
  });

  it("fails closed for authentication and authorization errors", () => {
    expect(
      classifyKnowledgeSubmissionError({ message: "authentication required", code: "42501" }).code,
    ).toBe("AUTHENTICATION_REQUIRED");
    expect(
      classifyKnowledgeSubmissionError({
        message: "team member authority required for knowledge handoff submission",
        code: "42501",
      }).code,
    ).toBe("NOT_AUTHORIZED");
  });

  it("does not treat RPC/network failure as success", async () => {
    const candidate = await handoffReadyCandidate();
    const deps = mockDeps(async () => ({
      data: null,
      error: { message: "Failed to fetch", code: "PGRST000" },
    }));
    await expect(submitKnowledgeDraftToCore(candidate, {}, deps)).rejects.toMatchObject({
      classified: { code: "NETWORK_OR_RPC_FAILURE" },
    });
  });

  it("retains authoritative snapshot identifier from Core response", async () => {
    const candidate = await handoffReadyCandidate();
    const deps = mockDeps(async () => ({
      data: {
        id: "ab000000-0000-0000-0000-000000000099",
        schema_version: "wa-knowledge/v1",
        lifecycle: "DRAFT",
        source_catalogue_version_ids: candidate.source_catalogue_version_ids,
        knowledge: candidate.knowledge,
        content_checksum: candidate.content_checksum,
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
      },
      error: null,
    }));
    const result = await submitKnowledgeDraftToCore(candidate, {}, deps);
    expect(result.snapshot.id).toBe("ab000000-0000-0000-0000-000000000099");
    expect(
      parseKnowledgeSnapshotResponse(
        result.snapshot as unknown as Record<string, unknown>,
        candidate.content_checksum,
      ).id,
    ).toBe("ab000000-0000-0000-0000-000000000099");
  });

  it("reuses explicit idempotency key on timeout retry", async () => {
    const candidate = await handoffReadyCandidate();
    const idempotencyKey = buildKnowledgeSubmissionIdempotencyKey(candidate);
    const calls: string[] = [];
    const deps = mockDeps(async (_fn, args) => {
      calls.push(String(args.p_idempotency_key));
      if (calls.length === 1) {
        return { data: null, error: { message: "Failed to fetch", code: "PGRST000" } };
      }
      return {
        data: {
          id: "snap-retry",
          schema_version: candidate.schema_version,
          lifecycle: "DRAFT",
          source_catalogue_version_ids: candidate.source_catalogue_version_ids,
          knowledge: candidate.knowledge,
          content_checksum: candidate.content_checksum,
          created_by: "user-1",
          created_at: "2026-08-25T00:00:00.000Z",
          reviewed_by: null,
          reviewed_at: null,
          approved_by: null,
          approved_at: null,
          published_at: null,
          activated_at: null,
          superseded_at: null,
          superseded_by: null,
        },
        error: null,
      };
    });

    await expect(
      submitKnowledgeDraftToCore(candidate, { idempotencyKey }, deps),
    ).rejects.toMatchObject({
      classified: { code: "NETWORK_OR_RPC_FAILURE" },
    });
    const result = await submitKnowledgeDraftToCore(candidate, { idempotencyKey }, deps);
    expect(calls).toEqual([idempotencyKey, idempotencyKey]);
    expect(result.snapshot.id).toBe("snap-retry");
  });

  it("rejects TEST_CANDIDATE before RPC", async () => {
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
    const deps = mockDeps(async () => ({ data: {}, error: null }));
    await expect(submitKnowledgeDraftToCore(candidate, {}, deps)).rejects.toMatchObject({
      classified: { code: "CANDIDATE_NOT_HANDOFF_READY" },
    });
  });
});

describe("knowledge bridge security boundaries", () => {
  const featureDir = dirname(fileURLToPath(import.meta.url));

  it("uses only the governed Core RPC name for submission", () => {
    expect(CORE_SUBMIT_KNOWLEDGE_DRAFT_RPC).toBe("whatsapp_submit_intelligence_knowledge_draft");
  });

  it("does not reference service_role or activation RPCs in bridge modules", () => {
    const bridgeSource = readFileSync(join(featureDir, "submitKnowledgeDraft.ts"), "utf8");
    const stateSource = readFileSync(join(featureDir, "publishSubmissionState.ts"), "utf8");
    const combined = `${bridgeSource}\n${stateSource}`;
    expect(combined).not.toMatch(/service_role|SERVICE_ROLE/);
    expect(combined).not.toMatch(/whatsapp_activate_intelligence_knowledge_snapshot/);
    expect(combined).not.toMatch(/whatsapp_approve_intelligence_knowledge_snapshot/);
    expect(combined).not.toMatch(/\.from\(['"]whatsapp_intelligence_knowledge_snapshots['"]\)/);
    expect(combined).not.toMatch(/\.from\(['"]whatsapp_intelligence_knowledge_submissions['"]\)/);
  });
});
