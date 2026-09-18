import { describe, expect, it } from "vitest";
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
});
