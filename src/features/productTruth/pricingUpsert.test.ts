import { describe, expect, it } from "vitest";
import { ChannelPricingRules } from "@/components/ChannelPricingRules";
import { extractChannelPricingFromForm } from "@/features/productAuthority/channelPricingMapper";

describe("pricing upsert contract", () => {
  // Point 27, Finding 2: AI Studio must never write product_pricing_rules
  // directly - all pricing changes go through the governed catalogue draft
  // path. Duplicate-channel protection is enforced client-side via
  // isDuplicateChannel() before a row is staged, not via a DB upsert.
  it("never writes product_pricing_rules directly and guards duplicate channels", () => {
    const source = ChannelPricingRules.toString();
    expect(source).not.toContain('.from("product_pricing_rules").insert');
    expect(source).not.toContain('.from("product_pricing_rules").update');
    expect(source).not.toContain('.from("product_pricing_rules").upsert');
    expect(source).not.toContain('.from("product_pricing_rules").delete');
    expect(source).toContain("isDuplicateChannel");
    expect(source).toContain("submitPricingDraft");
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
