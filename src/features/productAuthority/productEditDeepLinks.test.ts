import { describe, expect, it } from "vitest";
import {
  PRODUCT_ALIASES_SECTION_ID,
  productAliasesDeepLink,
  productMediaDeepLink,
} from "./productEditDeepLinks";

describe("productEditDeepLinks", () => {
  it("builds media tab deep link for SCREEN #29", () => {
    expect(productMediaDeepLink("abc-123")).toBe("/products/abc-123?tab=media");
  });

  it("builds identity tab + aliases anchor for SCREEN #30", () => {
    expect(productAliasesDeepLink("prod-1")).toBe(
      `/products/prod-1?tab=identity#${PRODUCT_ALIASES_SECTION_ID}`,
    );
  });
});
