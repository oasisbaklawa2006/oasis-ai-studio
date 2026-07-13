import { describe, expect, it } from "vitest";
import { PRODUCT_TYPE_OPTIONS, productTypeOptionsForValue } from "./productTypeProfiles";

describe("product type profiles", () => {
  it("uses controlled profile keys", () => {
    expect(PRODUCT_TYPE_OPTIONS.map((option) => option.v)).toContain("hamper_assorted_gift_pack");
  });

  it("preserves an unknown legacy value while editing", () => {
    expect(productTypeOptionsForValue("Baklawa")[0]).toEqual({ v: "Baklawa", label: "Baklawa (legacy)" });
  });
});
