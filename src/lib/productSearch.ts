import { fetchActiveProductIdsForSearch } from "@/features/productMaster/productListFetch";
import { productVisibleInActiveView } from "@/features/productMaster/productListModel";
import { supabase } from "@/integrations/supabase/client";
import { queryAliasesByPattern } from "@/lib/aliasSchemaAdapter";
import { PRODUCTION_CAPABILITIES } from "@/lib/productionCapabilities";

export type ProductSearchResult = {
  id: string;
  sku: string;
  product_name: string;
  short_name: string | null;
  category: string | null;
  hero_image_url: string | null;
  matched_alias: string | null;
  match_score: number;
};

export type ProductSearchOutcome = {
  results: ProductSearchResult[];
  usedBasicFallback: boolean;
};

export const BASIC_SEARCH_FALLBACK_MESSAGE =
  "Using basic product search (name, SKU, and alias table).";

type ProductRow = {
  id: string;
  sku: string;
  name?: string | null;
  product_name?: string | null;
  short_name?: string | null;
  category?: string | null;
  image_url?: string | null;
  hero_image_url?: string | null;
  aliases?: string[] | null;
};

type AliasRow = {
  alias_text?: string | null;
  alias?: string | null;
  product_id?: string | null;
  canonical_name?: string | null;
};

export function normalizeSearchQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

export function escapeIlikePattern(q: string): string {
  return q.replace(/[%_\\]/g, "\\$&");
}

/** ILIKE filter across products.name, product_name, short_name, and sku. */
export function buildProductTextSearchOrFilter(rawQuery: string): string {
  const pattern = `%${escapeIlikePattern(normalizeSearchQuery(rawQuery))}%`;
  return [
    `name.ilike.${pattern}`,
    `product_name.ilike.${pattern}`,
    `short_name.ilike.${pattern}`,
    `sku.ilike.${pattern}`,
  ].join(",");
}

export function productDisplayNameFromRow(p: ProductRow): string {
  return p.product_name ?? p.name ?? "Unnamed product";
}

export function productRowToSearchResult(
  p: ProductRow,
  matched_alias: string | null,
  match_score: number,
): ProductSearchResult {
  return {
    id: p.id,
    sku: p.sku,
    product_name: productDisplayNameFromRow(p),
    short_name: p.short_name ?? null,
    category: p.category ?? null,
    hero_image_url: p.hero_image_url ?? p.image_url ?? null,
    matched_alias,
    match_score,
  };
}

function getAliasRowText(row: AliasRow): string {
  return (row.alias_text ?? row.alias ?? "").trim();
}

function scoreProductMatch(p: ProductRow, nq: string): { score: number; matched: string | null } {
  const sku = (p.sku ?? "").toLowerCase();
  const name = productDisplayNameFromRow(p).toLowerCase();
  const legacyName = (p.name ?? "").toLowerCase();
  const productName = (p.product_name ?? "").toLowerCase();
  const shortName = (p.short_name ?? "").toLowerCase();

  if (sku === nq) return { score: 1, matched: null };
  if (sku.includes(nq)) return { score: 0.95, matched: null };
  if (name.includes(nq)) return { score: 0.9, matched: null };
  if (productName?.includes(nq)) return { score: 0.89, matched: null };
  if (legacyName?.includes(nq)) return { score: 0.88, matched: null };
  if (shortName?.includes(nq)) return { score: 0.85, matched: null };

  const aliases = p.aliases ?? [];
  for (const term of aliases) {
    const t = (term ?? "").toLowerCase();
    if (t.includes(nq)) return { score: 0.8, matched: term };
  }

  return { score: 0, matched: null };
}

export function buildFallbackResults(
  products: ProductRow[],
  aliasRows: AliasRow[],
  rawQuery: string,
): ProductSearchResult[] {
  const nq = normalizeSearchQuery(rawQuery);
  if (!nq) return [];

  const productById = new Map(products.map((p) => [p.id, p]));
  const productByName = new Map(
    products.map((p) => [productDisplayNameFromRow(p).toLowerCase(), p]),
  );

  const byId = new Map<string, ProductSearchResult>();

  const consider = (product: ProductRow, matched_alias: string | null, score: number) => {
    if (score <= 0) return;
    const next = productRowToSearchResult(product, matched_alias, score);
    const existing = byId.get(product.id);
    if (!existing || next.match_score > existing.match_score) byId.set(product.id, next);
  };

  for (const p of products) {
    const { score, matched } = scoreProductMatch(p, nq);
    consider(p, matched, score);
  }

  for (const row of aliasRows) {
    const aliasText = getAliasRowText(row);
    if (!aliasText) continue;
    const aliasLower = aliasText.toLowerCase();
    if (!aliasLower.includes(nq) && !nq.includes(aliasLower)) continue;

    const aliasScore = aliasLower === nq ? 0.92 : aliasLower.includes(nq) ? 0.88 : 0.82;

    if (row.product_id) {
      const linkedById = productById.get(row.product_id);
      if (linkedById) {
        consider(linkedById, aliasText, aliasScore);
        continue;
      }
    }

    const canonical = (row.canonical_name ?? "").trim().toLowerCase();
    if (!canonical) continue;

    const linked =
      productByName.get(canonical) ??
      products.find((p) => productDisplayNameFromRow(p).toLowerCase().includes(canonical)) ??
      products.find((p) => canonical.includes(productDisplayNameFromRow(p).toLowerCase()));

    if (linked) consider(linked, aliasText, aliasScore);
  }

  return Array.from(byId.values())
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 50);
}

