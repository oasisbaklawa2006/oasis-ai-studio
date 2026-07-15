import { describe, expect, it } from "vitest";
import { PRODUCTION_CAPABILITIES } from "./productionCapabilities";

describe("canonical production capabilities", () => {
  it("keeps absent backend capabilities fail-closed", () => {
    expect(PRODUCTION_CAPABILITIES).toEqual({
      auditLog: false,
      catalogues: false,
      catalogueCollections: false,
      featureFlags: false,
      hampers: false,
      importLogs: false,
      ingredients: false,
      integrationSettings: false,
      labels: false,
      searchProductsWithAliasesRpc: false,
      tags: false,
    });
  });
});
