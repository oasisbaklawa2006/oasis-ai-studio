import { beforeEach, describe, expect, it, vi } from "vitest";

const setSource = vi.fn();
const setFailure = vi.fn();
let itemsError: { code: string; message: string } | null = null;

const collection = {
  id: "collection-1",
  title: "B2B Catalogue",
  slug: "b2b-catalogue",
  catalogue_type: "b2b_catalogue",
  channel: null,
  status: "draft",
  description: null,
  theme: "classic_white",
  created_by: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "catalogue_collections") {
        const chain = {
          select: () => chain,
          order: () => Promise.resolve({ data: [collection], error: null }),
        };
        return chain;
      }

      const chain = {
        select: () => chain,
        limit: () => Promise.resolve({ data: [], error: itemsError }),
      };
      return chain;
    },
  },
}));

vi.mock("@/lib/catalogueAuthority/dataSource", () => ({
  getCollectionsPersistenceSource: () => "supabase",
  setCollectionsPersistenceSource: (...args: unknown[]) => setSource(...args),
  setCollectionsLoadFailure: (...args: unknown[]) => setFailure(...args),
}));

vi.mock("@/lib/catalogueAuthority/localStoragePolicy", () => ({
  assertLocalCatalogueFallbackWrite: vi.fn(),
  isLocalCatalogueFallbackReadEnabled: () => false,
}));

import { listCollections } from "./collectionStore";

describe("catalogue collection contract availability", () => {
  beforeEach(() => {
    itemsError = null;
    setSource.mockReset();
    setFailure.mockReset();
  });

  it("enables Supabase authoring only when collection items are readable", async () => {
    await expect(listCollections()).resolves.toEqual([collection]);

    expect(setSource).toHaveBeenCalledWith("supabase");
    expect(setFailure).toHaveBeenCalledWith(null);
  });

  it("preserves readable collections but fails authoring closed when items are unavailable", async () => {
    itemsError = {
      code: "42P01",
      message: 'relation "catalogue_collection_items" does not exist',
    };

    await expect(listCollections()).resolves.toEqual([collection]);

    expect(setSource).toHaveBeenCalledWith("supabase_unavailable");
    expect(setFailure).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "missing_table", code: "42P01" }),
    );
  });
});
