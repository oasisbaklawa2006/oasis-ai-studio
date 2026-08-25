import { describe, it } from "vitest";
import { resolveProductUtterance } from "./resolveProductUtterance";
import { PHASE2A_FIXTURE_CATALOG } from "./fixtures/phase2aCatalog";

const SAMPLES = [
  "pista bulbul",
  "kaju tart",
  "kunafa cheese",
  "frozen kunafa",
  "midya",
  "6 pc midya",
  "dates pista",
  "channa badam",
  "assiyah pista",
  "OAS-AS-BKL-CSH-BULK-0004",
];

describe("phase2a resolver samples", () => {
  it("prints sample outputs", () => {
    for (const query of SAMPLES) {
      const r = resolveProductUtterance(query, PHASE2A_FIXTURE_CATALOG);
      console.log(
        JSON.stringify({
          query,
          resolved_sku: r.resolved_sku,
          resolved_name: r.resolved_name,
          confidence: r.confidence,
          confidence_band: r.confidence_band,
          action: r.action,
          reason: r.reason,
          alternatives: r.alternatives.slice(0, 3).map((a) => ({
            sku: a.sku,
            confidence: a.confidence,
          })),
        }),
      );
    }
  });
});
