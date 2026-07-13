import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  collection: null as Record<string, unknown> | null,
  version: null as Record<string, unknown> | null,
  items: [] as Array<Record<string, unknown>>,
  insertedItem: null as Record<string, unknown> | null,
  fromOperations: [] as Array<{ table: string; operation: string }>,
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  rpcError: null as { message: string } | null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      const builder: Record<string, (...args: unknown[]) => unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.in = () => builder;
      builder.limit = () => builder;
      builder.order = () => {
        if (table === "catalogue_collections") {
          return Promise.resolve({ data: mock.collection ? [mock.collection] : [], error: null });
        }
        if (table === "catalogue_collection_items") {
          return Promise.resolve({ data: mock.items, error: null });
        }
        return builder;
      };
      builder.maybeSingle = () => Promise.resolve({
        data: table === "catalogue_collections" ? mock.collection : mock.version,
        error: null,
      });
      builder.insert = (row: unknown) => {
        mock.fromOperations.push({ table, operation: "insert" });
        if (table === "catalogue_collection_items") {
          mock.insertedItem = row as Record<string, unknown>;
        }
        return builder;
      };
      builder.update = () => {
        mock.fromOperations.push({ table, operation: "update" });
        return builder;
      };
      builder.delete = () => {
        mock.fromOperations.push({ table, operation: "delete" });
        return builder;
      };
      builder.single = () => Promise.resolve({ data: mock.insertedItem, error: null });
      return builder;
    },
    rpc(name: string, args: Record<string, unknown>) {
      mock.rpcCalls.push({ name, args });
      if (mock.rpcError) return Promise.resolve({ data: null, error: mock.rpcError });
      if (name === "create_catalogue_collection_v1") {
        return Promise.resolve({ data: mock.collection, error: null });
      }
      if (name === "update_catalogue_collection_draft_v1") {
        return Promise.resolve({
          data: { ...mock.collection, revision: Number(args._expected_revision) + 1 },
          error: null,
        });
      }
      if (name === "save_catalogue_collection_item_v1") {
        if (mock.collection?.status !== "draft") {
          return Promise.resolve({ data: null, error: { message: "Collection items can be saved only in draft" } });
        }
        if (mock.collection?.revision !== args._expected_revision) {
          return Promise.resolve({ data: null, error: { message: "Collection revision conflict" } });
        }
        mock.insertedItem = {
          id: "item-saved-1",
          collection_id: args._collection_id,
          product_id: args._product_id,
          catalogue_version_id: args._catalogue_version_id,
          sort_order: args._sort_order ?? 0,
          display_name_override: args._display_name_override,
          description_override: args._description_override,
          price_visibility: args._price_visibility,
          is_featured: args._is_featured,
          created_at: "2026-07-14T00:00:00.000Z",
        };
        return Promise.resolve({
          data: {
            collection_id: args._collection_id,
            revision: Number(args._expected_revision) + 1,
            item: mock.insertedItem,
          },
          error: null,
        });
      }
      if (name === "remove_catalogue_collection_item_v1") {
        return Promise.resolve({
          data: {
            collection_id: args._collection_id,
            revision: Number(args._expected_revision) + 1,
            removed_item_id: args._item_id,
          },
          error: null,
        });
      }
      if (name === "transition_catalogue_collection_v1") {
        return Promise.resolve({
          data: {
            ...mock.collection,
            status: args._to_status,
            revision: Number(args._expected_revision) + 1,
          },
          error: null,
        });
      }
      if (name === "reorder_catalogue_collection_items_v1") {
        return Promise.resolve({
          data: {
            ...mock.collection,
            revision: Number(args._expected_revision) + 1,
          },
          error: null,
        });
      }
      return Promise.resolve({
        data: {
          id: "share-1",
          collection_id: args._collection_id,
          collection_revision: mock.collection?.revision,
          share_token: "a".repeat(64),
          share_type: args._share_type,
          status: "active",
          expires_at: args._expires_at,
          created_by: "publisher-1",
          revoked_by: null,
          revoked_at: null,
          created_at: "2026-07-14T00:00:00.000Z",
        },
        error: null,
      });
    },
  },
}));

