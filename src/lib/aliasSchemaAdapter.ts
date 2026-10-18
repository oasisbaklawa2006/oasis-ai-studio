import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AliasClient = SupabaseClient<Database>;
export type ProductAliasInsertInput = {
  product_id: string;
  alias: string;
  canonical_name?: string;
  alias_type?: string;
  source?: string;
  language?: string | null;
  script?: string | null;
  is_active?: boolean;
  confidence_score?: number;
};
export function isAliasSchemaMismatchError(message: string | undefined): boolean {
  return (
    !!message &&
    /column.*\balias\b.*does not exist|could not find the 'alias'|unknown column.*alias/i.test(
      message,
    )
  );
}

/** Current Core alias authority has alias_text/canonical_name; no competing alias schema. */
export function toCoreAliasInsert(
  row: ProductAliasInsertInput,
): Database["public"]["Tables"]["product_aliases"]["Insert"] {
  const productId = row.product_id.trim();
  const alias = row.alias.trim();
  const canonicalName = row.canonical_name?.trim();
  if (!productId || !alias || !canonicalName)
    throw new Error(
      "Product identity, alias and canonical product name are required. Refresh the product before saving.",
    );
  return { product_id: productId, alias_text: alias, canonical_name: canonicalName };
}
export async function insertProductAlias(
  client: AliasClient,
  row: ProductAliasInsertInput,
): Promise<{ data: { id: string } | null; error: { message: string } | null }> {
  try {
    const payload = toCoreAliasInsert(row);
    const { data, error } = await client
      .from("product_aliases")
      .insert(payload)
      .select("id")
      .single();
    return { data, error };
  } catch (error) {
    return {
      data: null,
      error: {
        message: error instanceof Error ? error.message : "Alias save could not be confirmed.",
      },
    };
  }
}
export async function insertProductAliases(
  client: AliasClient,
  rows: ProductAliasInsertInput[],
): Promise<{ error: { message: string } | null }> {
  if (!rows.length) return { error: null };
  try {
    const payload = rows.map(toCoreAliasInsert);
    const { error } = await client.from("product_aliases").insert(payload);
    return { error };
  } catch (error) {
    return {
      error: {
        message: error instanceof Error ? error.message : "Alias save could not be confirmed.",
      },
    };
  }
}
export type ProductAliasesQueryResult = {
  data: Array<Record<string, unknown>>;
  error: { message: string } | null;
};
export async function queryProductAliasesForProductsResult(
  client: AliasClient,
  productIds: string[],
): Promise<ProductAliasesQueryResult> {
  const ids = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) return { data: [], error: null };
  const { data, error } = await client
    .from("product_aliases")
    .select("id, alias_text, canonical_name, product_id")
    .in("product_id", ids)
    .order("created_at", { ascending: false });
  return { data: error ? [] : (data ?? []), error };
}
export async function queryProductAliasesForProducts(
  client: AliasClient,
  productIds: string[],
): Promise<Array<Record<string, unknown>>> {
  return (await queryProductAliasesForProductsResult(client, productIds)).data;
}
export async function queryProductAliasesForProduct(
  client: AliasClient,
  productId: string,
): Promise<Array<Record<string, unknown>>> {
  return (await queryProductAliasesForProducts(client, [productId])).filter(
    (row) => row.product_id === productId,
  );
}
export async function queryAliasesByPattern(
  client: AliasClient,
  pattern: string,
): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> {
  const { data, error } = await client
    .from("product_aliases")
    .select("alias_text, canonical_name, product_id")
    .ilike("alias_text", pattern);
  return { data, error };
}
