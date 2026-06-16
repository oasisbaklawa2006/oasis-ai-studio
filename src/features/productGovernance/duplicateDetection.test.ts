import { describe, expect, it } from "vitest";
import { detectProductMasterDuplicates } from "./duplicateDetection";

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
});
