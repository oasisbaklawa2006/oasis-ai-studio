import { describe, expect, it } from "vitest";
import {
  catalogueReadyBlockedMessage,
  evaluateCatalogueReadyGate,
  evaluatePackagingReadiness,
  packagingAuthorityFromRulesResult,
  type PackagingTaxonomyAuthority,
} from "./catalogueReadyGate";
import { resolvePricing } from "./pricingAuthority";

const PACKAGING_AUTHORITY: PackagingTaxonomyAuthority = {
  activeCodes: new Set(["PAPERBOX", "TIN"]),
};

const READY_INPUT = {
  sku: "OAS-AS-BKL-ASS-PAPERBOX-0002",
  saleType: "retail_ready_pack" as const,
  pricing: resolvePricing({ mrp: 450, price_b2b: 380 }),
  packagingCode: "PAPERBOX",
  packagingAuthority: PACKAGING_AUTHORITY,
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
      packagingCode: null,
      heroImageUrl: null,
    });
    expect(result.blockers).toContain("Packaging missing");
    expect(result.blockers).toContain("Hero image missing");
  });

  it("blocks (with a distinct reason) when packaging taxonomy authority hasn't loaded", () => {
    const result = evaluateCatalogueReadyGate({ ...READY_INPUT, packagingAuthority: null });
    expect(result.allowed).toBe(false);
    expect(result.blockers.join(" ")).toContain("taxonomy not loaded");
    expect(result.blockers).not.toContain("Packaging missing");
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

  it("internal products can never be catalogue-ready, regardless of packaging authority state", () => {
    const result = evaluateCatalogueReadyGate({
      ...READY_INPUT,
      saleType: "internal_bom",
      packagingAuthority: null,
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toEqual(["Internal / not-for-sale products cannot be catalogue-ready"]);
  });

  it("packaging_material never requires packaging readiness either", () => {
    const result = evaluateCatalogueReadyGate({
      ...READY_INPUT,
      saleType: "packaging_material",
      packagingAuthority: null,
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toEqual(["Internal / not-for-sale products cannot be catalogue-ready"]);
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
      const after = evaluateCatalogueReadyGate({ ...READY_INPUT, packagingCode: null });
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

  describe("evaluatePackagingReadiness (Defect 1 regression)", () => {
    it("passes for a valid active taxonomy code with an agreeing SKU segment", () => {
      expect(
        evaluatePackagingReadiness({
          packagingCode: "PAPERBOX",
          sku: "OAS-AS-BKL-ASS-PAPERBOX-0002",
          packagingAuthority: PACKAGING_AUTHORITY,
        }),
      ).toBe(true);
    });

    it("blocks a whitespace-only code", () => {
      expect(
        evaluatePackagingReadiness({
          packagingCode: "   ",
          sku: null,
          packagingAuthority: PACKAGING_AUTHORITY,
        }),
      ).toBe(false);
    });

    it("blocks an arbitrary code that isn't in the active taxonomy", () => {
      expect(
        evaluatePackagingReadiness({
          packagingCode: "RANDOM_STRING",
          sku: null,
          packagingAuthority: PACKAGING_AUTHORITY,
        }),
      ).toBe(false);
    });

    it("blocks an inactive/retired code (not present in the active set)", () => {
      const authorityWithoutRetired: PackagingTaxonomyAuthority = { activeCodes: new Set(["TIN"]) };
      expect(
        evaluatePackagingReadiness({
          packagingCode: "PAPERBOX", // was active once, retired — no longer in the set
          sku: null,
          packagingAuthority: authorityWithoutRetired,
        }),
      ).toBe(false);
    });

    it("blocks a valid active code that disagrees with the SKU's own packaging segment", () => {
      expect(
        evaluatePackagingReadiness({
          packagingCode: "TIN",
          sku: "OAS-AS-BKL-ASS-PAPERBOX-0002", // SKU still encodes PAPERBOX — stale relative to TIN
          packagingAuthority: PACKAGING_AUTHORITY,
        }),
      ).toBe(false);
    });

    it("passes on a normalized case-insensitive match", () => {
      expect(
        evaluatePackagingReadiness({
          packagingCode: "paperbox",
          sku: "oas-as-bkl-ass-paperbox-0002",
          packagingAuthority: PACKAGING_AUTHORITY,
        }),
      ).toBe(true);
    });

    it("never silently passes when the taxonomy authority hasn't loaded", () => {
      expect(
        evaluatePackagingReadiness({
          packagingCode: "PAPERBOX",
          sku: "OAS-AS-BKL-ASS-PAPERBOX-0002",
          packagingAuthority: null,
        }),
      ).toBe(false);
    });

    it("blocks when only qty-per-pack-shaped input is passed as the code (not a real taxonomy code)", () => {
      expect(
        evaluatePackagingReadiness({
          packagingCode: "6",
          sku: null,
          packagingAuthority: PACKAGING_AUTHORITY,
        }),
      ).toBe(false);
    });

    it("blocks when a free-text pack description is passed as the code", () => {
      expect(
        evaluatePackagingReadiness({
          packagingCode: "6 pcs box",
          sku: null,
          packagingAuthority: PACKAGING_AUTHORITY,
        }),
      ).toBe(false);
    });

    it("passes when the SKU has no structured packaging segment to cross-check (e.g. draft SKU)", () => {
      expect(
        evaluatePackagingReadiness({
          packagingCode: "PAPERBOX",
          sku: "DRAFT-1234",
          packagingAuthority: PACKAGING_AUTHORITY,
        }),
      ).toBe(true);
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

describe("packagingAuthorityFromRulesResult (Bugbot regression on PR #77)", () => {
  it("builds an active-codes snapshot from a successful load", () => {
    const authority = packagingAuthorityFromRulesResult({
      rules: [
        { code_type: "packaging", code: "paperbox" },
        { code_type: "division", code: "AS" },
        { code_type: "packaging", code: "TIN" },
      ],
      error: null,
    });
    expect(authority).not.toBeNull();
    expect(authority?.activeCodes.has("PAPERBOX")).toBe(true);
    expect(authority?.activeCodes.has("TIN")).toBe(true);
    expect(authority?.activeCodes.has("AS")).toBe(false);
  });

  it("resolves to a genuinely empty (loaded) authority when the table has zero rows and no error", () => {
    const authority = packagingAuthorityFromRulesResult({ rules: [], error: null });
    expect(authority).toEqual({ activeCodes: new Set() });
  });

  it("returns null on a failed load — never a false authoritative empty Set", () => {
    const authority = packagingAuthorityFromRulesResult({
      rules: [],
      error: "sku_code_rules returned zero active rows",
    });
    expect(authority).toBeNull();
  });

  it("returns null even if rules happen to be present alongside an error", () => {
    const authority = packagingAuthorityFromRulesResult({
      rules: [{ code_type: "packaging", code: "TIN" }],
      error: "network error",
    });
    expect(authority).toBeNull();
  });
});
