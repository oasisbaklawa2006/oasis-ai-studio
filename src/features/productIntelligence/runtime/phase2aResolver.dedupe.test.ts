import { describe, expect, it } from "vitest";
import {
  collapseCandidatesByLogicalGroup,
  logicalGroupKey,
  skuSerial,
} from "./candidateGrouping";
import { resolveProductUtterance } from "./resolveProductUtterance";
import { PHASE2A_FIXTURE_CATALOG } from "./fixtures/phase2aCatalog";
import type { RuntimeCatalog } from "./types";

const DUPLICATE_BULBUL_CATALOG: RuntimeCatalog = {
  products: [
    {
      id: "bulbul-dup-13",
      sku: "OAS-AS-BKL-PST-BULK-0013",
      name: "Pistachio Bulbul Bulk",
      product_name: "Pistachio Bulbul Bulk",
      short_name: "Bulbul Pista",
      category: "Baklawa",
      subcategory: "Pistachio",
      is_active: true,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "bulbul-dup-17",
      sku: "OAS-AS-BKL-PST-BULK-0017",
      name: "Pistachio Bulbul Bulk",
      product_name: "Pistachio Bulbul Bulk",
      short_name: "Bulbul Pista",
      category: "Baklawa",
      subcategory: "Pistachio",
      is_active: true,
      created_at: "2025-06-01T00:00:00Z",
      updated_at: "2025-06-15T00:00:00Z",
    },
    ...PHASE2A_FIXTURE_CATALOG.products.filter((p) => p.sku !== "OAS-AS-BKL-PST-BULK-0017"),
  ],
  aliases: [
    {
      alias_text: "bulbul pista",
      canonical_name: "Pistachio Bulbul Bulk",
      product_id: "bulbul-dup-13",
    },
    {
      alias_text: "pista bulbul",
      canonical_name: "Pistachio Bulbul Bulk",
      product_id: "bulbul-dup-13",
    },
    {
      alias_text: "bulbul pista",
      canonical_name: "Pistachio Bulbul Bulk",
      product_id: "bulbul-dup-17",
    },
    {
      alias_text: "pista bulbul",
      canonical_name: "Pistachio Bulbul Bulk",
      product_id: "bulbul-dup-17",
    },
    ...PHASE2A_FIXTURE_CATALOG.aliases.filter((a) => a.product_id !== "bulbul-bulk"),
  ],
};

const INACTIVE_VS_ACTIVE_DUP: RuntimeCatalog = {
  products: [
    {
      id: "dup-old",
      sku: "OAS-AS-BKL-PST-BULK-0013",
      name: "Pistachio Bulbul Bulk",
      product_name: "Pistachio Bulbul Bulk",
      short_name: "Bulbul Pista",
      category: "Baklawa",
      subcategory: "Pistachio",
      is_active: false,
      archived_at: "2025-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "dup-new",
      sku: "OAS-AS-BKL-PST-BULK-0017",
      name: "Pistachio Bulbul Bulk",
      product_name: "Pistachio Bulbul Bulk",
      short_name: "Bulbul Pista",
      category: "Baklawa",
      subcategory: "Pistachio",
      is_active: true,
      updated_at: "2025-06-15T00:00:00Z",
    },
  ],
  aliases: [
    { alias_text: "pista bulbul", canonical_name: "Pistachio Bulbul Bulk", product_id: "dup-old" },
    { alias_text: "pista bulbul", canonical_name: "Pistachio Bulbul Bulk", product_id: "dup-new" },
  ],
};

