import { resolveProductUtterance } from "../runtime/resolveProductUtterance";
import type { RuntimeCatalog } from "../runtime/types";

export type KnowledgeGoldenCase = {
  utterance: string;
  expectSku?: string | null;
  expectSkuIn?: string[];
  expectClarify?: boolean;
};

export const KNOWLEDGE_GOLDEN_CASES: KnowledgeGoldenCase[] = [
  { utterance: "pista bulbul", expectSku: "OAS-AS-BKL-PST-BULK-0017" },
  { utterance: "kaju tart", expectSkuIn: ["OAS-AS-BKL-0020", "OAS-AS-BKL-CSH-BULK-0004"] },
  { utterance: "kunafa cheese", expectSku: "OAS-FR-KNF-KNF-MAAPET-0002" },
  { utterance: "frozen kunafa", expectSku: "OAS-FR-KNF-KNF-MAAPET-0002" },
  {
    utterance: "midya",
    expectSku: null,
    expectClarify: true,
  },
  { utterance: "6 pc midya", expectSku: "OAS-AS-BKL-PST-MAAPET-0003" },
  { utterance: "dates pista", expectSku: "OAS-CH-DAT-PST-LOOSE-0002" },
  { utterance: "channa badam", expectSku: "OAS-FS-FUS-ASS-BULK-0002" },
  { utterance: "assiyah pista", expectSku: "OAS-AS-BKL-PST-BULK-0015" },
  { utterance: "OAS-AS-BKL-CSH-BULK-0004", expectSku: "OAS-AS-BKL-CSH-BULK-0004" },
];

export type KnowledgeGoldenFailure = {
  utterance: string;
  resolvedSku: string | null;
  clarificationRequired: boolean;
  reason: string;
};

export type KnowledgeGoldenReport = {
  total: number;
  passed: number;
  failed: KnowledgeGoldenFailure[];
};

export function runKnowledgeGoldenCases(catalog: RuntimeCatalog): KnowledgeGoldenReport {
  const failed: KnowledgeGoldenFailure[] = [];
  for (const testCase of KNOWLEDGE_GOLDEN_CASES) {
    const result = resolveProductUtterance(testCase.utterance, catalog);
    if (testCase.expectClarify) {
      if (!result.clarification_required || result.resolved_sku !== null) {
        failed.push({
          utterance: testCase.utterance,
          resolvedSku: result.resolved_sku,
          clarificationRequired: result.clarification_required,
          reason: "family-level or ambiguous term must remain unresolved",
        });
      }
      continue;
    }
    if (testCase.expectSku && result.resolved_sku !== testCase.expectSku) {
      failed.push({
        utterance: testCase.utterance,
        resolvedSku: result.resolved_sku,
        clarificationRequired: result.clarification_required,
        reason: `expected ${testCase.expectSku}`,
      });
    }
    if (testCase.expectSkuIn && (!result.resolved_sku || !testCase.expectSkuIn.includes(result.resolved_sku))) {
      failed.push({
        utterance: testCase.utterance,
        resolvedSku: result.resolved_sku,
        clarificationRequired: result.clarification_required,
        reason: `expected one of ${testCase.expectSkuIn.join(", ")}`,
      });
    }
  }
  return {
    total: KNOWLEDGE_GOLDEN_CASES.length,
    passed: KNOWLEDGE_GOLDEN_CASES.length - failed.length,
    failed,
  };
}
