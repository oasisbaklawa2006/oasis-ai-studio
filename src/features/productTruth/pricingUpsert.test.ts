import { describe, expect, it } from "vitest";
import { ChannelPricingRules } from "@/components/ChannelPricingRules";
import { extractChannelPricingFromForm } from "@/features/productAuthority/channelPricingMapper";

describe("pricing upsert contract", () => {
  it("documents upsert on product_id + price_channel conflict", () => {
    const source = ChannelPricingRules.toString();
    expect(source).toContain("upsert");
    expect(source).toContain("onConflict");
    expect(source).toContain("product_id,price_channel");
  });

  it("pricing mapper emits product_pricing_rules rows keyed by product_id + price_channel", () => {
    const productId = "prod-uuid-0024";
    const rules = extractChannelPricingFromForm(
      { b2b_price: "1200", mrp: "1500", b2b_price_inr: "1200" },
      productId,
    );
    expect(rules.every((r) => r.product_id === productId)).toBe(true);
    expect(rules.map((r) => r.price_channel).sort()).toEqual(["b2b", "mrp"]);
    expect(rules.find((r) => r.price_channel === "b2b")?.base_price).toBe(1200);
  });
});
