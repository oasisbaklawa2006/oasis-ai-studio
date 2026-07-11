import { describe, expect, it } from "vitest";
import { PRODUCT_EDIT_TABS, resolveProductEditTab } from "./productEditTabs";

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
