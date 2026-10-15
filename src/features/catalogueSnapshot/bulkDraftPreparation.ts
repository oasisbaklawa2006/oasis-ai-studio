import { dbRowToProductForm } from "@/features/productAuthority/productSchemaAdapter";
import {
  fetchProductAuthorityBundle,
  fetchProductsForMasterList,
} from "@/features/productMaster/productListFetch";
import { mapMoqRules, mapPricingRules } from "@/features/productTruth/channelAuthorityMappers";
import { supabase } from "@/integrations/supabase/client";
import { getAliasText } from "@/lib/aliasDisplay";
import { queryProductAliasesForProductsResult } from "@/lib/aliasSchemaAdapter";
import { deriveComplianceApprovedForReadiness } from "@/shared/ai/compliancePersistence";
import { prepareCatalogueVersionDraft } from "./centralSyncPreviewService";
import type { SnapshotGeneratorInput } from "./types";

type BulkCatalogueDraftFailure = {
  productId: string;
  message: string;
};

type BulkCatalogueDraftPreparationResult = {
  eligible: number;
  prepared: number;
  skippedImmutable: number;
  failed: number;
  failures: BulkCatalogueDraftFailure[];
};

export function productIdsMissingImmutableVersion(
  products: Array<{ id: string }>,
  catalogueApprovedByProduct: Record<string, boolean>,
): string[] {
  return products.map((product) => product.id).filter((id) => !catalogueApprovedByProduct[id]);
}

function groupAliasRows(
  rows: Array<Record<string, unknown>>,
): Record<string, SnapshotGeneratorInput["languageAliasRows"]> {
  const grouped: Record<string, SnapshotGeneratorInput["languageAliasRows"]> = {};
  for (const row of rows) {
    const productId = String(row.product_id ?? "").trim();
    if (!productId) continue;
    const alias = getAliasText(row as { alias?: string | null; alias_text?: string | null });
    if (!alias) continue;
    const bucket = grouped[productId] ?? [];
    bucket.push({
      id: String(row.id ?? ""),
      alias,
      alias_text: typeof row.alias_text === "string" ? row.alias_text : null,
      product_id: productId,
      canonical_name: typeof row.canonical_name === "string" ? row.canonical_name : null,
      alias_type: typeof row.alias_type === "string" ? row.alias_type : null,
    });
    grouped[productId] = bucket;
  }
  return grouped;
}
