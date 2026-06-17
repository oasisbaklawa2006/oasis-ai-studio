import { describe, expect, it } from "vitest";
import {
  assessBatch001Cohort,
  BATCH_001_SKUS,
  summarizeBatch001Gaps,
} from "./batch001Assessment";
import {
  buildLanguageTermInventory,
  countLanguageTerms,
} from "./languageTermInventory";
import {
  capabilityReadinessScore,
  evaluateProductLanguageReadiness,
} from "./productLanguageReadiness";
import { buildSnapshotLanguageIntelligence } from "./snapshotLanguage";

describe("product language readiness", () => {
  it("scores 0/5 when no terms present", () => {
    const result = evaluateProductLanguageReadiness({
      official_alias: 0,
      customer_term: 0,
      whatsapp_keyword: 0,
      regional_term: 0,
      legacy_name: 0,
      search_keyword: 0,
      total_aliases: 0,
    });
    expect(result.score).toBe(0);
    expect(result.maxScore).toBe(5);
    expect(result.readyForDiscoverability).toBe(false);
    expect(result.gaps.length).toBeGreaterThan(0);
  });

  it("scores 5/5 when all discoverability dimensions covered", () => {
    const result = evaluateProductLanguageReadiness({
      official_alias: 2,
      customer_term: 1,
      whatsapp_keyword: 3,
      regional_term: 1,
      legacy_name: 0,
      search_keyword: 2,
      total_aliases: 9,
    });
    expect(result.score).toBe(5);
    expect(result.readyForDiscoverability).toBe(true);
  });

  it("computes capability layer score", () => {
    const readiness = evaluateProductLanguageReadiness({
      official_alias: 1,
      customer_term: 0,
      whatsapp_keyword: 0,
      regional_term: 0,
      legacy_name: 0,
      search_keyword: 0,
      total_aliases: 1,
    });
    const cap = capabilityReadinessScore(readiness);
    expect(cap.maxScore).toBe(4);
    expect(cap.percent).toBeGreaterThan(0);
  });
});

describe("language term inventory", () => {
  it("merges DB rows with inferred term types", () => {
    const inventory = buildLanguageTermInventory("prod-1", "Cashew Kitta", [
      { id: "a1", alias_text: "Kaju Kitta", product_id: "prod-1" },
      { id: "a2", alias_text: "old name", product_id: null, canonical_name: "Cashew Kitta", alias_type: "old_name" },
    ]);
    expect(inventory).toHaveLength(2);
    const counts = countLanguageTerms(inventory);
    expect(counts.official_alias).toBe(1);
    expect(counts.legacy_name).toBe(1);
  });
});

describe("snapshot language intelligence", () => {
  it("includes read-only language section when schema unavailable", () => {
    const section = buildSnapshotLanguageIntelligence({
      productId: "prod-1",
      officialName: "Cashew Kitta",
      aliasRows: [{ id: "a1", alias_text: "Kaju Kitta", product_id: "prod-1" }],
    });
    expect(section.schema_available).toBe(false);
    expect(section.official_name).toBe("Cashew Kitta");
    expect(section.language_readiness.score).toBe(0);
    expect(section.discoverability_gaps).toEqual([]);
    expect(section.search_consumption.matches_alias_text).toBe(true);
    expect(section.search_consumption.matches_typed_terms).toBe(false);
  });
});

describe("batch 001 assessment", () => {
  it("covers OAS-AS-BKL-0001 through 0025", () => {
    expect(BATCH_001_SKUS).toHaveLength(25);
    expect(BATCH_001_SKUS[0]).toBe("OAS-AS-BKL-0001");
    expect(BATCH_001_SKUS[24]).toBe("OAS-AS-BKL-0025");
  });

  it("flags language and search gaps for anchor SKU 0001", () => {
    const row = assessBatch001Cohort().find((a) => a.sku === "OAS-AS-BKL-0001");
    expect(row?.official_name).toBe("Cashew Kitta");
    expect(row?.authority_aliases_expected).toBeGreaterThan(0);
    expect(row?.central_status).toBe("no_language_terms");
    expect(row?.language_gaps.some((g) => g.includes("not imported"))).toBe(true);
  });

  it("summarizes cohort-wide expected vocabulary", () => {
    const assessments = assessBatch001Cohort();
    const summary = summarizeBatch001Gaps(assessments);
    expect(summary.sku_count).toBe(25);
    expect(summary.total_aliases_expected).toBeGreaterThan(100);
    expect(summary.total_whatsapp_expected).toBeGreaterThan(100);
  });
});
