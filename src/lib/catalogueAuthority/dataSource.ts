import type { SupabaseFailure } from "@/lib/supabase/diagnostics";

export type CataloguePersistenceSource = "supabase" | "local_only" | "supabase_unavailable";

let collectionsSource: CataloguePersistenceSource = "supabase";
let collectionsLoadFailure: SupabaseFailure | null = null;
let versionsSourceByProduct: Record<string, CataloguePersistenceSource> = {};

export function setCollectionsPersistenceSource(source: CataloguePersistenceSource) {
  collectionsSource = source;
}

export function getCollectionsPersistenceSource(): CataloguePersistenceSource {
  return collectionsSource;
}

export function setCollectionsLoadFailure(failure: SupabaseFailure | null) {
  collectionsLoadFailure = failure;
}

export function getCollectionsLoadFailure(): SupabaseFailure | null {
  return collectionsLoadFailure;
}

export function setVersionsPersistenceSource(
  productId: string,
  source: CataloguePersistenceSource,
) {
  versionsSourceByProduct[productId] = source;
}

export function getVersionsPersistenceSource(
  productId: string,
): CataloguePersistenceSource {
  return versionsSourceByProduct[productId] ?? "supabase";
}
