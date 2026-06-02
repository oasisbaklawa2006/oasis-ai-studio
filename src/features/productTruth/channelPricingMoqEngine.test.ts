import { describe, expect, it } from "vitest";
import {
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
});
