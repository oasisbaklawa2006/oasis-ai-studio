import { describe, expect, it } from "vitest";
import {
  allowedSubcategoryCodes,
  allowedPackagingCodes,
  filterSkuCodeOptions,
  isValidSkuTaxonomyCombination,
} from "./skuTaxonomyMap";

describe("skuTaxonomyMap", () => {
  it("filters Baklawa subcategories only for BKL", () => {
    const allowed = allowedSubcategoryCodes("BKL");
    expect(allowed).toContain("PYR");
    expect(allowed).toContain("PST");
    expect(allowed).not.toContain("EID");
    expect(allowed).not.toContain("KNF");
  });

  it("does not allow Baklawa geometry subcategories for Chocolate DRG", () => {
    const allowed = allowedSubcategoryCodes("DRG");
    expect(allowed).toContain("MIX");
    expect(allowed).not.toContain("PYR");
    expect(allowed).not.toContain("ROL");
  });

  it("filters hamper packaging away from bulk BKL", () => {
    const bulk = allowedPackagingCodes("BKL", "bulk_loose_product");
    expect(bulk).toContain("LOOSE");
    expect(bulk).not.toContain("RBOX");
  });

  it("blocks invalid category/subcategory/packaging combination", () => {
    const result = isValidSkuTaxonomyCombination({
      category_code: "DRG",
      subcategory_code: "PYR",
      packaging_code: "LOOSE",
      product_class: "bulk_loose_product",
    });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/Subcategory/);
  });

  it("filterSkuCodeOptions returns subset when mapping exists", () => {
    const options = [
      { code: "PYR", label: "Pyramid", code_type: "subcategory" },
      { code: "EID", label: "Eid", code_type: "subcategory" },
    ];
    const filtered = filterSkuCodeOptions(options, allowedSubcategoryCodes("BKL"));
    expect(filtered.map((o) => o.code)).toEqual(["PYR"]);
  });
});
