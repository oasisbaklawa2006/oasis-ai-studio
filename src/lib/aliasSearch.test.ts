import { describe, expect, it } from "vitest";
import { buildFallbackResults } from "./productSearch";

describe("alias search fallback", () => {
  it("finds product by durable alias column", () => {
    const products = [
      {
        id: "p1",
        sku: "OAS-AS-BKL-ASS-LOOSE-0001",
        product_name: "Classic Pistachio Midya",
        short_name: null,
        category: "Bulk Sweets",
      },
    ];
    const aliasRows = [{ alias: "Pista Midya", product_id: "p1" }];

    const results = buildFallbackResults(products, aliasRows, "pista midya");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("p1");
    expect(results[0].matched_alias).toBe("Pista Midya");
  });
});
