import { describe, expect, it } from "vitest";
import { compareDeterministicKeys } from "./deterministicSort";
import {
  runAllKnowledgeGoldenCases,
  runKnowledgeGoldenCases,
  runProductionSnapshotGoldenCases,
} from "./goldenHarness";
import { PRODUCTION_SNAPSHOT_CATALOG } from "../runtime/fixtures/productionSnapshotCatalog";
import { PHASE2A_FIXTURE_CATALOG } from "../runtime/fixtures/phase2aCatalog";
import {
  assertNoTransactionalPayload,
  buildKnowledgePublicationCandidate,
  buildWhatsAppIntelligenceKnowledge,
  canonicalKnowledgePayload,
  knowledgeContentChecksum,
  normalizeKnowledgeTerm,
  toCoreKnowledgeSnapshotDraftInsert,
} from "./knowledgeBundle";

describe("WhatsApp intelligence knowledge bundle", () => {
  it("maps catalogue SKUs and aliases without customer transaction history", () => {
    const knowledge = buildWhatsAppIntelligenceKnowledge(PHASE2A_FIXTURE_CATALOG, ["cat-ver-1"]);
    expect(knowledge.schema_version).toBe("wa-knowledge/v1");
    expect(knowledge.sku_map["OAS-AS-BKL-PST-BULK-0017"].name).toMatch(/Bulbul/i);
    expect(knowledge.aliases["pista bulbul pistachio"]).toBe("OAS-AS-BKL-PST-BULK-0017");
    expect(knowledge.source_catalogue_version_ids).toEqual(["cat-ver-1"]);
    expect(
      buildWhatsAppIntelligenceKnowledge(PHASE2A_FIXTURE_CATALOG, ["z-ver", "a-ver"])
        .source_catalogue_version_ids,
    ).toEqual(["a-ver", "z-ver"]);
    expect(knowledge).not.toHaveProperty("customers");
    expect(knowledge).not.toHaveProperty("orders");
    expect(JSON.stringify(knowledge)).not.toMatch(/whatsapp_inbound|sales_order/);
  });

  it("uses deterministic UTF-16 ordering for non-ASCII checksum keys", () => {
    const composed = "e\u0301clair";
    const precomposed = "éclair";
    expect(compareDeterministicKeys(composed, precomposed)).not.toBe(0);
    expect(compareDeterministicKeys(composed, precomposed)).toBe(
      -compareDeterministicKeys(precomposed, composed),
    );
    const left = buildWhatsAppIntelligenceKnowledge({
      products: [
        {
          id: "p1",
          sku: "OAS-TEST-001",
          name: "éclair",
          product_name: "éclair",
          short_name: null,
          category: null,
          subcategory: null,
        },
      ],
      aliases: [],
    });
    const right = buildWhatsAppIntelligenceKnowledge({
      products: [
        {
          id: "p2",
          sku: "OAS-TEST-002",
          name: "e\u0301clair",
          product_name: "e\u0301clair",
          short_name: null,
          category: null,
          subcategory: null,
        },
      ],
      aliases: [],
    });
    expect(Object.keys(left.terminology)).not.toEqual(Object.keys(right.terminology));
  });

  it("pins a stable checksum regardless of product and alias input order", async () => {
    const knowledge = buildWhatsAppIntelligenceKnowledge(PHASE2A_FIXTURE_CATALOG);
    const reversed = buildWhatsAppIntelligenceKnowledge({
      products: [...PHASE2A_FIXTURE_CATALOG.products].reverse(),
      aliases: [...PHASE2A_FIXTURE_CATALOG.aliases].reverse(),
    });
    const candidate = await buildKnowledgePublicationCandidate({
      knowledge,
      sourceSummary: {
        mode: "phase2a_fixture",
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
    expect(candidate.candidate_status).toBe("PUBLICATION_CANDIDATE");
    expect(candidate.lifecycle).toBe("DRAFT");
    expect(candidate.core_review).toBe("NOT_EXECUTED");
    expect(candidate.core_approval).toBe("NOT_EXECUTED");
    expect(candidate.core_activation).toBe("NOT_EXECUTED");
    expect(candidate.content_checksum).toBe(await knowledgeContentChecksum(knowledge));
    expect(candidate.content_checksum).toBe(await knowledgeContentChecksum(reversed));
    expect(candidate.content_checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it("marks duplicate canonical ownership as ambiguous instead of last-write-wins", () => {
    const knowledge = buildWhatsAppIntelligenceKnowledge(PRODUCTION_SNAPSHOT_CATALOG);
    expect(knowledge.ambiguous_terms).toContain(
      normalizeKnowledgeTerm("Pistachio Bulbul Bulk")!,
    );
    expect(knowledge.ambiguous_terms).toContain(normalizeKnowledgeTerm("Cashew Tart Bulk")!);
    expect(knowledge.terminology[normalizeKnowledgeTerm("Pistachio Bulbul Bulk")!]).toBeUndefined();
    expect(knowledge.sku_map["OAS-AS-BKL-PST-BULK-0017"]).toBeDefined();
    expect(knowledge.sku_map["OAS-AS-BKL-PST-BULK-0017"].packaging_code).toBe("BULK");
    expect(Object.keys(knowledge.packaging)).toContain("BULK");
    expect(JSON.stringify(knowledge.packaging)).not.toMatch(/carton quantity|box conversion|moq|price/);
  });

  it("keeps exact unique SKU resolvable while family terms stay ambiguous in bundle", () => {
    const knowledge = buildWhatsAppIntelligenceKnowledge(PHASE2A_FIXTURE_CATALOG);
    expect(knowledge.terminology["OAS-AS-BKL-PST-BULK-0017"]).toBe("OAS-AS-BKL-PST-BULK-0017");
    expect(knowledge.ambiguous_terms).not.toContain("midya");
  });

  it("serializes into Core draft snapshot contract without fabricated approval fields", async () => {
    const knowledge = buildWhatsAppIntelligenceKnowledge(PHASE2A_FIXTURE_CATALOG, ["11111111-1111-4111-8111-111111111111"]);
    const candidate = await buildKnowledgePublicationCandidate({
      knowledge,
      sourceSummary: {
        mode: "phase2a_fixture",
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
      preparedBy: "author@test.local",
    });
    const draft = toCoreKnowledgeSnapshotDraftInsert(candidate);
    expect(draft.lifecycle).toBe("DRAFT");
    expect(draft.schema_version).toBe("wa-knowledge/v1");
    expect(draft.content_checksum).toHaveLength(64);
    expect(draft.knowledge).toEqual(canonicalKnowledgePayload(knowledge));
    expect(draft).not.toHaveProperty("approved_by");
    expect(draft).not.toHaveProperty("reviewed_by");
    expect(draft).not.toHaveProperty("activated_at");
  });

  it("rejects forbidden transactional payload keys", () => {
    const knowledge = buildWhatsAppIntelligenceKnowledge(PHASE2A_FIXTURE_CATALOG);
    expect(() =>
      assertNoTransactionalPayload({
        ...knowledge,
        orders: [],
      } as typeof knowledge),
    ).toThrow(/KNOWLEDGE_TRANSACTION_FIELD_FORBIDDEN/);
  });

  it("runs phase2a and production-shaped golden corpora without regression", () => {
    const phase2a = runKnowledgeGoldenCases(PHASE2A_FIXTURE_CATALOG);
    const production = runProductionSnapshotGoldenCases(PRODUCTION_SNAPSHOT_CATALOG);
    expect(phase2a.failed).toEqual([]);
    expect(phase2a.passed).toBe(phase2a.total);
    expect(production.failed).toEqual([]);
    expect(production.passed).toBe(production.total);
    const all = runAllKnowledgeGoldenCases();
    expect(all.phase2a.failed).toEqual([]);
    expect(all.production.failed).toEqual([]);
  });
});