import {
  addProductToCollection,
  assertExactProductPermutation,
  createCollection,
  createCatalogueShareLink,
  removeProductFromCollection,
  reorderCollectionItems,
  revokeCatalogueShareLink,
  transitionCollection,
  updateDraftCollection,
} from "./collectionStore";

function collection(status: "draft" | "internal_review" | "published" = "draft") {
  return {
    id: "collection-1",
    title: "Authority catalogue",
    slug: "authority-catalogue",
    catalogue_type: "b2b_catalogue",
    channel: "b2b",
    status,
    revision: 7,
    description: null,
    theme: "classic_white",
    created_by: "author-1",
    reviewed_by: null,
    reviewed_at: null,
    published_by: status === "published" ? "publisher-1" : null,
    published_at: status === "published" ? "2026-07-14T00:00:00.000Z" : null,
    created_at: "2026-07-14T00:00:00.000Z",
    updated_at: "2026-07-14T00:00:00.000Z",
  };
}

beforeEach(() => {
  localStorage.clear();
  mock.collection = collection();
  mock.version = {
    id: "version-published-9",
    product_id: "product-1",
    status: "published",
    version_number: 9,
  };
  mock.insertedItem = null;
  mock.items = [];
  mock.fromOperations = [];
  mock.rpcCalls = [];
  mock.rpcError = null;
});