describe("candidateGrouping", () => {
  it("assigns same logical group key to duplicate bulbul rows", () => {
    const [a, b] = DUPLICATE_BULBUL_CATALOG.products.filter((p) => p.sku.includes("BULK-001"));
    expect(logicalGroupKey(a)).toBe(logicalGroupKey(b));
  });

  it("keeps bulk and gift pack in different logical groups", () => {
    const bulk = PHASE2A_FIXTURE_CATALOG.products.find((p) => p.sku === "OAS-AS-BKL-PST-BULK-0016")!;
    const gift = PHASE2A_FIXTURE_CATALOG.products.find((p) => p.sku === "OAS-AS-BKL-PST-MAAPET-0003")!;
    expect(logicalGroupKey(bulk)).not.toBe(logicalGroupKey(gift));
  });

  it("prefers highest SKU serial as representative", () => {
    const candidates = [
      {
        product_id: "bulbul-dup-13",
        sku: "OAS-AS-BKL-PST-BULK-0013",
        product_name: "Pistachio Bulbul Bulk",
        matched_term: "pista bulbul",
        match_source: "alias",
        confidence: 1,
      },
      {
        product_id: "bulbul-dup-17",
        sku: "OAS-AS-BKL-PST-BULK-0017",
        product_name: "Pistachio Bulbul Bulk",
        matched_term: "pista bulbul",
        match_source: "alias",
        confidence: 1,
      },
    ];
    const { collapsed, collapsedDuplicateCount } = collapseCandidatesByLogicalGroup(
      candidates,
      DUPLICATE_BULBUL_CATALOG,
      "pista bulbul",
    );
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].sku).toBe("OAS-AS-BKL-PST-BULK-0017");
    expect(collapsedDuplicateCount).toBe(1);
    expect(skuSerial("OAS-AS-BKL-PST-BULK-0017")).toBeGreaterThan(skuSerial("OAS-AS-BKL-PST-BULK-0013"));
  });

  it("prefers active product over inactive duplicate", () => {
    const candidates = [
      {
        product_id: "dup-old",
        sku: "OAS-AS-BKL-PST-BULK-0013",
        product_name: "Pistachio Bulbul Bulk",
        matched_term: "pista bulbul",
        match_source: "alias",
        confidence: 1,
      },
      {
        product_id: "dup-new",
        sku: "OAS-AS-BKL-PST-BULK-0017",
        product_name: "Pistachio Bulbul Bulk",
        matched_term: "pista bulbul",
        match_source: "alias",
        confidence: 1,
      },
    ];
    const { collapsed } = collapseCandidatesByLogicalGroup(candidates, INACTIVE_VS_ACTIVE_DUP, "pista bulbul");
    expect(collapsed[0].sku).toBe("OAS-AS-BKL-PST-BULK-0017");
  });
});

describe("resolver dedupe integration", () => {
  it("duplicate bulbul SKUs collapse to HIGH auto_suggest", () => {
    const res = resolveProductUtterance("pista bulbul", DUPLICATE_BULBUL_CATALOG);
    expect(res.confidence_band).toBe("HIGH");
    expect(res.action).toBe("auto_suggest");
    expect(res.resolved_sku).toBe("OAS-AS-BKL-PST-BULK-0017");
    expect(res.resolved_name).toBe("Pistachio Bulbul Bulk");
    expect(res.reason).toMatch(/duplicate catalogue rows collapsed/i);
    expect(res.alternatives.filter((a) => a.product_name === "Pistachio Bulbul Bulk")).toHaveLength(1);
  });

  it("midya bulk vs gift pack remains clarification after dedupe", () => {
    const res = resolveProductUtterance("midya", PHASE2A_FIXTURE_CATALOG);
    expect(res.action).toBe("ask_clarification");
    expect(res.resolved_sku).toBeNull();
    const altSkus = res.alternatives.map((a) => a.sku);
    expect(altSkus).toContain("OAS-AS-BKL-PST-BULK-0016");
    expect(altSkus).toContain("OAS-AS-BKL-PST-MAAPET-0003");
    expect(res.reason).toMatch(/group\(s\) need clarification/i);
  });

  it("6 pc midya resolves gift pack HIGH after dedupe", () => {
    const res = resolveProductUtterance("6 pc midya", PHASE2A_FIXTURE_CATALOG);
    expect(res.confidence_band).toBe("HIGH");
    expect(res.resolved_sku).toBe("OAS-AS-BKL-PST-MAAPET-0003");
  });

  it("duplicate same-name same-pack products do not cause LOW", () => {
    const withoutDedupeWouldBeMany = DUPLICATE_BULBUL_CATALOG.products.filter(
      (p) => p.name === "Pistachio Bulbul Bulk",
    );
    expect(withoutDedupeWouldBeMany.length).toBeGreaterThan(1);

    const res = resolveProductUtterance("pista bulbul", DUPLICATE_BULBUL_CATALOG);
    expect(res.clarification_required).toBe(false);
    expect(res.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("different products with same token remain ambiguous", () => {
    const res = resolveProductUtterance("cashew assiyah", PHASE2A_FIXTURE_CATALOG);
    expect(res.action).toBe("ask_clarification");
    expect(res.resolved_sku).toBeNull();
    expect(res.alternatives.length).toBeGreaterThan(1);
  });
});
