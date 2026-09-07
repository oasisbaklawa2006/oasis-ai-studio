import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogueCollectionItemRow } from "./types";

const upsertMock = vi.fn();
let listItemsResult: CatalogueCollectionItemRow[] = [];

vi.mock("@/integrations/supabase/client", () => {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.order = () => Promise.resolve({ data: listItemsResult, error: null });
  chain.upsert = (...args: unknown[]) => upsertMock(...args);
  return { supabase: { from: () => chain } };
});

vi.mock("@/lib/catalogueAuthority/dataSource", () => ({
  getCollectionsPersistenceSource: () => "supabase",
  setCollectionsPersistenceSource: vi.fn(),
  setCollectionsLoadFailure: vi.fn(),
}));

vi.mock("@/lib/catalogueAuthority/localStoragePolicy", () => ({
  assertLocalCatalogueFallbackWrite: vi.fn(),
  isLocalCatalogueFallbackReadEnabled: () => false,
}));

import { reorderCollectionItems, validateCollectionReorderPermutation } from "./collectionStore";

const baseItems: CatalogueCollectionItemRow[] = [
  {
    id: "item-a",
    collection_id: "col-1",
    product_id: "p-a",
    catalogue_version_id: null,
    sort_order: 0,
    display_name_override: null,
    description_override: null,
    price_visibility: "visible",
    is_featured: false,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "item-b",
    collection_id: "col-1",
    product_id: "p-b",
    catalogue_version_id: null,
    sort_order: 1,
    display_name_override: null,
    description_override: null,
    price_visibility: "visible",
    is_featured: false,
    created_at: "2026-01-01T00:00:00Z",
  },
];

describe("validateCollectionReorderPermutation", () => {
  it("accepts an exact permutation of collection product IDs", () => {
    expect(() => validateCollectionReorderPermutation(baseItems, ["p-b", "p-a"])).not.toThrow();
  });

  it("rejects mismatched product IDs", () => {
    expect(() => validateCollectionReorderPermutation(baseItems, ["p-a", "p-c"])).toThrow(
      /match collection items exactly/i,
    );
  });

  it("rejects duplicate product IDs", () => {
    expect(() => validateCollectionReorderPermutation(baseItems, ["p-a", "p-a"])).toThrow(
      /duplicate/i,
    );
  });

  it("rejects count mismatch", () => {
    expect(() => validateCollectionReorderPermutation(baseItems, ["p-a"])).toThrow(
      /count mismatch/i,
    );
  });
});

describe("reorderCollectionItems", () => {
  beforeEach(() => {
    upsertMock.mockReset();
    listItemsResult = baseItems;
    upsertMock.mockResolvedValue({ error: null });
  });

  it("persists reorder in a single upsert batch", async () => {
    await reorderCollectionItems("col-1", ["p-b", "p-a"]);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const [rows] = upsertMock.mock.calls[0] as [
      Array<{ id: string; sort_order: number }>,
      { onConflict: string },
    ];
    expect(rows).toEqual([
      { id: "item-a", sort_order: 1 },
      { id: "item-b", sort_order: 0 },
    ]);
  });

  it("rejects invalid permutation before writing", async () => {
    await expect(reorderCollectionItems("col-1", ["p-a", "p-x"])).rejects.toThrow(
      /match collection items exactly/i,
    );
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
