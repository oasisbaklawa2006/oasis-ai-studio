import { supabase } from "@/integrations/supabase/client";
import { queryProductAliasesForProducts } from "@/lib/aliasSchemaAdapter";
import type { RuntimeCatalog, RuntimeCatalogAlias, RuntimeCatalogProduct } from "./types";

function aliasTextFromRow(row: Record<string, unknown>): string {
  const primary = row.alias ?? row.alias_text;
  return String(primary ?? "").trim();
}

function canonicalFromRow(row: Record<string, unknown>, fallback: string): string {
  const c = row.canonical_name;
  return (typeof c === "string" && c.trim()) || fallback;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export type CatalogLexiconEntry = {
  product_id: string;
  sku: string;
  resolved_name: string;
  search_text: string;
  name_tokens: string[];
  terms: Array<{
    text: string;
    tokens: string[];
    source: "sku" | "name" | "short_name" | "alias" | "canonical_name" | "category" | "subcategory";
  }>;
};

export function buildCatalogLexicon(catalog: RuntimeCatalog): CatalogLexiconEntry[] {
  const aliasesByProduct = new Map<string, RuntimeCatalogAlias[]>();
  for (const alias of catalog.aliases) {
    const list = aliasesByProduct.get(alias.product_id) ?? [];
    list.push(alias);
    aliasesByProduct.set(alias.product_id, list);
  }

  return catalog.products.map((product) => {
    const resolved_name = product.product_name ?? product.name;
    const terms: CatalogLexiconEntry["terms"] = [];

    const addTerm = (text: string, source: CatalogLexiconEntry["terms"][number]["source"]) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      terms.push({ text: trimmed, tokens: tokenize(trimmed), source });
    };

    addTerm(product.sku, "sku");
    addTerm(product.name, "name");
    if (product.product_name) addTerm(product.product_name, "name");
    if (product.short_name) addTerm(product.short_name, "short_name");
    if (product.category) addTerm(product.category, "category");
    if (product.subcategory) addTerm(product.subcategory, "subcategory");

    for (const alias of aliasesByProduct.get(product.id) ?? []) {
      addTerm(alias.alias_text, "alias");
      addTerm(alias.canonical_name, "canonical_name");
    }

    const search_text = [
      product.sku,
      product.name,
      product.product_name,
      product.short_name,
      product.category,
      product.subcategory,
      ...(aliasesByProduct.get(product.id) ?? []).flatMap((a) => [a.alias_text, a.canonical_name]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return {
      product_id: product.id,
      sku: product.sku,
      resolved_name,
      search_text,
      name_tokens: tokenize(resolved_name),
      terms,
    };
  });
}

export const RUNTIME_CATALOG_ALIAS_BATCH_SIZE = 200;

export type RuntimeCatalogLoadStats = {
  aliasQueryCount: number;
};

export type RuntimeCatalogLoadResult = {
  catalog: RuntimeCatalog;
  stats: RuntimeCatalogLoadStats;
};

export function batchProductIds(productIds: string[], batchSize: number): string[][] {
  const uniqueIds = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
  if (!uniqueIds.length || batchSize < 1) return [];
  const batches: string[][] = [];
  for (let index = 0; index < uniqueIds.length; index += batchSize) {
    batches.push(uniqueIds.slice(index, index + batchSize));
  }
  return batches;
}

function mapAliasRowsToRuntimeAliases(
  rows: Array<Record<string, unknown>>,
  productsById: Map<string, RuntimeCatalogProduct>,
): RuntimeCatalogAlias[] {
  const aliases: RuntimeCatalogAlias[] = [];
  for (const row of rows) {
    const productId = String(row.product_id ?? "").trim();
    if (!productId) continue;
    const product = productsById.get(productId);
    if (!product) continue;
    const alias_text = aliasTextFromRow(row);
    if (!alias_text) continue;
    aliases.push({
      alias_text,
      canonical_name: canonicalFromRow(row, product.name),
      product_id: productId,
      alias_type: typeof row.alias_type === "string" ? row.alias_type : null,
    });
  }
  return aliases;
}

/**
 * Read-only catalogue loader v2 for Product Intelligence runtime.
 * Uses bulk aliasSchemaAdapter queries (batched) for legacy + migration alias schemas.
 */
export async function loadRuntimeCatalogWithStats(
  skuFilter?: string[],
): Promise<RuntimeCatalogLoadResult> {
  let productQuery = supabase
    .from("products")
    .select(
      "id, sku, name, product_name, short_name, category, subcategory, packaging_code, is_active, created_at",
    );

  if (skuFilter?.length) {
    productQuery = productQuery.in("sku", skuFilter);
  }

  const { data: products, error: productsError } = await productQuery;
  if (productsError) throw productsError;

  const mappedProducts: RuntimeCatalogProduct[] = (products ?? []).map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name ?? p.product_name ?? "Unnamed product",
    product_name: p.product_name ?? null,
    short_name: p.short_name ?? null,
    category: p.category ?? null,
    subcategory: p.subcategory ?? null,
    packaging_code: p.packaging_code ?? null,
    is_active: p.is_active ?? null,
    archived_at: null,
    created_at: p.created_at ?? null,
    updated_at: null,
  }));

  const productsById = new Map(mappedProducts.map((product) => [product.id, product]));
  const aliasRows: Array<Record<string, unknown>> = [];
  let aliasQueryCount = 0;
  for (const batch of batchProductIds(
    mappedProducts.map((product) => product.id),
    RUNTIME_CATALOG_ALIAS_BATCH_SIZE,
  )) {
    aliasQueryCount += 1;
    aliasRows.push(...(await queryProductAliasesForProducts(supabase, batch)));
  }

  return {
    catalog: {
      products: mappedProducts,
      aliases: mapAliasRowsToRuntimeAliases(aliasRows, productsById),
    },
    stats: { aliasQueryCount },
  };
}

export async function loadRuntimeCatalog(skuFilter?: string[]): Promise<RuntimeCatalog> {
  return (await loadRuntimeCatalogWithStats(skuFilter)).catalog;
}

/** Build in-memory catalog from fixtures (tests / offline audit). */
export function buildRuntimeCatalogFromFixtures(
  products: RuntimeCatalogProduct[],
  aliases: RuntimeCatalogAlias[],
): RuntimeCatalog {
  return { products, aliases };
}
