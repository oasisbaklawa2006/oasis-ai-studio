import { describe, expect, it } from "vitest";
import { catalogueVersionAuthorityMaps } from "@/features/productMaster/productListFetch";
import { productIdsMissingImmutableVersion } from "./bulkDraftPreparation";

describe("bulk catalogue draft preparation", () => {
  it("prepares only products without immutable version authority", () => {
    expect(
      productIdsMissingImmutableVersion([{ id: "p1" }, { id: "p2" }, { id: "p3" }], {
        p1: true,
        p2: false,
      }),
    ).toEqual(["p2", "p3"]);
  });

  it("never re-prepares products already covered by immutable versions", () => {
    expect(
      productIdsMissingImmutableVersion([{ id: "p1" }, { id: "p2" }], { p1: true, p2: true }),
    ).toEqual([]);
  });

  it("skips a product when immutable v1 exists behind mutable v2", () => {
    const authority = catalogueVersionAuthorityMaps([
      { product_id: "p1", status: "draft", version_number: 2 },
      { product_id: "p1", status: "approved", version_number: 1 },
      { product_id: "p2", status: "draft", version_number: 1 },
    ]);

    expect(authority.headImmutableByProduct).toEqual({ p1: false, p2: false });
    expect(authority.headStatusByProduct).toEqual({ p1: "draft", p2: "draft" });
    expect(authority.anyImmutableByProduct).toEqual({ p1: true, p2: false });
    expect(
      productIdsMissingImmutableVersion(
        [{ id: "p1" }, { id: "p2" }],
        authority.anyImmutableByProduct,
      ),
    ).toEqual(["p2"]);
  });
  it("does not label an approved or published head as synced to Central", () => {
    const status = catalogueVersionAuthorityMaps([
      { product_id: "approved", status: "approved", version_number: 3 },
      { product_id: "published", status: "published", version_number: 2 },
      { product_id: "synced", status: "synced", version_number: 4 },
      { product_id: "revised", status: "draft", version_number: 5 },
      { product_id: "revised", status: "synced", version_number: 4 },
    ]);

    expect(status.headStatusByProduct).toEqual({
      approved: "approved",
      published: "published",
      synced: "synced",
      revised: "draft",
    });
    expect(status.headImmutableByProduct).toEqual({
      approved: true,
      published: true,
      synced: true,
      revised: false,
    });
    expect(status.anyImmutableByProduct.revised).toBe(true);
  });
});
