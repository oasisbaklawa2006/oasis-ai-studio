import { describe, expect, it } from "vitest";
import { PHASE2A_FIXTURE_CATALOG } from "../runtime/fixtures/phase2aCatalog";
import { runKnowledgeGoldenCases } from "./goldenHarness";
import {
  buildWhatsAppIntelligenceKnowledge,
  knowledgeContentChecksum,
  previewApprovedKnowledgePublication,
} from "./knowledgeBundle";

describe("WhatsApp intelligence knowledge bundle", () => {
  it("maps catalogue SKUs and aliases without customer transaction history", () => {
    const knowledge = buildWhatsAppIntelligenceKnowledge(PHASE2A_FIXTURE_CATALOG, ["cat-ver-1"]);
    expect(knowledge.schema_version).toBe("wa-knowledge/v1");
    expect(knowledge.sku_map["OAS-AS-BKL-PST-BULK-0017"].name).toMatch(/Bulbul/i);
    expect(knowledge.aliases["pista bulbul"]).toBe("OAS-AS-BKL-PST-BULK-0017");
    expect(knowledge.source_catalogue_version_ids).toEqual(["cat-ver-1"]);
    expect(
      buildWhatsAppIntelligenceKnowledge(PHASE2A_FIXTURE_CATALOG, ["z-ver", "a-ver"])
        .source_catalogue_version_ids,
    ).toEqual(["a-ver", "z-ver"]);
    expect(knowledge).not.toHaveProperty("customers");
    expect(knowledge).not.toHaveProperty("orders");
    expect(JSON.stringify(knowledge)).not.toMatch(/whatsapp_inbound|sales_order/);
  });

  it("pins a stable checksum for Core snapshot provenance", async () => {
    const knowledge = buildWhatsAppIntelligenceKnowledge(PHASE2A_FIXTURE_CATALOG);
    const preview = await previewApprovedKnowledgePublication(knowledge);
    expect(preview.lifecycle).toBe("APPROVED");
    expect(preview.core_activation).toBe("NOT_EXECUTED");
    expect(preview.content_checksum).toBe(await knowledgeContentChecksum(knowledge));
    expect(preview.content_checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it("runs golden utterances and keeps family-level terms unresolved", () => {
    const report = runKnowledgeGoldenCases(PHASE2A_FIXTURE_CATALOG);
    expect(report.total).toBeGreaterThanOrEqual(10);
    expect(report.failed.map((row) => row.utterance)).not.toContain("midya");
    const midya = report.failed.find((row) => row.utterance === "midya");
    expect(midya).toBeUndefined();
  });
});
