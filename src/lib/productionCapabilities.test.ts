import { describe, expect, it } from "vitest";
import { PRODUCTION_CAPABILITIES } from "./productionCapabilities";

describe("canonical production capabilities", () => {
  it("keeps absent backend capabilities fail-closed", () => {
    expect(PRODUCTION_CAPABILITIES).toEqual({
      featureFlags: false,
      labels: false,
      searchProductsWithAliasesRpc: false,
    });
  });
});
