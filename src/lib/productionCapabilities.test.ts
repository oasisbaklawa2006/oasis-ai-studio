import { describe, expect, it } from "vitest";
import { PRODUCTION_CAPABILITIES } from "./productionCapabilities";

describe("canonical production capabilities", () => {
  it("keeps unaccepted browser capabilities fail-closed", () => {
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
