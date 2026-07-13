import { supabase } from "@/integrations/supabase/client";
import type { ExtendedDatabase } from "@/integrations/supabase/types.extensions";
import {
  assertLocalCatalogueFallbackWrite,
  isLocalCatalogueFallbackReadEnabled,
  isLocalCatalogueFallbackWriteEnabled,
} from "@/lib/catalogueAuthority/localStoragePolicy";
import {
  getCollectionsPersistenceSource,
  setCollectionsLoadFailure,
  setCollectionsPersistenceSource,
} from "@/lib/catalogueAuthority/dataSource";
import { diagnoseSupabaseFailure } from "@/lib/supabase/diagnostics";
import type {
  CatalogueCollectionItemRow,
  CatalogueCollectionRow,
  CatalogueCollectionType,
  CatalogueShareLinkRow,
} from "./types";

const COLLECTIONS_KEY = "oasis_catalogue_collections";
const ITEMS_KEY = "oasis_catalogue_collection_items";
const SHARES_KEY = "oasis_catalogue_share_links";

const authorityDb = supabase as unknown as import("@supabase/supabase-js").SupabaseClient<ExtendedDatabase>;

function readLocal<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocal<T>(key: string, rows: T[]) {
  assertLocalCatalogueFallbackWrite("catalogue collections");
  localStorage.setItem(key, JSON.stringify(rows));
}

