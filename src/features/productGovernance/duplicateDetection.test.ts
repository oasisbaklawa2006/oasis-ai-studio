import { describe, expect, it } from "vitest";
import {
  detectProductMasterDuplicates,
  productNameSimilarity,
} from "./duplicateDetection";

describe("detectProductMasterDuplicates", () => {
  it("flags same SKU across products", () => {
    const products = [
      { id: "a", sku: "OAS-001", product_name: "Alpha" },
      { id: "b", sku: "OAS-001", product_name: "Beta" },
    ];

    const dupes = detectProductMasterDuplicates(products);
    expect(dupes.get("a")).toHaveLength(1);
    expect(dupes.get("a")?.[0].kind).toBe("same_sku");
    expect(dupes.get("b")?.[0].otherProductId).toBe("a");
  });

  it("flags same product name across products", () => {
    const products = [
      { id: "a", sku: "OAS-001", product_name: "Baklawa" },
      { id: "b", sku: "OAS-002", product_name: "Baklawa" },
    ];

    const dupes = detectProductMasterDuplicates(products);
    expect(dupes.get("a")?.[0].kind).toBe("same_name");
    expect(dupes.get("b")?.[0].otherProductId).toBe("a");
    expect(dupes.get("a")?.some((signal) => signal.kind === "similar_name")).toBe(false);
  });

  it("flags same barcode from labels table", () => {
    const products = [
      { id: "a", sku: "OAS-001", product_name: "Alpha" },
      { id: "b", sku: "OAS-002", product_name: "Beta" },
    ];
    const labels = [
      { product_id: "a", barcode: "8901234567890" },
      { product_id: "b", barcode: "8901234567890" },
    ];

    const dupes = detectProductMasterDuplicates(products, labels);
    expect(dupes.get("a")?.[0].kind).toBe("same_barcode");
    expect(dupes.get("b")?.[0].matchedValue).toBe("8901234567890");
  });

  it("flags high-confidence spelling and spacing variants as similar products", () => {
    const products = [
      { id: "a", sku: "OAS-001", product_name: "Pistachio Baklawa 500 g" },
      { id: "b", sku: "OAS-002", product_name: "Pistachio Baklava 500g" },
    ];

    const dupes = detectProductMasterDuplicates(products);
    expect(dupes.get("a")?.some((signal) => signal.kind === "similar_name")).toBe(true);
    expect(dupes.get("b")?.some((signal) => signal.kind === "similar_name")).toBe(true);
  });

  it("flags reordered equivalent names as similar products", () => {
    const products = [
      { id: "a", sku: "OAS-001", product_name: "Premium Assorted Baklawa Box" },
      { id: "b", sku: "OAS-002", product_name: "Baklawa Box Premium Assorted" },
    ];

    const dupes = detectProductMasterDuplicates(products);
    expect(dupes.get("a")?.some((signal) => signal.kind === "similar_name")).toBe(true);
  });

  it("does not flag products that only share a generic product-family word", () => {
    const products = [
      { id: "a", sku: "OAS-001", product_name: "Cashew Baklawa 500g" },
      { id: "b", sku: "OAS-002", product_name: "Walnut Baklawa 500g" },
    ];

    const dupes = detectProductMasterDuplicates(products);
    expect(dupes.get("a")?.some((signal) => signal.kind === "similar_name")).toBe(false);
    expect(dupes.get("b")?.some((signal) => signal.kind === "similar_name")).toBe(false);
  });
});

describe("productNameSimilarity", () => {
  it("is deterministic and bounded", () => {
    const score = productNameSimilarity("Pista Baklawa 250 g", "Pista Baklava 250g");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
    expect(score).toBe(productNameSimilarity("Pista Baklawa 250 g", "Pista Baklava 250g"));
  });

  it("does not score missing or tiny names", () => {
    expect(productNameSimilarity(null, "Baklawa")).toBe(0);
    expect(productNameSimilarity("AB", "AC")).toBe(0);
  });
});
