import { describe, expect, it } from "vitest";
import { resolveProductUtterance } from "./resolveProductUtterance";
import { normalizeUtterance } from "./normalizeUtterance";
import { PHASE2A_FIXTURE_CATALOG } from "./fixtures/phase2aCatalog";
import { assignConfidenceBand, actionForBand } from "./confidenceBands";

const catalog = PHASE2A_FIXTURE_CATALOG;

describe("normalizeUtterance", () => {
  it("strips pack quantity noise", () => {
    const n = normalizeUtterance("6 pc midya chahiye");
    expect(n.pack_count).toBe(6);
    expect(n.normalized_text).toContain("midya");
    expect(n.normalized_text).not.toMatch(/\b6\b/);
  });
});

describe("confidenceBands", () => {
  it("maps HIGH to auto_suggest", () => {
    expect(actionForBand("HIGH")).toBe("auto_suggest");
    expect(actionForBand("MEDIUM")).toBe("operator_review");
    expect(actionForBand("LOW")).toBe("ask_clarification");
  });

  it("forces LOW when ambiguous", () => {
    expect(assignConfidenceBand(0.9, true, true, 0.85, 0.72)).toBe("LOW");
  });
});

type Case = {
  utterance: string;
  expectSku?: string | null;
  expectSkuIn?: string[];
  expectClarify?: boolean;
  minBand?: "HIGH" | "MEDIUM" | "LOW";
  expectSkuInAlternatives?: string[];
};

const REQUIRED_CASES: Case[] = [
  { utterance: "pista bulbul", expectSku: "OAS-AS-BKL-PST-BULK-0017", minBand: "HIGH" },
  {
    utterance: "kaju tart",
    expectSkuIn: ["OAS-AS-BKL-0020", "OAS-AS-BKL-CSH-BULK-0004"],
    minBand: "HIGH",
  },
  { utterance: "kunafa cheese", expectSku: "OAS-FR-KNF-KNF-MAAPET-0002", minBand: "HIGH" },
  {
    utterance: "frozen kunafa",
    expectSku: "OAS-FR-KNF-KNF-MAAPET-0002",
    minBand: "MEDIUM",
  },
  {
    utterance: "midya",
    expectSku: null,
    expectClarify: true,
    expectSkuInAlternatives: ["OAS-AS-BKL-PST-BULK-0016", "OAS-AS-BKL-PST-MAAPET-0003"],
  },
  {
    utterance: "6 pc midya",
    expectSku: "OAS-AS-BKL-PST-MAAPET-0003",
    minBand: "HIGH",
  },
  { utterance: "dates pista", expectSku: "OAS-CH-DAT-PST-LOOSE-0002", minBand: "HIGH" },
  { utterance: "channa badam", expectSku: "OAS-FS-FUS-ASS-BULK-0002", minBand: "HIGH" },
  { utterance: "assiyah pista", expectSku: "OAS-AS-BKL-PST-BULK-0015", minBand: "HIGH" },
  { utterance: "OAS-AS-BKL-CSH-BULK-0004", expectSku: "OAS-AS-BKL-CSH-BULK-0004", minBand: "HIGH" },
];

describe("Phase 2A required utterances", () => {
  for (const tc of REQUIRED_CASES) {
    it(`resolves: ${tc.utterance}`, () => {
      const res = resolveProductUtterance(tc.utterance, catalog);
      if (tc.expectClarify) {
        expect(res.clarification_required).toBe(true);
        expect(res.action).toBe("ask_clarification");
        expect(res.resolved_sku).toBeNull();
        if (tc.expectSkuInAlternatives?.length) {
          const altSkus = res.alternatives.map((a) => a.sku);
          for (const sku of tc.expectSkuInAlternatives) {
            expect(altSkus).toContain(sku);
          }
        }
        return;
      }
      if (tc.expectSkuIn?.length) {
        expect(tc.expectSkuIn).toContain(res.resolved_sku);
      } else {
        expect(res.resolved_sku).toBe(tc.expectSku);
      }
      if (tc.minBand === "HIGH") {
        expect(res.confidence_band).toBe("HIGH");
        expect(res.action).toBe("auto_suggest");
      } else if (tc.minBand === "MEDIUM") {
        expect(["HIGH", "MEDIUM"]).toContain(res.confidence_band);
      }
    });
  }
});

const BAKLAWA_CASES: Case[] = [
  { utterance: "mor kaju asiyah", expectSku: "OAS-AS-BKL-0014" },
  { utterance: "tart kaju", expectSku: "OAS-AS-BKL-0020" },
  { utterance: "cashew kitta", expectSku: "OAS-AS-BKL-0001" },
  { utterance: "pistachio pyramid", expectSku: "OAS-AS-BKL-0019" },
  { utterance: "almond tart", expectSku: "OAS-AS-BKL-0022" },
  { utterance: "pistachio tart", expectSku: "OAS-AS-BKL-0023" },
  { utterance: "cashew assiyah", expectSku: null, expectClarify: true },
  { utterance: "pistachio asiyah", expectSku: null, expectClarify: true },
];

describe("baklawa range (batch001 + acceptance)", () => {
  for (const tc of BAKLAWA_CASES) {
    it(`baklawa: ${tc.utterance}`, () => {
      const res = resolveProductUtterance(tc.utterance, catalog);
      if (tc.expectClarify) {
        expect(res.clarification_required).toBe(true);
        return;
      }
      expect(res.resolved_sku).toBe(tc.expectSku);
    });
  }
});

describe("Phase 2A corpus metrics", () => {
  it("meets >=95% unambiguous first-match on corpus", () => {
    const unambiguous = [
      ...REQUIRED_CASES.filter((c) => !c.expectClarify),
      ...BAKLAWA_CASES.filter((c) => !c.expectClarify),
    ];
    let pass = 0;
    for (const tc of unambiguous) {
      const res = resolveProductUtterance(tc.utterance, catalog);
      if (tc.expectSkuIn?.length) {
        if (tc.expectSkuIn.includes(res.resolved_sku ?? "")) pass += 1;
      } else if (res.resolved_sku === tc.expectSku) {
        pass += 1;
      }
    }
    const rate = pass / unambiguous.length;
    expect(rate).toBeGreaterThanOrEqual(0.95);
  });

  it("ambiguous cases never auto-suggest wrongly", () => {
    const ambiguous = [
      ...REQUIRED_CASES.filter((c) => c.expectClarify),
      ...BAKLAWA_CASES.filter((c) => c.expectClarify),
    ];
    for (const tc of ambiguous) {
      const res = resolveProductUtterance(tc.utterance, catalog);
      expect(res.action).not.toBe("auto_suggest");
      expect(res.resolved_sku).toBeNull();
    }
  });
});
