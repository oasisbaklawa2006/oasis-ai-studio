import { describe, expect, it } from "vitest";
import {
  ADVANCED_PRODUCT_EDIT_TABS,
  isAdvancedProductEditTab,
  PRODUCT_EDIT_TABS,
  resolveProductEditTab,
} from "./productEditTabs";

describe("resolveProductEditTab", () => {
  it("returns every real tab value unchanged", () => {
    for (const tab of PRODUCT_EDIT_TABS) {
      expect(resolveProductEditTab(tab)).toBe(tab);
    }
  });

  it("falls back to 'identity' for null, empty, or a mistyped/obsolete value", () => {
    expect(resolveProductEditTab(null)).toBe("identity");
    expect(resolveProductEditTab("")).toBe("identity");
    expect(resolveProductEditTab("bogus-old-bookmark")).toBe("identity");
  });
});

describe("advanced product editor tabs", () => {
  it("keeps specialist domains behind progressive disclosure without hiding core readiness", () => {
    expect(ADVANCED_PRODUCT_EDIT_TABS).toEqual([
      "private_label",
      "customisation",
      "dimensions",
      "frozen",
      "bom",
      "ops",
    ]);
    expect(isAdvancedProductEditTab("dimensions")).toBe(true);
    expect(isAdvancedProductEditTab("identity")).toBe(false);
    expect(isAdvancedProductEditTab("channels")).toBe(false);
    expect(isAdvancedProductEditTab("compliance")).toBe(false);
  });
});
