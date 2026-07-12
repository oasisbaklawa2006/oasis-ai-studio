import { describe, expect, it } from "vitest";
import { lastOpenedProduct, parseRecentProductEntries, recordRecentProduct } from "./catalogueRecentProducts";

describe("recordRecentProduct", () => {
  it("adds a new product to the front", () => {
    const result = recordRecentProduct([], "p1", "2026-01-01T00:00:00Z");
    expect(result).toEqual([{ productId: "p1", lastOpenedAt: "2026-01-01T00:00:00Z" }]);
  });

  it("moves an already-recorded product to the front instead of duplicating it", () => {
    const existing = [
      { productId: "p1", lastOpenedAt: "2026-01-01T00:00:00Z" },
      { productId: "p2", lastOpenedAt: "2026-01-02T00:00:00Z" },
    ];
    const result = recordRecentProduct(existing, "p1", "2026-01-03T00:00:00Z");
    expect(result).toEqual([
      { productId: "p1", lastOpenedAt: "2026-01-03T00:00:00Z" },
      { productId: "p2", lastOpenedAt: "2026-01-02T00:00:00Z" },
    ]);
  });

  it("does not mutate the input array", () => {
    const existing = [{ productId: "p1", lastOpenedAt: "2026-01-01T00:00:00Z" }];
    recordRecentProduct(existing, "p2");
    expect(existing).toHaveLength(1);
  });

  it("trims to a maximum of 20 entries", () => {
    const existing = Array.from({ length: 20 }, (_, i) => ({
      productId: `p${i}`,
      lastOpenedAt: "2026-01-01T00:00:00Z",
    }));
    const result = recordRecentProduct(existing, "new-product");
    expect(result).toHaveLength(20);
    expect(result[0].productId).toBe("new-product");
  });
});

describe("lastOpenedProduct", () => {
  it("returns null when nothing has been opened", () => {
    expect(lastOpenedProduct([])).toBeNull();
  });

  it("returns the first (most recent) entry", () => {
    const entries = [
      { productId: "p1", lastOpenedAt: "2026-01-02T00:00:00Z" },
      { productId: "p2", lastOpenedAt: "2026-01-01T00:00:00Z" },
    ];
    expect(lastOpenedProduct(entries)?.productId).toBe("p1");
  });
});

describe("parseRecentProductEntries", () => {
  it("returns [] for null, invalid JSON, or a non-array value", () => {
    expect(parseRecentProductEntries(null)).toEqual([]);
    expect(parseRecentProductEntries("not json")).toEqual([]);
    expect(parseRecentProductEntries('{"foo":"bar"}')).toEqual([]);
  });

  it("filters out malformed entries without crashing", () => {
    const raw = JSON.stringify([
      { productId: "p1", lastOpenedAt: "2026-01-01T00:00:00Z" },
      { productId: 123, lastOpenedAt: "2026-01-01T00:00:00Z" },
      { foo: "bar" },
      null,
    ]);
    expect(parseRecentProductEntries(raw)).toEqual([{ productId: "p1", lastOpenedAt: "2026-01-01T00:00:00Z" }]);
  });

  it("round-trips a valid list", () => {
    const entries = [{ productId: "p1", lastOpenedAt: "2026-01-01T00:00:00Z" }];
    expect(parseRecentProductEntries(JSON.stringify(entries))).toEqual(entries);
  });
});