describe("catalogue collection server authority", () => {
  it("uses revision-checked transition RPC without a direct lifecycle update", async () => {
    const result = await transitionCollection("collection-1", 7, "internal_review");

    expect(result.revision).toBe(8);
    expect(mock.rpcCalls).toEqual([{
      name: "transition_catalogue_collection_v1",
      args: {
        _collection_id: "collection-1",
        _expected_revision: 7,
        _to_status: "internal_review",
      },
    }]);
    expect(mock.fromOperations).not.toContainEqual({
      table: "catalogue_collections",
      operation: "update",
    });
  });

  it("creates collections through server authority without direct table insert", async () => {
    const result = await createCollection({
      title: "Authority catalogue",
      catalogue_type: "b2b_catalogue",
      channel: "b2b",
    });

    expect(result.revision).toBe(7);
    expect(mock.rpcCalls[0]?.name).toBe("create_catalogue_collection_v1");
    expect(mock.fromOperations).not.toContainEqual({
      table: "catalogue_collections",
      operation: "insert",
    });
  });

  it("updates draft content through revision-checked server authority", async () => {
    const result = await updateDraftCollection({
      collectionId: "collection-1",
      expectedRevision: 7,
      title: "Updated catalogue",
      slug: "updated-catalogue",
      catalogueType: "b2b_catalogue",
      channel: "b2b",
      description: null,
      theme: "classic_white",
    });

    expect(result.revision).toBe(8);
    expect(mock.rpcCalls[0]?.name).toBe("update_catalogue_collection_draft_v1");
    expect(mock.fromOperations).not.toContainEqual({
      table: "catalogue_collections",
      operation: "update",
    });
  });

  it("surfaces a server revision conflict without inventing a browser transition", async () => {
    mock.rpcError = { message: "Collection revision conflict" };

    await expect(transitionCollection("collection-1", 6, "internal_review"))
      .rejects.toThrow(/revision conflict/i);
    expect(localStorage.getItem("oasis_catalogue_collections")).toBeNull();
    expect(mock.fromOperations).not.toContainEqual({
      table: "catalogue_collections",
      operation: "update",
    });
  });

  it("uses the server share RPC and never inserts a browser-created token", async () => {
    mock.collection = collection("published");
    const link = await createCatalogueShareLink("collection-1", "whatsapp");

    expect(link.share_token).toBe("a".repeat(64));
    expect(mock.rpcCalls[0]?.name).toBe("create_catalogue_share_link_v1");
    expect(mock.fromOperations).not.toContainEqual({
      table: "catalogue_share_links",
      operation: "insert",
    });
  });

  it("revokes through server authority without a direct share-table update", async () => {
    await revokeCatalogueShareLink("share-1");

    expect(mock.rpcCalls[0]).toEqual({
      name: "revoke_catalogue_share_link_v1",
      args: { _share_link_id: "share-1" },
    });
    expect(mock.fromOperations).not.toContainEqual({
      table: "catalogue_share_links",
      operation: "update",
    });
  });

  it("pins the latest published or synced immutable version when adding a product", async () => {
    const item = await addProductToCollection({
      collectionId: "collection-1",
      expectedRevision: 7,
      productId: "product-1",
    });

    expect(item.revision).toBe(8);
    expect(item.item.catalogue_version_id).toBe("version-published-9");
    expect(mock.insertedItem?.catalogue_version_id).toBe("version-published-9");
    expect(mock.rpcCalls.at(-1)?.name).toBe("save_catalogue_collection_item_v1");
    expect(mock.fromOperations).not.toContainEqual({
      table: "catalogue_collection_items",
      operation: "insert",
    });
  });

  it("surfaces item-save revision conflicts without browser fallback", async () => {
    await expect(addProductToCollection({
      collectionId: "collection-1",
      expectedRevision: 6,
      productId: "product-1",
    })).rejects.toThrow(/revision conflict/i);
    expect(mock.insertedItem).toBeNull();
    expect(localStorage.getItem("oasis_catalogue_collection_items")).toBeNull();
  });

  it("fails actionably instead of creating an unpinned item", async () => {
    mock.version = null;

    await expect(addProductToCollection({
      collectionId: "collection-1",
      expectedRevision: 7,
      productId: "product-1",
    })).rejects.toThrow(/no published or Central-synced catalogue version/i);
    expect(mock.insertedItem).toBeNull();
  });

  it("prevents item mutation when the collection is not a draft", async () => {
    mock.collection = collection("internal_review");

    await expect(addProductToCollection({
      collectionId: "collection-1",
      expectedRevision: 7,
      productId: "product-1",
    })).rejects.toThrow(/only in draft/i);
    expect(mock.insertedItem).toBeNull();
  });

  it("removes an item through revision-checked server authority without direct delete", async () => {
    const result = await removeProductFromCollection("collection-1", 7, "item-1");

    expect(result).toEqual({
      collection_id: "collection-1",
      revision: 8,
      removed_item_id: "item-1",
    });
    expect(mock.rpcCalls[0]).toEqual({
      name: "remove_catalogue_collection_item_v1",
      args: {
        _collection_id: "collection-1",
        _expected_revision: 7,
        _item_id: "item-1",
      },
    });
    expect(mock.fromOperations).not.toContainEqual({
      table: "catalogue_collection_items",
      operation: "delete",
    });
  });

  it("rejects omitted, duplicated, and foreign product IDs before reorder authority", () => {
    expect(() => assertExactProductPermutation(["a", "b", "c"], ["a", "b"]))
      .toThrow(/every current product exactly once/i);
    expect(() => assertExactProductPermutation(["a", "b", "c"], ["a", "a", "c"]))
      .toThrow(/every current product exactly once/i);
    expect(() => assertExactProductPermutation(["a", "b", "c"], ["a", "b", "foreign"]))
      .toThrow(/every current product exactly once/i);
  });

  it("uses one atomic revision-checked reorder RPC and no row update loop", async () => {
    mock.items = [
      { id: "item-a", collection_id: "collection-1", product_id: "a", sort_order: 0 },
      { id: "item-b", collection_id: "collection-1", product_id: "b", sort_order: 1 },
    ];

    const result = await reorderCollectionItems("collection-1", 7, ["b", "a"]);

    expect(result.revision).toBe(8);
    expect(mock.rpcCalls[0]).toEqual({
      name: "reorder_catalogue_collection_items_v1",
      args: {
        _collection_id: "collection-1",
        _expected_revision: 7,
        _ordered_product_ids: ["b", "a"],
      },
    });
    expect(mock.fromOperations).not.toContainEqual({
      table: "catalogue_collection_items",
      operation: "update",
    });
  });
});
