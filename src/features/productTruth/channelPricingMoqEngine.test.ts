import { describe, expect, it } from "vitest";
import { channelsEquivalent, getChannelPrice } from "./channelPricingMoqEngine";
import type { ChannelPriceRecord } from "./types";

describe("channelPricingMoqEngine channel aliases", () => {
  it("matches franchisee pricing to franchise channel", () => {
    expect(channelsEquivalent("franchise", "franchisee")).toBe(true);
  });

  it("getChannelPrice resolves franchise from franchisee row", () => {
    const prices: ChannelPriceRecord[] = [
      {
        channel: "franchisee",
        sellingPrice: 100,
        currency: "INR",
        uom: "pcs",
        priceStatus: "approved",
      },
    ];
    const price = getChannelPrice(prices, "franchise");
    expect(price?.sellingPrice).toBe(100);
    expect(price?.uom).toBe("pcs");
  });
});
