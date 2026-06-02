import { describe, expect, it } from "vitest";
import { evaluateProductReadiness } from "./productReadiness";
import type { ProductTruthInput } from "./types";

const completeInput: ProductTruthInput = {
  productName: "Test Product",
  heroImageUrl: "https://example.com/img.jpg",
  hsnCode: "18069090",
  gstRate: "5",
  complianceApproved: true,
  complianceMetaPending: false,
  primaryUom: "kg",
  mainDepartment: "ready_goods_store",
  productionDepartment: "dragees",
  packaging: { piecesPerKg: 40, kgPerTray: 1, traysPerMasterCarton: 8 },
  prices: [{ channel: "retail", priceStatus: "approved", sellingPrice: 100, currency: "INR" }],
};

describe("productReadiness", () => {
  it("incomplete legacy product shows legacy_incomplete without throwing", () => {
    const r = evaluateProductReadiness({
      productName: "Old SKU",
      isLegacy: true,
    });
    expect(r.isLegacy).toBe(true);
    expect(r.readyForCentralSync).toBe(false);
    expect(r.badges).toContain("legacy_incomplete");
    expect(r.score).toBeLessThan(r.maxScore);
  });

  it("complete product passes central sync gate", () => {
    const r = evaluateProductReadiness(completeInput);
    expect(r.readyForCentralSync).toBe(true);
    expect(r.blockers).toHaveLength(0);
    expect(r.score).toBe(r.maxScore);
  });

  it("compliance missing blocks central sync", () => {
    const r = evaluateProductReadiness({
      ...completeInput,
      complianceApproved: false,
      complianceMetaPending: true,
    });
    expect(r.readyForCentralSync).toBe(false);
    expect(r.blockers.some((b) => b.toLowerCase().includes("compliance"))).toBe(true);
  });
});
