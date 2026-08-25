import { IMMUTABLE_VERSION_STATUSES } from "@/features/catalogueSnapshot/types";
import { supabase } from "@/integrations/supabase/client";
import { sortDeterministicStrings } from "./deterministicSort";

const IMMUTABLE_STATUS_SET = new Set<string>(IMMUTABLE_VERSION_STATUSES);

export type CatalogueVersionRowRef = {
  id: string;
  product_id: string;
  status: string;
  version_number: number;
};

export type CatalogueVersionProvenance = {
  sourceCatalogueVersionIds: string[];
  handoffReady: boolean;
  provenanceReason: string;
};

/** Deterministic immutable catalogue-version linkage for active products (pure). */
export function resolveImmutableCatalogueVersionProvenance(
  productIds: string[],
  versionRows: CatalogueVersionRowRef[],
): CatalogueVersionProvenance {
  const uniqueProductIds = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
  if (!uniqueProductIds.length) {
    return {
      sourceCatalogueVersionIds: [],
      handoffReady: false,
      provenanceReason: "no_active_products",
    };
  }

  const rowsByProduct = new Map<string, CatalogueVersionRowRef[]>();
  for (const row of versionRows) {
    const productId = row.product_id.trim();
    if (!productId) continue;
    const bucket = rowsByProduct.get(productId) ?? [];
    bucket.push(row);
    rowsByProduct.set(productId, bucket);
  }

  const latestImmutableByProduct = new Map<string, string>();
  for (const productId of uniqueProductIds) {
    const rows = (rowsByProduct.get(productId) ?? []).sort(
      (left, right) => right.version_number - left.version_number,
    );
    const immutable = rows.find((row) => IMMUTABLE_STATUS_SET.has(row.status));
    if (!immutable) {
      return {
        sourceCatalogueVersionIds: [],
        handoffReady: false,
        provenanceReason: `missing_immutable_catalogue_version:${productId}`,
      };
    }
    latestImmutableByProduct.set(productId, immutable.id);
  }

  return {
    sourceCatalogueVersionIds: sortDeterministicStrings(latestImmutableByProduct.values()),
    handoffReady: true,
    provenanceReason: "immutable_catalogue_versions_resolved",
  };
}

/** Read-only provenance from governed catalogue_versions — never fabricates IDs. */
export async function deriveCatalogueVersionProvenance(
  productIds: string[],
): Promise<CatalogueVersionProvenance> {
  const uniqueProductIds = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
  if (!uniqueProductIds.length) {
    return resolveImmutableCatalogueVersionProvenance([], []);
  }

  const { data, error } = await supabase
    .from("catalogue_versions")
    .select("id, product_id, status, version_number")
    .in("product_id", uniqueProductIds)
    .order("version_number", { ascending: false });

  if (error) {
    return {
      sourceCatalogueVersionIds: [],
      handoffReady: false,
      provenanceReason: `catalogue_versions_unavailable:${error.message}`,
    };
  }

  return resolveImmutableCatalogueVersionProvenance(
    uniqueProductIds,
    (data ?? []).map((row) => ({
      id: String(row.id),
      product_id: String(row.product_id),
      status: String(row.status),
      version_number: Number(row.version_number),
    })),
  );
}

export const FIXTURE_CATALOGUE_PROVENANCE: CatalogueVersionProvenance = {
  sourceCatalogueVersionIds: [],
  handoffReady: false,
  provenanceReason: "fixture_corpus_not_handoff_eligible",
};
