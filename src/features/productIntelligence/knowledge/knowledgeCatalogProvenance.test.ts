import { describe, expect, it } from "vitest";
import { resolveImmutableCatalogueVersionProvenance } from "./knowledgeCatalogProvenance";

describe("catalogue version provenance", () => {
  it("resolves latest immutable version per active product deterministically", () => {
    const result = resolveImmutableCatalogueVersionProvenance(
      ["p1", "p2"],
      [
        { id: "v1-old", product_id: "p1", status: "approved", version_number: 1 },
        { id: "v1-new", product_id: "p1", status: "published", version_number: 2 },
        { id: "v2", product_id: "p2", status: "synced", version_number: 3 },
      ],
    );
    expect(result.handoffReady).toBe(true);
    expect(result.sourceCatalogueVersionIds).toEqual(["v1-new", "v2"]);
    expect(result.provenanceReason).toBe("immutable_catalogue_versions_resolved");
  });

  it("fails closed when any active product lacks an immutable catalogue version", () => {
    const result = resolveImmutableCatalogueVersionProvenance(
      ["p1", "p2"],
      [{ id: "v1", product_id: "p1", status: "approved", version_number: 1 }],
    );
    expect(result.handoffReady).toBe(false);
    expect(result.sourceCatalogueVersionIds).toEqual([]);
    expect(result.provenanceReason).toContain("missing_immutable_catalogue_version:p2");
  });

  it("never fabricates provenance when no products are in scope", () => {
    const result = resolveImmutableCatalogueVersionProvenance([], []);
    expect(result.handoffReady).toBe(false);
    expect(result.sourceCatalogueVersionIds).toEqual([]);
    expect(result.provenanceReason).toBe("no_active_products");
  });
});
