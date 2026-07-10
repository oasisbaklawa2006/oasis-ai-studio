import { describe, expect, it } from "vitest";
import {
  catalogueReadyBlockedMessage,
  evaluateCatalogueReadyGate,
  hasPackagingTaxonomyCode,
} from "./catalogueReadyGate";
import { resolvePricing } from "./pricingAuthority";

const READY_INPUT = {
  sku: "OAS-AS-BKL-ASS-PAPERBOX-0002",
  saleType: "retail_ready_pack" as const,
  pricing: resolvePricing({ mrp: 450, price_b2b: 380 }),
  packagingPresent: true,
  heroImageUrl: "https://example.com/hero.jpg",
  truthScore: 7,
  truthMaxScore: 8,
};

describe("evaluateCatalogueReadyGate", () => {
  it("allows a fully-ready retail pack", () => {
    const result = evaluateCatalogueReadyGate(READY_INPUT);
    expect(result.allowed).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("blocks invalid SKU with an explicit reason", () => {
    const result = evaluateCatalogueReadyGate({ ...READY_INPUT, sku: "DRAFT-123" });
    expect(result.allowed).toBe(false);
    expect(result.blockers.join(" ")).toContain("SKU invalid");
  });

  it("blocks missing MRP for a sale product", () => {
    const result = evaluateCatalogueReadyGate({ ...READY_INPUT, pricing: resolvePricing({}) });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain("MRP missing");
  });

  it("blocks missing packaging and missing hero image", () => {
    const result = evaluateCatalogueReadyGate({
      ...READY_INPUT,
      packagingPresent: false,
      heroImageUrl: null,
    });
    expect(result.blockers).toContain("Packaging missing");
    expect(result.blockers).toContain("Hero image missing");
  });

  it("blocks Product Truth below the 70% threshold", () => {
    const result = evaluateCatalogueReadyGate({ ...READY_INPUT, truthScore: 5, truthMaxScore: 8 });
    expect(result.allowed).toBe(false);
    expect(result.blockers.join(" ")).toContain("below 70% threshold");
  });

  it("passes through Central preview blockers", () => {
    const result = evaluateCatalogueReadyGate({ ...READY_INPUT, centralBlockers: ["SKU not mapped"] });
    expect(result.blockers).toContain("Central preview: SKU not mapped");
  });

  it("internal products can never be catalogue-ready", () => {
    const result = evaluateCatalogueReadyGate({ ...READY_INPUT, saleType: "internal_bom" });
    expect(result.allowed).toBe(false);
  });

  // ProductEdit.tsx re-evaluates this gate from `form` on every render (useMemo) and an
  // effect auto-clears `is_catalogue_ready` + warns the moment a previously-ready product's
  // evaluation flips to `allowed: false` — these cases prove the gate itself produces that
  // flip for each blocker the audit named (Defect 3 regression coverage).
  describe("a previously-ready product that develops a blocker (Defect 3 regression)", () => {
    it("flips to blocked when MRP is removed", () => {
      const before = evaluateCatalogueReadyGate(READY_INPUT);
      expect(before.allowed).toBe(true);
      const after = evaluateCatalogueReadyGate({ ...READY_INPUT, pricing: resolvePricing({}) });
      expect(after.allowed).toBe(false);
      expect(after.blockers).toContain("MRP missing");
    });

    it("flips to blocked when the SKU becomes invalid", () => {
      const before = evaluateCatalogueReadyGate(READY_INPUT);
      expect(before.allowed).toBe(true);
      const after = evaluateCatalogueReadyGate({ ...READY_INPUT, sku: "DRAFT-999" });
      expect(after.allowed).toBe(false);
      expect(after.blockers.join(" ")).toContain("SKU invalid");
    });

    it("flips to blocked when the hero image is removed", () => {
      const before = evaluateCatalogueReadyGate(READY_INPUT);
      expect(before.allowed).toBe(true);
      const after = evaluateCatalogueReadyGate({ ...READY_INPUT, heroImageUrl: null });
      expect(after.allowed).toBe(false);
      expect(after.blockers).toContain("Hero image missing");
    });

    it("flips to blocked when packaging is cleared", () => {
      const before = evaluateCatalogueReadyGate(READY_INPUT);
      expect(before.allowed).toBe(true);
      const after = evaluateCatalogueReadyGate({ ...READY_INPUT, packagingPresent: false });
      expect(after.allowed).toBe(false);
      expect(after.blockers).toContain("Packaging missing");
    });

    it("flips to blocked when Product Truth drops below the threshold", () => {
      const before = evaluateCatalogueReadyGate(READY_INPUT);
      expect(before.allowed).toBe(true);
      const after = evaluateCatalogueReadyGate({ ...READY_INPUT, truthScore: 4, truthMaxScore: 8 });
      expect(after.allowed).toBe(false);
      expect(after.blockers.join(" ")).toContain("below 70% threshold");
    });
  });

  describe("hasPackagingTaxonomyCode (Defect 5 regression)", () => {
    it("blocks when only qty-per-pack is set, with no packaging_code", () => {
      expect(hasPackagingTaxonomyCode({ pcs_per_pack: 6 })).toBe(false);
    });

    it("blocks when only free-text pack_size is set, with no packaging_code", () => {
      expect(hasPackagingTaxonomyCode({ pack_size: "6 pcs box" })).toBe(false);
    });

    it("blocks when neither is set", () => {
      expect(hasPackagingTaxonomyCode({})).toBe(false);
    });

    it("passes when a real taxonomy packaging_code is set", () => {
      expect(hasPackagingTaxonomyCode({ packaging_code: "PAPERBOX" })).toBe(true);
    });

    it("passes when packaging_code is set alongside qty/pack text", () => {
      expect(hasPackagingTaxonomyCode({ packaging_code: "PAPERBOX", pcs_per_pack: 6, pack_size: "6 pcs box" })).toBe(
        true,
      );
    });
  });

  it("formats the exact blocked message", () => {
    const result = evaluateCatalogueReadyGate({
      ...READY_INPUT,
      pricing: resolvePricing({}),
      heroImageUrl: null,
    });
    const msg = catalogueReadyBlockedMessage(result);
    expect(msg).toMatch(/^Cannot mark catalogue-ready\. Missing: /);
    expect(msg).toContain("MRP missing");
    expect(msg).toContain("Hero image missing");
  });
});