function newId() {
  return crypto.randomUUID();
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
  return `${base || "catalogue"}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function operationError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === "object" && "message" in error) {
    return new Error(String((error as { message: unknown }).message));
  }
  return new Error(fallback);
}

function requireLocalFallbackOrThrow(error: unknown, operation: string): void {
  if (
    !isLocalCatalogueFallbackWriteEnabled() ||
    getCollectionsPersistenceSource() !== "local_only"
  ) {
    throw operationError(error, `${operation} failed`);
  }
}

function assertLocalDraftCollection(collectionId: string): CatalogueCollectionRow {
  const collection = readLocal<CatalogueCollectionRow>(COLLECTIONS_KEY).find(
    (candidate) => candidate.id === collectionId,
  );
  if (!collection) throw new Error("Collection not found");
  if (collection.status !== "draft") {
    throw new Error("Collection items can be changed only while the collection is a draft");
  }
  return collection;
}

function bumpLocalDraftRevision(collectionId: string): CatalogueCollectionRow {
  const collection = assertLocalDraftCollection(collectionId);
  const all = readLocal<CatalogueCollectionRow>(COLLECTIONS_KEY);
  const index = all.findIndex((candidate) => candidate.id === collectionId);
  const next = {
    ...collection,
    revision: collection.revision + 1,
    updated_at: new Date().toISOString(),
  };
  all[index] = next;
  writeLocal(COLLECTIONS_KEY, all);
  return next;
}

export { getCollectionsPersistenceSource };

export async function listCollections(): Promise<CatalogueCollectionRow[]> {
  try {
    const { data, error } = await authorityDb
      .from("catalogue_collections")
      .select("*")
      .order("updated_at", { ascending: false });
    if (!error) {
      setCollectionsPersistenceSource("supabase");
      setCollectionsLoadFailure(null);
      return (data ?? []) as CatalogueCollectionRow[];
    }

    const failure = diagnoseSupabaseFailure(error, "catalogue_collections list");
    setCollectionsLoadFailure(failure);
    if (import.meta.env.DEV) {
      console.error("[collectionStore] listCollections:", error);
    }
  } catch (err) {
    setCollectionsLoadFailure(
      diagnoseSupabaseFailure(
        err instanceof Error ? { message: err.message } : { message: String(err) },
        "catalogue_collections list",
      ),
    );
  }

  if (isLocalCatalogueFallbackReadEnabled()) {
    setCollectionsPersistenceSource("local_only");
    return readLocal<CatalogueCollectionRow>(COLLECTIONS_KEY);
  }

  setCollectionsPersistenceSource("supabase_unavailable");
  return [];
}

export async function createCollection(input: {
  title: string;
  catalogue_type: CatalogueCollectionType;
  channel?: string | null;
  description?: string | null;
  theme?: string | null;
}): Promise<CatalogueCollectionRow> {
  const now = new Date().toISOString();
  const row: CatalogueCollectionRow = {
    id: newId(),
    title: input.title,
    slug: slugify(input.title),
    catalogue_type: input.catalogue_type,
    channel: input.channel ?? null,
    status: "draft",
    revision: 1,
    description: input.description ?? null,
    theme: input.theme ?? "classic_white",
    created_by: null,
    reviewed_by: null,
    reviewed_at: null,
    published_by: null,
    published_at: null,
    created_at: now,
    updated_at: now,
  };

  try {
    const { data, error } = await authorityDb.rpc("create_catalogue_collection_v1", {
      _title: row.title,
      _slug: row.slug,
      _catalogue_type: row.catalogue_type,
      _channel: row.channel,
      _description: row.description,
      _theme: row.theme,
    });
    if (!error && data) {
      setCollectionsPersistenceSource("supabase");
      return data as CatalogueCollectionRow;
    }
    if (error) requireLocalFallbackOrThrow(error, "Create collection");
  } catch (error) {
    requireLocalFallbackOrThrow(error, "Create collection");
  }

  assertLocalCatalogueFallbackWrite("createCollection");
  const all = readLocal<CatalogueCollectionRow>(COLLECTIONS_KEY);
  all.unshift(row);
  writeLocal(COLLECTIONS_KEY, all);
  setCollectionsPersistenceSource("local_only");
  return row;
}

export async function updateDraftCollection(input: {
  collectionId: string;
  expectedRevision: number;
  title: string;
  slug: string;
  catalogueType: CatalogueCollectionType;
  channel: string | null;
  description: string | null;
  theme: string | null;
}): Promise<CatalogueCollectionRow> {
  try {
    const { data, error } = await authorityDb.rpc("update_catalogue_collection_draft_v1", {
      _collection_id: input.collectionId,
      _expected_revision: input.expectedRevision,
      _title: input.title,
      _slug: input.slug,
      _catalogue_type: input.catalogueType,
      _channel: input.channel,
      _description: input.description,
      _theme: input.theme,
    });
    if (!error && data) return data as CatalogueCollectionRow;
    if (error) requireLocalFallbackOrThrow(error, "Update draft collection");
  } catch (error) {
    requireLocalFallbackOrThrow(error, "Update draft collection");
  }

  assertLocalCatalogueFallbackWrite("updateDraftCollection");
  const current = assertLocalDraftCollection(input.collectionId);
  if (current.revision !== input.expectedRevision) {
    throw new Error("Collection revision conflict; refresh and review the latest collection");
  }
  const all = readLocal<CatalogueCollectionRow>(COLLECTIONS_KEY);
  const index = all.findIndex((candidate) => candidate.id === input.collectionId);
  all[index] = {
    ...current,
    title: input.title.trim(),
    slug: input.slug,
    catalogue_type: input.catalogueType,
    channel: input.channel,
    description: input.description,
    theme: input.theme,
    revision: current.revision + 1,
    updated_at: new Date().toISOString(),
  };
  writeLocal(COLLECTIONS_KEY, all);
  return all[index];
}

export async function listCollectionItems(
  collectionId: string,
): Promise<CatalogueCollectionItemRow[]> {
  try {
    const { data, error } = await authorityDb
      .from("catalogue_collection_items")
      .select("*")
      .eq("collection_id", collectionId)
      .order("sort_order", { ascending: true });
    if (!error) {
      return (data ?? []) as CatalogueCollectionItemRow[];
    }
    if (!isLocalCatalogueFallbackReadEnabled() || getCollectionsPersistenceSource() !== "local_only") {
      throw operationError(error, "Load collection items failed");
    }
  } catch (error) {
    if (!isLocalCatalogueFallbackReadEnabled() || getCollectionsPersistenceSource() !== "local_only") {
      throw operationError(error, "Load collection items failed");
    }
  }

  if (!isLocalCatalogueFallbackReadEnabled()) return [];

  return readLocal<CatalogueCollectionItemRow>(ITEMS_KEY).filter(
    (i) => i.collection_id === collectionId,
  );
}

export async function addProductToCollection(args: {
  collectionId: string;
  expectedRevision: number;
  productId: string;
  sortOrder?: number;
  isFeatured?: boolean;
}): Promise<{
  collection_id: string;
  revision: number;
  item: CatalogueCollectionItemRow;
}> {
  const existing = await listCollectionItems(args.collectionId);
  if (existing.some((i) => i.product_id === args.productId)) {
    throw new Error("Product already in collection");
  }

  let pinnedVersionId: string | null = null;
  let useLocalFallback = false;
  try {
    if (
      isLocalCatalogueFallbackWriteEnabled() &&
      getCollectionsPersistenceSource() === "local_only"
    ) {
      useLocalFallback = true;
    } else {
      const versionResult = await authorityDb
        .from("catalogue_versions")
        .select("id, status, version_number")
        .eq("product_id", args.productId)
        .in("status", ["published", "synced"])
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (versionResult.error) {
        requireLocalFallbackOrThrow(versionResult.error, "Resolve published catalogue version");
        useLocalFallback = true;
      } else if (!versionResult.data) {
        throw new Error(
          "This product has no published or Central-synced catalogue version. Publish an approved product version before adding it to a collection.",
        );
      } else {
        pinnedVersionId = versionResult.data.id;
      }
    }
  } catch (error) {
    if (error instanceof Error && /only while|not found|no published/.test(error.message)) throw error;
    requireLocalFallbackOrThrow(error, "Prepare collection item");
    useLocalFallback = true;
  }

  if (useLocalFallback) {
    assertLocalCatalogueFallbackWrite("addProductToCollection");
    const collection = assertLocalDraftCollection(args.collectionId);
    if (collection.revision !== args.expectedRevision) {
      throw new Error("Collection revision conflict; refresh and review the latest collection");
    }
    // This sentinel cannot escape explicit dev-only local authority mode.
    pinnedVersionId = `local-only:${args.productId}`;
  }

  const row: CatalogueCollectionItemRow = {
    id: newId(),
    collection_id: args.collectionId,
    product_id: args.productId,
    catalogue_version_id: pinnedVersionId,
    sort_order: args.sortOrder ?? existing.length,
    display_name_override: null,
    description_override: null,
    price_visibility: "visible",
    is_featured: args.isFeatured ?? false,
    created_at: new Date().toISOString(),
  };

  if (!useLocalFallback) try {
    const { data, error } = await authorityDb.rpc("save_catalogue_collection_item_v1", {
      _collection_id: args.collectionId,
      _expected_revision: args.expectedRevision,
      _product_id: args.productId,
      _catalogue_version_id: pinnedVersionId!,
      _sort_order: args.sortOrder ?? null,
      _display_name_override: null,
      _description_override: null,
      _price_visibility: "visible",
      _is_featured: args.isFeatured ?? false,
    });
    if (!error && data) return data as {
      collection_id: string;
      revision: number;
      item: CatalogueCollectionItemRow;
    };
    if (error) requireLocalFallbackOrThrow(error, "Add product to collection");
  } catch (error) {
    requireLocalFallbackOrThrow(error, "Add product to collection");
  }

  assertLocalCatalogueFallbackWrite("addProductToCollection");
  assertLocalDraftCollection(args.collectionId);
  const all = readLocal<CatalogueCollectionItemRow>(ITEMS_KEY);
  all.push(row);
  writeLocal(ITEMS_KEY, all);
  const nextCollection = bumpLocalDraftRevision(args.collectionId);
  return { collection_id: args.collectionId, revision: nextCollection.revision, item: row };
}

export async function removeProductFromCollection(
  collectionId: string,
  expectedRevision: number,
  itemId: string,
): Promise<{ collection_id: string; revision: number; removed_item_id: string }> {
  try {
    if (
      !isLocalCatalogueFallbackWriteEnabled() ||
      getCollectionsPersistenceSource() !== "local_only"
    ) {
      const { data, error } = await authorityDb.rpc("remove_catalogue_collection_item_v1", {
        _collection_id: collectionId,
        _expected_revision: expectedRevision,
        _item_id: itemId,
      });
      if (!error && data) return data;
      if (error) requireLocalFallbackOrThrow(error, "Remove product from collection");
    }
  } catch (error) {
    requireLocalFallbackOrThrow(error, "Remove product from collection");
  }

  assertLocalCatalogueFallbackWrite("removeProductFromCollection");
  const collection = assertLocalDraftCollection(collectionId);
  if (collection.revision !== expectedRevision) {
    throw new Error("Collection revision conflict; refresh and review the latest collection");
  }
  const existingItems = readLocal<CatalogueCollectionItemRow>(ITEMS_KEY);
  const all = existingItems.filter(
    (item) => !(item.collection_id === collectionId && item.id === itemId),
  );
  if (all.length === existingItems.length) {
    throw new Error("Collection item not found");
  }
  writeLocal(ITEMS_KEY, all);
  const nextCollection = bumpLocalDraftRevision(collectionId);
  return { collection_id: collectionId, revision: nextCollection.revision, removed_item_id: itemId };
}

export async function reorderCollectionItems(
  collectionId: string,
  expectedRevision: number,
  orderedProductIds: string[],
): Promise<{
  collection_id: string;
  revision: number;
  items: Array<{ id: string; product_id: string; sort_order: number }>;
}> {
  const items = await listCollectionItems(collectionId);
  assertExactProductPermutation(
    items.map((item) => item.product_id),
    orderedProductIds,
  );
  const updated = items.map((item) => ({
    ...item,
    sort_order: orderedProductIds.indexOf(item.product_id),
  }));

  try {
    const { data, error } = await authorityDb.rpc("reorder_catalogue_collection_items_v1", {
      _collection_id: collectionId,
      _expected_revision: expectedRevision,
      _ordered_product_ids: orderedProductIds,
    });
    if (!error && data) return data;
    if (error) requireLocalFallbackOrThrow(error, "Reorder collection products");
  } catch (error) {
    requireLocalFallbackOrThrow(error, "Reorder collection products");
  }

  assertLocalCatalogueFallbackWrite("reorderCollectionItems");
  const collection = assertLocalDraftCollection(collectionId);
  if (collection.revision !== expectedRevision) {
    throw new Error("Collection revision conflict; refresh and review the latest collection");
  }
  const all = readLocal<CatalogueCollectionItemRow>(ITEMS_KEY).filter(
    (i) => i.collection_id !== collectionId,
  );
  writeLocal(ITEMS_KEY, [...all, ...updated]);
  const collections = readLocal<CatalogueCollectionRow>(COLLECTIONS_KEY);
  const collectionIndex = collections.findIndex((candidate) => candidate.id === collectionId);
  const nextCollection = {
    ...collection,
    revision: collection.revision + 1,
    updated_at: new Date().toISOString(),
  };
  collections[collectionIndex] = nextCollection;
  writeLocal(COLLECTIONS_KEY, collections);
  return {
    collection_id: collectionId,
    revision: nextCollection.revision,
    items: updated.map((item) => ({
      id: item.id,
      product_id: item.product_id,
      sort_order: item.sort_order,
    })),
  };
}

export function assertExactProductPermutation(
  currentProductIds: string[],
  orderedProductIds: string[],
): void {
  const current = new Set(currentProductIds);
  const ordered = new Set(orderedProductIds);
  if (
    currentProductIds.length !== orderedProductIds.length ||
    current.size !== currentProductIds.length ||
    ordered.size !== orderedProductIds.length ||
    current.size !== ordered.size ||
    [...current].some((productId) => !ordered.has(productId))
  ) {
    throw new Error("Reorder must contain every current product exactly once and no foreign products");
  }
}

export async function createCatalogueShareLink(
  collectionId: string,
  shareType: CatalogueShareLinkRow["share_type"] = "view",
  expiresAt: string | null = null,
): Promise<CatalogueShareLinkRow> {
  const collection = (await listCollections()).find((item) => item.id === collectionId);
  if (!collection) throw new Error("Collection not found");
  if (collection.status !== "published") {
    throw new Error("Publish the reviewed collection before creating an external share link");
  }
  try {
    const { data, error } = await authorityDb.rpc("create_catalogue_share_link_v1", {
      _collection_id: collectionId,
      _share_type: shareType,
      _expires_at: expiresAt,
    });
    if (!error && data) return data as CatalogueShareLinkRow;
    if (error) requireLocalFallbackOrThrow(error, "Create catalogue share link");
  } catch (error) {
    requireLocalFallbackOrThrow(error, "Create catalogue share link");
  }

  assertLocalCatalogueFallbackWrite("createCatalogueShareLink");
  const row: CatalogueShareLinkRow = {
    id: newId(),
    collection_id: collectionId,
    collection_revision: collection.revision,
    share_token: crypto.randomUUID().replace(/-/g, "").repeat(2),
    share_type: shareType,
    status: "active",
    expires_at: expiresAt,
    created_by: null,
    revoked_by: null,
    revoked_at: null,
    created_at: new Date().toISOString(),
  };
  const all = readLocal<CatalogueShareLinkRow>(SHARES_KEY);
  all.push(row);
  writeLocal(SHARES_KEY, all);
  return row;
}

export async function revokeCatalogueShareLink(
  shareLinkId: string,
): Promise<CatalogueShareLinkRow> {
  try {
    const { data, error } = await authorityDb.rpc("revoke_catalogue_share_link_v1", {
      _share_link_id: shareLinkId,
    });
    if (!error && data) return data as CatalogueShareLinkRow;
    if (error) requireLocalFallbackOrThrow(error, "Revoke catalogue share link");
  } catch (error) {
    requireLocalFallbackOrThrow(error, "Revoke catalogue share link");
  }

  assertLocalCatalogueFallbackWrite("revokeCatalogueShareLink");
  const all = readLocal<CatalogueShareLinkRow>(SHARES_KEY);
  const index = all.findIndex((link) => link.id === shareLinkId);
  if (index < 0) throw new Error("Share link not found");
  if (all[index].status === "revoked") return all[index];
  if (all[index].status !== "active") throw new Error("Only an active share link can be revoked");
  all[index] = {
    ...all[index],
    status: "revoked",
    revoked_at: new Date().toISOString(),
  };
  writeLocal(SHARES_KEY, all);
  return all[index];
}

export async function transitionCollection(
  collectionId: string,
  expectedRevision: number,
  status: CatalogueCollectionRow["status"],
): Promise<CatalogueCollectionRow> {
  try {
    const { data, error } = await authorityDb
      .rpc("transition_catalogue_collection_v1", {
        _collection_id: collectionId,
        _expected_revision: expectedRevision,
        _to_status: status,
      });
    if (!error && data) return data as CatalogueCollectionRow;
    if (error) requireLocalFallbackOrThrow(error, "Transition catalogue collection");
  } catch (error) {
    requireLocalFallbackOrThrow(error, "Transition catalogue collection");
  }

  assertLocalCatalogueFallbackWrite("transitionCollection");
  const all = readLocal<CatalogueCollectionRow>(COLLECTIONS_KEY);
  const index = all.findIndex((collection) => collection.id === collectionId);
  if (index < 0) throw new Error("Collection not found");
  if (all[index].revision !== expectedRevision) {
    throw new Error("Collection revision conflict; refresh and review the latest collection");
  }
  const currentStatus = all[index].status;
  const allowed =
    (currentStatus === "draft" && status === "internal_review") ||
    (currentStatus === "internal_review" && status === "draft") ||
    (currentStatus === "internal_review" && status === "published") ||
    (currentStatus === "published" && status === "internal_review");
  if (!allowed) throw new Error("Invalid collection status transition");
  const now = new Date().toISOString();
  if (currentStatus === "published" && status === "internal_review") {
    const shares = readLocal<CatalogueShareLinkRow>(SHARES_KEY).map((link) =>
      link.collection_id === collectionId && link.status === "active"
        ? { ...link, status: "revoked" as const, revoked_at: now }
        : link,
    );
    writeLocal(SHARES_KEY, shares);
  }
  all[index] = {
    ...all[index],
    status,
    revision: expectedRevision + 1,
    reviewed_at: status === "internal_review" ? now : status === "draft" ? null : all[index].reviewed_at,
    published_at: status === "published" ? now : null,
    updated_at: now,
  };
  writeLocal(COLLECTIONS_KEY, all);
  return all[index];
}

export function buildPublicCatalogueUrl(shareToken: string): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/c/${shareToken}`;
  }
  return `https://catalogue.oasis.example/c/${shareToken}`;
}
