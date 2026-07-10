import { describe, expect, it } from "vitest";
import { pricingBlockers, resolvePricing, type ChannelPriceLike } from "./pricingAuthority";

describe("resolvePricing", () => {
  it("recognizes product-row MRP and B2B price when no channel rules exist", () => {
    const pricing = resolvePricing({ mrp: "450", price_b2b: 380 });
    expect(pricing.mrp).toBe(450);
    expect(pricing.b2bPrice).toBe(380);
    expect(pricing.source).toBe("product_fields");
    expect(pricing.hasAnyPrice).toBe(true);
  });

  it("prefers approved channel rules over product fields", () => {
    const pricing = resolvePricing(
      { mrp: "450" },
      [{ channel: "retail", mrp: 499, sellingPrice: 499, priceStatus: "approved" }],
    );
    expect(pricing.mrp).toBe(499);
    expect(pricing.source).toBe("mixed");
  });

  it("ignores unapproved channel rules", () => {
    const pricing = resolvePricing({}, [{ channel: "b2b", sellingPrice: 300, priceStatus: "pending_approval" }]);
    expect(pricing.b2bPrice).toBeNull();
    expect(pricing.source).toBe("none");
  });

  it("treats blank/zero/invalid values as missing", () => {
    const pricing = resolvePricing({ mrp: "", price_b2b: 0, export_price: "abc" });
    expect(pricing.hasAnyPrice).toBe(false);
  });

  it("reads b2b_price form key as well as price_b2b db key", () => {
    expect(resolvePricing({ b2b_price: "275" }).b2bPrice).toBe(275);
  });

  describe("deterministic multi-row selection (Defect 3 regression)", () => {
    it("selects the single approved rule when only one exists", () => {
      const pricing = resolvePricing(
        {},
        [{ id: "a", channel: "retail", mrp: 400, priceStatus: "approved", approvedAt: "2026-01-01T00:00:00Z" }],
      );
      expect(pricing.mrp).toBe(400);
      expect(pricing.reviewRequiredChannels).toEqual([]);
    });

    it("with multiple approved rules, deterministically selects the newest by approvedAt", () => {
      const rows: ChannelPriceLike[] = [
        { id: "old", channel: "retail", mrp: 400, priceStatus: "approved", approvedAt: "2026-01-01T00:00:00Z" },
        { id: "new", channel: "retail", mrp: 450, priceStatus: "approved", approvedAt: "2026-06-01T00:00:00Z" },
      ];
      const pricing = resolvePricing({}, rows);
      expect(pricing.mrp).toBe(450);
      // Different values for the same channel — flagged, not silently trusted.
      expect(pricing.reviewRequiredChannels).toEqual(["retail"]);

      // Order-independence: shuffling the input array must not change the selection.
      const shuffled = resolvePricing({}, [...rows].reverse());
      expect(shuffled.mrp).toBe(450);
    });

    it("breaks equal-timestamp ties by the lowest id, independent of input order", () => {
      const rowA: ChannelPriceLike = {
        id: "aaa",
        channel: "retail",
        mrp: 400,
        priceStatus: "approved",
        approvedAt: "2026-01-01T00:00:00Z",
      };
      const rowB: ChannelPriceLike = {
        id: "bbb",
        channel: "retail",
        mrp: 450,
        priceStatus: "approved",
        approvedAt: "2026-01-01T00:00:00Z",
      };
      expect(resolvePricing({}, [rowA, rowB]).mrp).toBe(400);
      expect(resolvePricing({}, [rowB, rowA]).mrp).toBe(400);
    });

    it("does not flag reviewRequiredChannels when disagreeing rows are not both currently valid", () => {
      const at = new Date("2026-06-01T00:00:00Z");
      const rows: ChannelPriceLike[] = [
        { id: "expired", channel: "retail", mrp: 999, priceStatus: "approved", effectiveTo: "2026-01-01T00:00:00Z" },
        { id: "current", channel: "retail", mrp: 450, priceStatus: "approved" },
      ];
      const pricing = resolvePricing({}, rows, at);
      expect(pricing.mrp).toBe(450);
      expect(pricing.reviewRequiredChannels).toEqual([]);
    });

    it("ignores expired rules and falls back to product fields", () => {
      const at = new Date("2026-06-01T00:00:00Z");
      const pricing = resolvePricing(
        { mrp: 300 },
        [{ id: "expired", channel: "retail", mrp: 999, priceStatus: "approved", effectiveTo: "2026-01-01T00:00:00Z" }],
        at,
      );
      expect(pricing.mrp).toBe(300);
      expect(pricing.source).toBe("product_fields");
    });

    it("ignores future (not-yet-effective) rules", () => {
      const at = new Date("2026-01-01T00:00:00Z");
      const pricing = resolvePricing(
        {},
        [{ id: "future", channel: "retail", mrp: 999, priceStatus: "approved", effectiveFrom: "2026-06-01T00:00:00Z" }],
        at,
      );
      expect(pricing.mrp).toBeNull();
    });

    it("treats a zero or negative selected price as invalid", () => {
      const pricing = resolvePricing(
        {},
        [{ id: "a", channel: "retail", mrp: 0, priceStatus: "approved" }],
      );
      expect(pricing.mrp).toBeNull();
    });

    it("keeps different channels independent of each other", () => {
      const pricing = resolvePricing(
        {},
        [
          { id: "r1", channel: "retail", mrp: 450, priceStatus: "approved", approvedAt: "2026-01-01T00:00:00Z" },
          { id: "b1", channel: "b2b", sellingPrice: 380, priceStatus: "approved", approvedAt: "2026-01-01T00:00:00Z" },
          { id: "e1", channel: "export", sellingPrice: 500, priceStatus: "approved", approvedAt: "2026-01-01T00:00:00Z" },
        ],
      );
      expect(pricing.mrp).toBe(450);
      expect(pricing.b2bPrice).toBe(380);
      expect(pricing.exportPrice).toBe(500);
      expect(pricing.reviewRequiredChannels).toEqual([]);
    });
  });
});