async function listRecentProducts(): Promise<ProductSearchResult[]> {
  const { data } = await supabase
    .from("products")
    .select(
      "id, sku, name, product_name, short_name, category, image_url, hero_image_url, is_active",
    )
    .order("name", { ascending: true, nullsFirst: false })
    .limit(50);

  return ((data ?? []) as ProductRow[])
    .filter((p) => productVisibleInActiveView(p))
    .map((p) => productRowToSearchResult(p, null, 0));
}

async function basicSearchFallback(text: string): Promise<ProductSearchResult[]> {
  const nq = normalizeSearchQuery(text);
  if (!nq) return listRecentProducts();

  const pattern = `%${escapeIlikePattern(nq)}%`;

  const [productsRes, aliasesRes] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, sku, name, product_name, short_name, category, image_url, hero_image_url, aliases, is_active",
      )
      .or(buildProductTextSearchOrFilter(text)),
    queryAliasesByPattern(supabase, pattern),
  ]);

  if (productsRes.error) console.error("[productSearch] products fallback:", productsRes.error);
  if (aliasesRes.error) console.error("[productSearch] aliases fallback:", aliasesRes.error);

  let products = ((productsRes.data ?? []) as ProductRow[]).filter((p) =>
    productVisibleInActiveView(p),
  );
  const aliasRows = (aliasesRes.data ?? []) as AliasRow[];

  if (productsRes.error) {
    const broad = await supabase
      .from("products")
      .select(
        "id, sku, name, product_name, short_name, category, image_url, hero_image_url, aliases, is_active",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (!broad.error) {
      products = ((broad.data ?? []) as ProductRow[]).filter((p) => productVisibleInActiveView(p));
    }
  } else if (!products.length) {
    const broad = await supabase
      .from("products")
      .select(
        "id, sku, name, product_name, short_name, category, image_url, hero_image_url, aliases, is_active",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (!broad.error) {
      products = ((broad.data ?? []) as ProductRow[]).filter((p) => productVisibleInActiveView(p));
    }
  }

  const extraIds = new Set<string>();
  for (const row of aliasRows) {
    if (row.product_id) extraIds.add(row.product_id);
  }

  const missingIds = [...extraIds].filter((id) => !products.some((p) => p.id === id));
  if (missingIds.length) {
    const { data: linked } = await supabase
      .from("products")
      .select(
        "id, sku, name, product_name, short_name, category, image_url, hero_image_url, aliases, is_active",
      )
      .in("id", missingIds);
    if (linked?.length) {
      const activeLinked = (linked as ProductRow[]).filter((p) => productVisibleInActiveView(p));
      products = [...products, ...activeLinked];
    }
  }

  const canonicalNames = [
    ...new Set(
      aliasRows
        .filter((r) => !r.product_id && r.canonical_name)
        .map((r) => (r.canonical_name ?? "").trim())
        .filter(Boolean),
    ),
  ];

  if (canonicalNames.length) {
    const knownNames = new Set(products.map((p) => productDisplayNameFromRow(p).toLowerCase()));
    const toFetch = canonicalNames.filter((n) => !knownNames.has(n.toLowerCase()));
    if (toFetch.length) {
      const orFilter = toFetch
        .flatMap((n) => {
          const esc = escapeIlikePattern(n);
          return [`name.ilike.${esc}`, `product_name.ilike.${esc}`];
        })
        .join(",");
      const { data: byName } = await supabase
        .from("products")
        .select(
          "id, sku, name, product_name, short_name, category, image_url, hero_image_url, aliases, is_active",
        )
        .or(orFilter);
      if (byName?.length) {
        const seen = new Set(products.map((p) => p.id));
        for (const p of byName as ProductRow[]) {
          if (!seen.has(p.id) && productVisibleInActiveView(p)) products.push(p);
        }
      }
    }
  }

  if (!products.length && !aliasRows.length) {
    const { data: broad } = await supabase
      .from("products")
      .select(
        "id, sku, name, product_name, short_name, category, image_url, hero_image_url, aliases, is_active",
      )
      .limit(200);
    products = ((broad ?? []) as ProductRow[]).filter((p) => productVisibleInActiveView(p));
  }

  return buildFallbackResults(products, aliasRows, text);
}

/**
 * Alias-aware product search with Central-compatible fallback when RPC is absent.
 * SKU is the permanent system identity. Aliases are search helpers only.
 */
export async function searchProductsWithAliases(q: string): Promise<ProductSearchOutcome> {
  const text = q.trim();
  if (!text) {
    return { results: await listRecentProducts(), usedBasicFallback: false };
  }

  if (PRODUCTION_CAPABILITIES.searchProductsWithAliasesRpc) {
    const { data, error } = await supabase.rpc("search_products_with_aliases", { _q: text });
    if (!error && data?.length) {
      const activeIds = await fetchActiveProductIdsForSearch();
      const results = ((data ?? []) as ProductSearchResult[]).filter(
        (r) => activeIds === null || activeIds.has(r.id),
      );
      if (results.length) {
        return { results, usedBasicFallback: false };
      }
    }
    if (error) console.error("[productSearch] RPC unavailable, using fallback:", error.message);
  }

  return {
    results: await basicSearchFallback(text),
    usedBasicFallback: true,
  };
}
