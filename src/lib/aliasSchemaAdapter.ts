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
  if (!message) return false;
  return /column.*\balias\b.*does not exist|could not find the 'alias'|unknown column.*alias/i.test(
    message,
  );
}

function toMigrationInsert(row: ProductAliasInsertInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    product_id: row.product_id,
    alias: row.alias.trim(),
  };
  if (row.alias_type) payload.alias_type = row.alias_type;
  if (row.source) payload.source = row.source;
  if (row.language != null) payload.language = row.language;
  if (row.script != null) payload.script = row.script;
  if (row.is_active != null) payload.is_active = row.is_active;
  if (row.confidence_score != null) payload.confidence_score = row.confidence_score;
  return payload;
}

function toLegacyInsert(row: ProductAliasInsertInput): Record<string, unknown> {
  return {
    product_id: row.product_id,
    alias_text: row.alias.trim(),
    canonical_name: (row.canonical_name ?? "").trim() || "Unnamed product",
  };
}

/** Insert one alias row — migration schema first, legacy Central fallback on column mismatch. */
export async function insertProductAlias(
  client: AliasClient,
  row: ProductAliasInsertInput,
): Promise<{ data: { id: string } | null; error: { message: string } | null }> {
  const migration = await client
    .from("product_aliases")
    .insert(toMigrationInsert(row) as Database["public"]["Tables"]["product_aliases"]["Insert"])
    .select("id")
    .single();

  if (!migration.error) {
    return { data: migration.data, error: null };
  }

  if (!isAliasSchemaMismatchError(migration.error.message)) {
    return { data: null, error: migration.error };
  }

  const legacy = await client
    .from("product_aliases")
    .insert(toLegacyInsert(row) as never)
    .select("id")
    .single();

  return { data: legacy.data, error: legacy.error };
}

/** Batch insert with legacy fallback when migration columns are absent. */
export async function insertProductAliases(
  client: AliasClient,
  rows: ProductAliasInsertInput[],
): Promise<{ error: { message: string } | null }> {
  if (!rows.length) return { error: null };

  const migrationPayload = rows.map((row) => toMigrationInsert(row));
  const migration = await client
    .from("product_aliases")
    .insert(migrationPayload as Database["public"]["Tables"]["product_aliases"]["Insert"][]);

  if (!migration.error) return { error: null };
  if (!isAliasSchemaMismatchError(migration.error.message)) return { error: migration.error };

  const legacy = await client
    .from("product_aliases")
    .insert(rows.map((row) => toLegacyInsert(row)) as never);
  return { error: legacy.error };
}

function filterActiveAliasRows(
  rows: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return rows.filter((row) => (typeof row.is_active === "boolean" ? row.is_active : true));
}

/** Alias rows for a product — migration schema first, legacy Central fallback. */
export async function queryProductAliasesForProduct(
  client: AliasClient,
  productId: string,
): Promise<Array<Record<string, unknown>>> {
  const rows = await queryProductAliasesForProducts(client, [productId]);
  return rows.filter((row) => String(row.product_id ?? "") === productId);
}

export type ProductAliasesQueryResult = {
  data: Array<Record<string, unknown>>;
  error: { message: string } | null;
};

/** Bulk alias rows for many products — one query per batch, migration schema first. */
export async function queryProductAliasesForProductsResult(
  client: AliasClient,
  productIds: string[],
): Promise<ProductAliasesQueryResult> {
  const uniqueIds = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
  if (!uniqueIds.length) return { data: [], error: null };

  const migration = await client
    .from("product_aliases")
    .select("id, alias, alias_text, canonical_name, alias_type, product_id, source, is_active")
    .in("product_id", uniqueIds)
    .order("created_at", { ascending: false });

  if (!migration.error) {
    return { data: filterActiveAliasRows(migration.data ?? []), error: null };
  }

  if (!isAliasSchemaMismatchError(migration.error.message)) {
    return { data: [], error: migration.error };
  }

  const legacy = await client
    .from("product_aliases")
    .select("id, alias_text, canonical_name, product_id")
    .in("product_id", uniqueIds)
    .order("created_at", { ascending: false });

  if (!legacy.error) return { data: legacy.data ?? [], error: null };
  return { data: [], error: legacy.error };
}

/**
 * Compatibility wrapper for existing read-only consumers.
 * New write-adjacent callers should use queryProductAliasesForProductsResult()
 * so authority read failures cannot be mistaken for an empty alias set.
 */
export async function queryProductAliasesForProducts(
  client: AliasClient,
  productIds: string[],
): Promise<Array<Record<string, unknown>>> {
  const result = await queryProductAliasesForProductsResult(client, productIds);
  return result.data;
}

/** Alias search query compatible with migration and legacy Central schemas. */
export async function queryAliasesByPattern(
  client: AliasClient,
  pattern: string,
): Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }> {
  const migration = await client
    .from("product_aliases")
    .select("alias, alias_text, canonical_name, product_id, alias_type, is_active")
    .or(`alias.ilike.${pattern}`);

  if (!migration.error) return migration;
  if (!isAliasSchemaMismatchError(migration.error.message)) return migration;

  return client
    .from("product_aliases")
    .select("alias_text, canonical_name, product_id")
    .or(`alias_text.ilike.${pattern}`);
}
