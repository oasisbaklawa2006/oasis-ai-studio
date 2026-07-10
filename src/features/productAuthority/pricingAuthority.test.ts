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

  it("prefers an approved mrp-channel rule over the product-field fallback", () => {
    const pricing = resolvePricing(
      { mrp: "450" },
      [{ channel: "mrp", mrp: 499, sellingPrice: null, priceStatus: "approved" }],
    );
    expect(pricing.mrp).toBe(499);
    expect(pricing.source).toBe("mixed");
  });

  it("uses positive products.mrp when no approved mrp-channel rule exists", () => {
    const pricing = resolvePricing({ mrp: 450 }, [{ channel: "b2b", sellingPrice: 300, priceStatus: "approved" }]);
    expect(pricing.mrp).toBe(450);
    expect(pricing.source).toBe("mixed");
  });

  it("does not silently redefine a retail-channel selling-price rule as MRP", () => {
    // "retail" and "mrp" are distinct channels — an approved retail-channel rule must never
    // be treated as the MRP authority (the pre-fix defect).
    const pricing = resolvePricing(
      {},
      [{ channel: "retail", sellingPrice: 1000, priceStatus: "approved" }],
    );
    expect(pricing.mrp).toBeNull();
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
        [{ id: "a", channel: "mrp", mrp: 400, priceStatus: "approved", approvedAt: "2026-01-01T00:00:00Z" }],
      );
      expect(pricing.mrp).toBe(400);
      expect(pricing.reviewRequiredChannels).toEqual([]);
    });

    it("with multiple approved rules, deterministically selects the newest by approvedAt", () => {
      const rows: ChannelPriceLike[] = [
        { id: "old", channel: "mrp", mrp: 400, priceStatus: "approved", approvedAt: "2026-01-01T00:00:00Z" },
        { id: "new", channel: "mrp", mrp: 450, priceStatus: "approved", approvedAt: "2026-06-01T00:00:00Z" },
      ];
      const pricing = resolvePricing({}, rows);
      expect(pricing.mrp).toBe(450);
      // Different values for the same channel — flagged, not silently trusted.
      expect(pricing.reviewRequiredChannels).toEqual(["mrp"]);

      // Order-independence: shuffling the input array must not change the selection.
      const shuffled = resolvePricing({}, [...rows].reverse());
      expect(shuffled.mrp).toBe(450);
    });

    it("breaks equal-timestamp ties by the lowest id, independent of input order", () => {
      const rowA: ChannelPriceLike = {
        id: "aaa",
        channel: "mrp",
        mrp: 400,
        priceStatus: "approved",
        approvedAt: "2026-01-01T00:00:00Z",
      };
      const rowB: ChannelPriceLike = {
        id: "bbb",
        channel: "mrp",
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
        { id: "expired", channel: "mrp", mrp: 999, priceStatus: "approved", effectiveTo: "2026-01-01T00:00:00Z" },
        { id: "current", channel: "mrp", mrp: 450, priceStatus: "approved" },
      ];
      const pricing = resolvePricing({}, rows, at);
      expect(pricing.mrp).toBe(450);
      expect(pricing.reviewRequiredChannels).toEqual([]);
    });

    it("ignores expired rules and falls back to product fields", () => {
      const at = new Date("2026-06-01T00:00:00Z");
      const pricing = resolvePricing(
        { mrp: 300 },
        [{ id: "expired", channel: "mrp", mrp: 999, priceStatus: "approved", effectiveTo: "2026-01-01T00:00:00Z" }],
        at,
      );
      expect(pricing.mrp).toBe(300);
      expect(pricing.source).toBe("product_fields");
    });

    it("ignores future (not-yet-effective) rules — readiness must not treat them as satisfied", () => {
      const at = new Date("2026-01-01T00:00:00Z");
      const pricing = resolvePricing(
        {},
        [{ id: "future", channel: "mrp", mrp: 999, priceStatus: "approved", effectiveFrom: "2026-06-01T00:00:00Z" }],
        at,
      );
      expect(pricing.mrp).toBeNull();
    });

    it("treats a zero or negative selected mrp-channel price as unusable", () => {
      const pricing = resolvePricing(
        {},
        [{ id: "a", channel: "mrp", mrp: 0, priceStatus: "approved" }],
      );
      expect(pricing.mrp).toBeNull();
    });

    it("keeps different channels independent of each other — b2b/export selection is unchanged by the MRP fix", () => {
      const pricing = resolvePricing(
        {},
        [
          { id: "r1", channel: "mrp", mrp: 450, priceStatus: "approved", approvedAt: "2026-01-01T00:00:00Z" },
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

  describe("mrp-channel-rule vs products.mrp field conflict diagnostic", () => {
    it("flags review-required when the approved mrp-channel rule disagrees with a positive products.mrp field", () => {
      // OAS-AS-BKL-0007 production case: approved mrp-channel rule = 25, products.mrp = 40.
      const pricing = resolvePricing(
        { mrp: 40 },
        [{ id: "a", channel: "mrp", mrp: 25, priceStatus: "approved" }],
      );
      // The channel rule remains authoritative (product_pricing_rules is the declared write
      // authority) — the conflict does not silently pass.
      expect(pricing.mrp).toBe(25);
      expect(pricing.reviewRequiredChannels).toEqual(["mrp"]);
      expect(pricingBlockers(pricing, "retail_ready_pack").join(" ")).toContain("MRP needs review");
    });

    it("does not flag review-required when the mrp-channel rule and products.mrp agree", () => {
      const pricing = resolvePricing(
        { mrp: 750 },
        [{ id: "a", channel: "mrp", mrp: 750, priceStatus: "approved" }],
      );
      expect(pricing.mrp).toBe(750);
      expect(pricing.reviewRequiredChannels).toEqual([]);
    });

    it("does not flag review-required when there is no channel rule to disagree with a field value", () => {
      const pricing = resolvePricing({ mrp: 40 }, []);
      expect(pricing.mrp).toBe(40);
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
      { id: "old", channel: "mrp", mrp: 400, priceStatus: "approved", approvedAt: "2026-01-01T00:00:00Z" },
      { id: "new", channel: "mrp", mrp: 450, priceStatus: "approved", approvedAt: "2026-06-01T00:00:00Z" },
    ];
    const pricing = resolvePricing({}, rows);
    expect(pricing.mrp).toBe(450);
    const blockers = pricingBlockers(pricing, "retail_ready_pack");
    expect(blockers.join(" ")).toContain("MRP needs review");
  });
});

describe("production-evidence fixtures (POST-R1A pricing-authority recovery)", () => {
  it("ASS-RBOX-0002 fixture resolves ₹750 MRP from the approved mrp-channel rule", () => {
    const pricing = resolvePricing(
      { mrp: null },
      [{ id: "rbox-mrp", channel: "mrp", mrp: 750, priceStatus: "approved", approvedAt: "2026-07-09T21:58:17Z" }],
    );
    expect(pricing.mrp).toBe(750);
    expect(pricingBlockers(pricing, "retail_ready_pack")).not.toContain("MRP missing");
  });

  it("PST-RBOX-0001 fixture resolves ₹350 MRP from the approved mrp-channel rule", () => {
    const pricing = resolvePricing(
      { mrp: null },
      [{ id: "pst-rbox-mrp", channel: "mrp", mrp: 350, priceStatus: "approved" }],
    );
    expect(pricing.mrp).toBe(350);
    expect(pricingBlockers(pricing, "retail_ready_pack")).not.toContain("MRP missing");
  });

  it("OAS-AS-BKL-0007 fixture surfaces the ₹25-vs-₹40 disagreement as review-required, not a silent pick", () => {
    const pricing = resolvePricing(
      { mrp: 40 },
      [{ id: "0007-mrp", channel: "mrp", mrp: 25, priceStatus: "approved" }],
    );
    expect(pricing.mrp).toBe(25);
    expect(pricing.reviewRequiredChannels).toContain("mrp");
  });
});

describe("review-required compares effective price, not raw fields (Bugbot regression)", () => {
  it("mrp channel with only mrp set on both rows — same effective price, no false positive", () => {
    const rows: ChannelPriceLike[] = [
      { id: "a", channel: "mrp", mrp: 450, priceStatus: "approved", approvedAt: "2026-01-01T00:00:00Z" },
      { id: "b", channel: "mrp", mrp: 450, priceStatus: "approved", approvedAt: "2026-01-02T00:00:00Z" },
    ];
    const pricing = resolvePricing({}, rows);
    expect(pricing.mrp).toBe(450);
    expect(pricing.reviewRequiredChannels).toEqual([]);
  });

  it("mrp channel with only sellingPrice set on both rows — same effective price, no false positive", () => {
    const rows: ChannelPriceLike[] = [
      { id: "a", channel: "mrp", sellingPrice: 450, priceStatus: "approved", approvedAt: "2026-01-01T00:00:00Z" },
      { id: "b", channel: "mrp", sellingPrice: 450, priceStatus: "approved", approvedAt: "2026-01-02T00:00:00Z" },
    ];
    const pricing = resolvePricing({}, rows);
    expect(pricing.mrp).toBe(450);
    expect(pricing.reviewRequiredChannels).toEqual([]);
  });

  it("mrp channel with both mrp and sellingPrice set — mrp wins per resolvePricing()'s own precedence", () => {
    const pricing = resolvePricing(
      {},
      [{ id: "a", channel: "mrp", mrp: 450, sellingPrice: 300, priceStatus: "approved" }],
    );
    expect(pricing.mrp).toBe(450);
  });

  it("mrp channel: same effective price stored in different fields must NOT be flagged (the exact Bugbot scenario)", () => {
    // Row A: mrp=500 wins (sellingPrice ignored). Row B: mrp is null, so sellingPrice=500
    // wins. Both resolve to the same effective price 500 — comparing raw fields would see
    // mrp differ (500 vs null) and wrongly flag this as disagreeing.
    const rows: ChannelPriceLike[] = [
      { id: "a", channel: "mrp", mrp: 500, sellingPrice: null, priceStatus: "approved", approvedAt: "2026-01-01T00:00:00Z" },
      { id: "b", channel: "mrp", mrp: null, sellingPrice: 500, priceStatus: "approved", approvedAt: "2026-01-02T00:00:00Z" },
    ];
    const pricing = resolvePricing({}, rows);
    expect(pricing.mrp).toBe(500);
    expect(pricing.reviewRequiredChannels).toEqual([]);
  });

  it("mrp channel: a genuinely different effective price is still flagged as changed", () => {
    const rows: ChannelPriceLike[] = [
      { id: "a", channel: "mrp", mrp: 500, priceStatus: "approved", approvedAt: "2026-01-01T00:00:00Z" },
      { id: "b", channel: "mrp", mrp: 550, priceStatus: "approved", approvedAt: "2026-01-02T00:00:00Z" },
    ];
    const pricing = resolvePricing({}, rows);
    expect(pricing.mrp).toBe(550);
    expect(pricing.reviewRequiredChannels).toEqual(["mrp"]);
  });

  it("b2b: identical sellingPrice across rows is not flagged", () => {
    const rows: ChannelPriceLike[] = [
      { id: "a", channel: "b2b", sellingPrice: 380, priceStatus: "approved", approvedAt: "2026-01-01T00:00:00Z" },
      { id: "b", channel: "b2b", sellingPrice: 380, priceStatus: "approved", approvedAt: "2026-01-02T00:00:00Z" },
    ];
    const pricing = resolvePricing({}, rows);
    expect(pricing.b2bPrice).toBe(380);
    expect(pricing.reviewRequiredChannels).toEqual([]);
  });

  it("b2b: differing sellingPrice across rows is flagged", () => {
    const rows: ChannelPriceLike[] = [
      { id: "a", channel: "b2b", sellingPrice: 380, priceStatus: "approved", approvedAt: "2026-01-01T00:00:00Z" },
      { id: "b", channel: "b2b", sellingPrice: 400, priceStatus: "approved", approvedAt: "2026-01-02T00:00:00Z" },
    ];
    const pricing = resolvePricing({}, rows);
    expect(pricing.b2bPrice).toBe(400);
    expect(pricing.reviewRequiredChannels).toEqual(["b2b"]);
  });

  it("export: identical sellingPrice across rows is not flagged", () => {
    const rows: ChannelPriceLike[] = [
      { id: "a", channel: "export", sellingPrice: 20, priceStatus: "approved", approvedAt: "2026-01-01T00:00:00Z" },
      { id: "b", channel: "export", sellingPrice: 20, priceStatus: "approved", approvedAt: "2026-01-02T00:00:00Z" },
    ];
    const pricing = resolvePricing({}, rows);
    expect(pricing.exportPrice).toBe(20);
    expect(pricing.reviewRequiredChannels).toEqual([]);
  });

  it("export: differing sellingPrice across rows is flagged", () => {
    const rows: ChannelPriceLike[] = [
      { id: "a", channel: "export", sellingPrice: 20, priceStatus: "approved", approvedAt: "2026-01-01T00:00:00Z" },
      { id: "b", channel: "export", sellingPrice: 25, priceStatus: "approved", approvedAt: "2026-01-02T00:00:00Z" },
    ];
    const pricing = resolvePricing({}, rows);
    expect(pricing.exportPrice).toBe(25);
    expect(pricing.reviewRequiredChannels).toEqual(["export"]);
  });

  it("export: an mrp field difference is irrelevant to export's sellingPrice-only precedence", () => {
    // export never reads .mrp at all — a difference there must not trigger review-required.
    const rows: ChannelPriceLike[] = [
      { id: "a", channel: "export", mrp: 999, sellingPrice: 20, priceStatus: "approved", approvedAt: "2026-01-01T00:00:00Z" },
      { id: "b", channel: "export", mrp: 111, sellingPrice: 20, priceStatus: "approved", approvedAt: "2026-01-02T00:00:00Z" },
    ];
    const pricing = resolvePricing({}, rows);
    expect(pricing.exportPrice).toBe(20);
    expect(pricing.reviewRequiredChannels).toEqual([]);
  });
});
