import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractChannelPricingFromForm } from "@/features/productAuthority/channelPricingMapper";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("pricing upsert contract", () => {
  // Point 27, Finding 2: AI Studio must never write product_pricing_rules
  // directly - all pricing changes go through the governed catalogue draft
  // path. Duplicate-channel protection is enforced client-side via
  // isDuplicateChannel() before a row is staged, not via a DB upsert.
  // Reads the full module source (not Component.toString(), which only
  // covers the function body and is blind to helpers extracted outside it)
  // and matches with a regex so quote-style/formatting changes can't
  // silently defeat this guard.
  it("never writes product_pricing_rules directly and guards duplicate channels", () => {
    const source = readFileSync(
      join(__dirname, "../../components/ChannelPricingRules.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(
      /\.from\(\s*["']product_pricing_rules["']\s*\)\s*\.\s*(insert|update|upsert|delete)\s*\(/,
    );
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
