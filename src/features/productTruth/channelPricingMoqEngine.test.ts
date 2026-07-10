import { describe, expect, it } from "vitest";
import {
  compareChannelPriceRows,
  getChannelPrice,
  getInvalidQtyMessage,
  isPriceEffective,
  priceBlocksPublish,
  validateOrderQtyAgainstChannelRules,
} from "./channelPricingMoqEngine";
import type { ChannelMoqRule, ChannelPriceRecord, PackagingHierarchy } from "./types";

const hierarchy: PackagingHierarchy = {
  piecesPerKg: 40,
  kgPerTray: 1,
  traysPerMasterCarton: 8,
  tolerancePercent: 0,
};

const b2bRule: ChannelMoqRule = {
  channel: "b2b",
  moqApplicable: true,
  moqValue: 8,
  moqUom: "kg",
  incrementValue: 8,
  incrementUom: "kg",
};

describe("channelPricingMoqEngine", () => {
  it("retail 1 pc valid", () => {
    const r = validateOrderQtyAgainstChannelRules(1, "pcs", "retail", undefined, hierarchy);
    expect(r.valid).toBe(true);
  });

  it("B2B 10 kg invalid when increment is 8 kg", () => {
    const msg = getInvalidQtyMessage(10, "kg", "b2b", b2bRule, hierarchy);
    expect(msg).toBeTruthy();
    const r = validateOrderQtyAgainstChannelRules(10, "kg", "b2b", b2bRule, hierarchy);
    expect(r.valid).toBe(false);
  });

  it("B2B 16 kg valid", () => {
    const r = validateOrderQtyAgainstChannelRules(16, "kg", "b2b", b2bRule, hierarchy);
    expect(r.valid).toBe(true);
  });

  it("pending price blocks publish", () => {
    const price: ChannelPriceRecord = {
      channel: "b2b",
      priceStatus: "pending_approval",
      sellingPrice: 100,
    };
    expect(priceBlocksPublish(price)).toBe(true);
  });

  it("expired price not used", () => {
    const price: ChannelPriceRecord = {
      channel: "retail",
      priceStatus: "approved",
      sellingPrice: 50,
      effectiveTo: "2020-01-01",
    };
    expect(isPriceEffective(price, new Date("2026-01-01"))).toBe(false);
    expect(getChannelPrice([price], "retail", new Date("2026-01-01"))).toBeNull();
  });

  describe("getChannelPrice determinism (Defect 3 regression)", () => {
    it("selects the newest approved row by approvedAt", () => {
      const older: ChannelPriceRecord = {
        id: "old",
        channel: "retail",
        priceStatus: "approved",
        sellingPrice: 400,
        approvedAt: "2026-01-01T00:00:00Z",
      };
      const newer: ChannelPriceRecord = {
        id: "new",
        channel: "retail",
        priceStatus: "approved",
        sellingPrice: 450,
        approvedAt: "2026-06-01T00:00:00Z",
      };
      expect(getChannelPrice([older, newer], "retail")?.id).toBe("new");
      expect(getChannelPrice([newer, older], "retail")?.id).toBe("new");
    });

    it("breaks equal-approvedAt ties by the lowest id, regardless of array order", () => {
      const a: ChannelPriceRecord = {
        id: "aaa",
        channel: "retail",
        priceStatus: "approved",
        sellingPrice: 400,
        approvedAt: "2026-01-01T00:00:00Z",
      };
      const b: ChannelPriceRecord = {
        id: "bbb",
        channel: "retail",
        priceStatus: "approved",
        sellingPrice: 450,
        approvedAt: "2026-01-01T00:00:00Z",
      };
      expect(getChannelPrice([a, b], "retail")?.id).toBe("aaa");
      expect(getChannelPrice([b, a], "retail")?.id).toBe("aaa");
    });

    it("breaks ties by id even when neither row has an approvedAt", () => {
      const a: ChannelPriceRecord = { id: "aaa", channel: "retail", priceStatus: "approved", sellingPrice: 400 };
      const b: ChannelPriceRecord = { id: "bbb", channel: "retail", priceStatus: "approved", sellingPrice: 450 };
      expect(getChannelPrice([b, a], "retail")?.id).toBe("aaa");
    });

    it("compareChannelPriceRows sorts newest-first with a stable id tie-break", () => {
      const a: ChannelPriceRecord = { id: "aaa", channel: "retail", priceStatus: "approved", approvedAt: "2026-01-01T00:00:00Z" };
      const b: ChannelPriceRecord = { id: "bbb", channel: "retail", priceStatus: "approved", approvedAt: "2026-06-01T00:00:00Z" };
      const sorted = [a, b].sort(compareChannelPriceRows);
      expect(sorted.map((r) => r.id)).toEqual(["bbb", "aaa"]);
    });
  });
});