describe("pricingBlockers", () => {
  it("ready pack with MRP present has no pricing blockers", () => {
    const pricing = resolvePricing({ mrp: 450 });
    expect(pricingBlockers(pricing, "retail_ready_pack")).toEqual([]);
  });

  it("ready pack without MRP is blocked", () => {
    const pricing = resolvePricing({});
    expect(pricingBlockers(pricing, "retail_ready_pack")).toContain("MRP missing");
  });

  it("B2B enabled ready pack additionally requires B2B price", () => {
    const pricing = resolvePricing({ mrp: 450 });
    expect(pricingBlockers(pricing, "retail_ready_pack", { b2bEnabled: true })).toContain("B2B price missing");
  });

  it("internal products never demand customer-facing prices", () => {
    expect(pricingBlockers(resolvePricing({}), "internal_bom")).toEqual([]);
  });

  it("export price blocks only export sale type", () => {
    const pricing = resolvePricing({ mrp: 450, price_b2b: 380 });
    expect(pricingBlockers(pricing, "export")).toContain("Export price missing");
    expect(pricingBlockers(pricing, "retail_ready_pack")).toEqual([]);
  });

  it("flags a review-required MRP even though a (disputed) value was resolved", () => {
    const rows: ChannelPriceLike[] = [
      { id: "old", channel: "retail", mrp: 400, priceStatus: "approved", approvedAt: "2026-01-01T00:00:00Z" },
      { id: "new", channel: "retail", mrp: 450, priceStatus: "approved", approvedAt: "2026-06-01T00:00:00Z" },
    ];
    const pricing = resolvePricing({}, rows);
    expect(pricing.mrp).toBe(450);
    const blockers = pricingBlockers(pricing, "retail_ready_pack");
    expect(blockers.join(" ")).toContain("MRP needs review");
  });
});
