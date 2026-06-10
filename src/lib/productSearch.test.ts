import { describe, expect, it } from "vitest";
import { buildFallbackResults, normalizeSearchQuery, productDisplayNameFromRow } from "./productSearch";

describe("productSearch fallback", () => {
  const products = [
    {
      id: "p1",
      sku: "OAS-AS-BKL-0001",
      name: "Cashew Kitta",
      category: "Baklawa",
      aliases: ["Kitta"],
    },
    {
      id: "p12",
      sku: "OAS-AS-BKL-0012",
      name: "Chocolate Pistachio Asiyah",
      category: "Baklawa",
      aliases: null,
    },
    {
      id: "legacy",
      sku: "OAS-LEGACY-001",
      name: "Cashew Pyramid",
      category: "Baklawa",
      aliases: null,
    },
  ];

  it("normalizes query whitespace", () => {
    expect(normalizeSearchQuery("  Cashew   Kitta ")).toBe("cashew kitta");
  });

  it("finds product by display name", () => {
    const results = buildFallbackResults(products, [], "Cashew Kitta");
    expect(results).toHaveLength(1);
    expect(results[0].sku).toBe("OAS-AS-BKL-0001");
  });

  it("finds product by sku", () => {
    const results = buildFallbackResults(products, [], "OAS-AS-BKL-0012");
    expect(results).toHaveLength(1);
    expect(productDisplayNameFromRow(products[1])).toBe("Chocolate Pistachio Asiyah");
    expect(results[0].product_name).toBe("Chocolate Pistachio Asiyah");
  });

  it("finds product via linked alias_text", () => {
    const results = buildFallbackResults(products, [
      { alias_text: "choco pist", product_id: "p12", canonical_name: "Chocolate Pistachio Asiyah" },
    ], "choco pist");
    expect(results.some((r) => r.sku === "OAS-AS-BKL-0012")).toBe(true);
    expect(results.find((r) => r.sku === "OAS-AS-BKL-0012")?.matched_alias).toBe("choco pist");
  });

  it("finds product via legacy canonical_name alias", () => {
    const results = buildFallbackResults(products, [
      { alias_text: "pyramid", product_id: null, canonical_name: "Cashew Pyramid" },
    ], "pyramid");
    expect(results.some((r) => r.sku === "OAS-LEGACY-001")).toBe(true);
  });
});
