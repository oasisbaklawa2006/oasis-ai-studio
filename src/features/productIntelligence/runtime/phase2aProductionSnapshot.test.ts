import { describe, expect, it } from "vitest";
import { resolveProductUtterance } from "./resolveProductUtterance";
import { PRODUCTION_SNAPSHOT_CATALOG } from "./fixtures/productionSnapshotCatalog";

const catalog = PRODUCTION_SNAPSHOT_CATALOG;

describe("production snapshot resolver verification", () => {
  it("pista bulbul → HIGH Pistachio Bulbul Bulk (deduped duplicates)", () => {
    const r = resolveProductUtterance("pista bulbul", catalog);
    expect(r.confidence_band).toBe("HIGH");
    expect(r.action).toBe("auto_suggest");
    expect(r.resolved_sku).toBe("OAS-AS-BKL-PST-BULK-0017");
    expect(r.resolved_name).toBe("Pistachio Bulbul Bulk");
  });

  it("midya → LOW with bulk + gift alternatives", () => {
    const r = resolveProductUtterance("midya", catalog);
    expect(r.action).toBe("ask_clarification");
    expect(r.resolved_sku).toBeNull();
    const skus = r.alternatives.map((a) => a.sku);
    expect(skus).toContain("OAS-AS-BKL-PST-BULK-0016");
    expect(skus).toContain("OAS-AS-BKL-PST-MAAPET-0003");
  });

  it("6 pc midya → HIGH gift pack", () => {
    const r = resolveProductUtterance("6 pc midya", catalog);
    expect(r.confidence_band).toBe("HIGH");
    expect(r.resolved_sku).toBe("OAS-AS-BKL-PST-MAAPET-0003");
  });

  it("kaju tart → HIGH Cashew Tart Bulk", () => {
    const r = resolveProductUtterance("kaju tart", catalog);
    expect(r.confidence_band).toBe("HIGH");
    expect(r.resolved_sku).toBe("OAS-AS-BKL-CSH-BULK-0004");
  });

  it("frozen kunafa → HIGH or MEDIUM frozen product", () => {
    const r = resolveProductUtterance("frozen kunafa", catalog);
    expect(["HIGH", "MEDIUM"]).toContain(r.confidence_band);
    expect(r.resolved_name).toContain("Frozen");
  });
});
