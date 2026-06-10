import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { validateConversionRuleChain } from "@/features/productTruth/uomPackagingEngine";

const ROOT = join(process.cwd());
const previewPath = join(ROOT, "data/packaging/batch001_packaging_update_preview.csv");
const collisionPath = join(ROOT, "data/packaging/batch001_packaging_collision_report.json");

describe("Batch 001 packaging preview artifacts", () => {
  it("preview CSV covers all 25 Batch 001 SKUs", () => {
    const csv = readFileSync(previewPath, "utf8");
    const lines = csv.trim().split("\n").slice(1);
    expect(lines.length).toBe(25);
    for (let i = 1; i <= 25; i++) {
      const sku = `OAS-AS-BKL-${String(i).padStart(4, "0")}`;
      expect(csv).toContain(sku);
    }
  });

  it("collision report flags missing weight for SKU 0025", () => {
    const report = JSON.parse(readFileSync(collisionPath, "utf8"));
    expect(report.missing_weights).toContain("OAS-AS-BKL-0025");
    expect(report.ready).toBe(16);
    expect(report.review).toBe(8);
    expect(report.needs_human).toBe(1);
  });

  it("READY SKUs pass conversion rule chain", () => {
    const csv = readFileSync(previewPath, "utf8");
    const lines = csv.trim().split("\n").slice(1);
    for (const line of lines) {
      const [sku, , readiness, weightStr, , , , gramsStr, pcsKgStr, primaryKgStr] = line.split(",");
      if (readiness !== "READY") continue;
      const grams = Number(gramsStr);
      const pcsKg = Number(pcsKgStr);
      const primaryKg = Number(primaryKgStr);
      const result = validateConversionRuleChain({
        gramsPerPiece: grams,
        piecesPerKg: pcsKg,
        kgPerTray: primaryKg,
      });
      expect(result.valid, `${sku} conversion invalid: ${result.messages.join(", ")}`).toBe(true);
      expect(grams * pcsKg).toBeGreaterThan(990);
      expect(grams * pcsKg).toBeLessThan(1010);
    }
  });
});
