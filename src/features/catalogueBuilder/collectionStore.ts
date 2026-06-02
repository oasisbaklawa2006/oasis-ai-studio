import { supabase } from "@/integrations/supabase/client";
import type {
  CatalogueCollectionItemRow,
  CatalogueCollectionRow,
  CatalogueCollectionType,
  CatalogueShareLinkRow,
} from "./types";

const COLLECTIONS_KEY = "oasis_catalogue_collections";
const ITEMS_KEY = "oasis_catalogue_collection_items";
const SHARES_KEY = "oasis_catalogue_share_links";

function readLocal<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocal<T>(key: string, rows: T[]) {
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
  return `${base || "catalogue"}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listCollections(): Promise<CatalogueCollectionRow[]> {
  try {
    const { data, error } = await (supabase as any)
      .from("catalogue_collections")
      .select("*")
      .order("updated_at", { ascending: false });
    if (!error && Array.isArray(data) && data.length) return data as CatalogueCollectionRow[];
  } catch {
    /* local */
  }
  return readLocal<CatalogueCollectionRow>(COLLECTIONS_KEY);
}

export async function createCollection(input: {
  title: string;
  catalogue_type: CatalogueCollectionType;
  channel?: string | null;
  description?: string | null;
  theme?: string | null;
  created_by?: string | null;
}): Promise<CatalogueCollectionRow> {
  const now = new Date().toISOString();
  const row: CatalogueCollectionRow = {
    id: newId(),
    title: input.title,
    slug: slugify(input.title),
    catalogue_type: input.catalogue_type,
    channel: input.channel ?? null,
    status: "draft",
    description: input.description ?? null,
    theme: input.theme ?? "classic_white",
    created_by: input.created_by ?? null,
    created_at: now,
    updated_at: now,
  };

  try {
    const { data, error } = await (supabase as any)
      .from("catalogue_collections")
      .insert(row)
      .select("*")
      .single();
    if (!error && data) return data as CatalogueCollectionRow;
  } catch {
    /* local */
  }

  const all = readLocal<CatalogueCollectionRow>(COLLECTIONS_KEY);
  all.unshift(row);
  writeLocal(COLLECTIONS_KEY, all);
  return row;
}

export async function listCollectionItems(
  collectionId: string,
): Promise<CatalogueCollectionItemRow[]> {
  try {
    const { data, error } = await (supabase as any)
      .from("catalogue_collection_items")
      .select("*")
      .eq("collection_id", collectionId)
      .order("sort_order", { ascending: true });
    if (!error && Array.isArray(data)) return data as CatalogueCollectionItemRow[];
  } catch {
    /* local */
  }
  return readLocal<CatalogueCollectionItemRow>(ITEMS_KEY).filter(
    (i) => i.collection_id === collectionId,
  );
}

export async function addProductToCollection(args: {
  collectionId: string;
  productId: string;
  sortOrder?: number;
  isFeatured?: boolean;
}): Promise<CatalogueCollectionItemRow> {
  const existing = await listCollectionItems(args.collectionId);
  if (existing.some((i) => i.product_id === args.productId)) {
    throw new Error("Product already in collection");
  }

  const row: CatalogueCollectionItemRow = {
    id: newId(),
    collection_id: args.collectionId,
    product_id: args.productId,
    catalogue_version_id: null,
    sort_order: args.sortOrder ?? existing.length,
    display_name_override: null,
    description_override: null,
    price_visibility: "visible",
    is_featured: args.isFeatured ?? false,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await (supabase as any)
      .from("catalogue_collection_items")
      .insert(row)
      .select("*")
      .single();
    if (!error && data) return data as CatalogueCollectionItemRow;
  } catch {
    /* local */
  }

  const all = readLocal<CatalogueCollectionItemRow>(ITEMS_KEY);
  all.push(row);
  writeLocal(ITEMS_KEY, all);
  return row;
}

export async function removeProductFromCollection(
  collectionId: string,
  productId: string,
): Promise<void> {
  try {
    await (supabase as any)
      .from("catalogue_collection_items")
      .delete()
      .eq("collection_id", collectionId)
      .eq("product_id", productId);
  } catch {
    /* local */
  }
  const all = readLocal<CatalogueCollectionItemRow>(ITEMS_KEY).filter(
    (i) => !(i.collection_id === collectionId && i.product_id === productId),
  );
  writeLocal(ITEMS_KEY, all);
}

export async function reorderCollectionItems(
  collectionId: string,
  orderedProductIds: string[],
): Promise<void> {
  const items = await listCollectionItems(collectionId);
  const updated = items.map((item) => ({
    ...item,
    sort_order: orderedProductIds.indexOf(item.product_id),
  }));

  try {
    for (const item of updated) {
      await (supabase as any)
        .from("catalogue_collection_items")
        .update({ sort_order: item.sort_order })
        .eq("id", item.id);
    }
  } catch {
    /* local */
  }

  const all = readLocal<CatalogueCollectionItemRow>(ITEMS_KEY).filter(
    (i) => i.collection_id !== collectionId,
  );
  writeLocal(ITEMS_KEY, [...all, ...updated]);
}

export async function createShareLinkPlaceholder(
  collectionId: string,
  shareType: CatalogueShareLinkRow["share_type"] = "view",
): Promise<CatalogueShareLinkRow> {
  const row: CatalogueShareLinkRow = {
    id: newId(),
    collection_id: collectionId,
    share_token: `share_${Math.random().toString(36).slice(2, 14)}`,
    share_type: shareType,
    status: "active",
    expires_at: null,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await (supabase as any)
      .from("catalogue_share_links")
      .insert(row)
      .select("*")
      .single();
    if (!error && data) return data as CatalogueShareLinkRow;
  } catch {
    /* local */
  }

  const all = readLocal<CatalogueShareLinkRow>(SHARES_KEY);
  all.push(row);
  writeLocal(SHARES_KEY, all);
  return row;
}

export function buildShareUrlPlaceholder(shareToken: string): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/c/${shareToken}`;
  }
  return `https://catalogue.oasis.example/c/${shareToken}`;
}
