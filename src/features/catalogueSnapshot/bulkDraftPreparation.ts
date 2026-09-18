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

export type BulkCatalogueDraftFailure = {
  productId: string;
  message: string;
};

export type BulkCatalogueDraftPreparationResult = {
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

/**
 * Prepares mutable catalogue-version drafts for every active product that does
 * not already have immutable version authority.
 *
 * This operation is deliberately draft-only:
 * - it reuses previewCentralSync(), the same canonical Product Truth snapshot path;
 * - it never calls approveCatalogueVersion();
 * - readiness blockers remain embedded in the generated preview and continue to
 *   prevent immutable approval;
 * - existing immutable products are skipped.
 */
export async function prepareMissingCatalogueVersionDrafts(args?: {
  preparedBy?: string | null;
}): Promise<BulkCatalogueDraftPreparationResult> {
  const [productsResult, authority] = await Promise.all([
    fetchProductsForMasterList({ showArchived: false }),
    fetchProductAuthorityBundle(),
  ]);

  if (productsResult.error) {
    throw new Error(`PRODUCT_LIST_UNAVAILABLE:${productsResult.error}`);
  }
  if (authority.hadErrors) {
    throw new Error("PRODUCT_AUTHORITY_BUNDLE_INCOMPLETE");
  }

  const products = productsResult.products;
  const missingIds = productIdsMissingImmutableVersion(
    products,
    authority.catalogueImmutableByProduct,
  );
  const missingSet = new Set(missingIds);
  const missingProducts = products.filter((product) => missingSet.has(product.id));

  const aliasResult = await queryProductAliasesForProductsResult(supabase, missingIds);
  if (aliasResult.error) {
    throw new Error(`PRODUCT_ALIAS_AUTHORITY_UNAVAILABLE:${aliasResult.error.message}`);
  }
  const aliasesByProduct = groupAliasRows(aliasResult.data);

  let prepared = 0;
  const failures: BulkCatalogueDraftFailure[] = [];

  // Sequential by design: this is an operator-triggered backfill and should not
  // burst hundreds of concurrent version/event writes into production.
  for (const product of missingProducts) {
    const productId = product.id;
    try {
      const form = dbRowToProductForm(product, {});
      const input: SnapshotGeneratorInput = {
        form,
        productId,
        complianceApproved: deriveComplianceApprovedForReadiness(form),
        complianceMetaPending: false,
        prices: mapPricingRules(authority.pricingByProduct[productId] ?? []),
        moqRules: mapMoqRules(authority.moqByProduct[productId] ?? []),
        productMediaRows: authority.mediaByProduct[productId] ?? [],
        languageAliasRows: aliasesByProduct[productId] ?? [],
        approvedBy: args?.preparedBy ?? null,
      };
      await prepareCatalogueVersionDraft(input);
      prepared += 1;
    } catch (error) {
      failures.push({
        productId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    eligible: missingProducts.length,
    prepared,
    skippedImmutable: products.length - missingProducts.length,
    failed: failures.length,
    failures,
  };
}
