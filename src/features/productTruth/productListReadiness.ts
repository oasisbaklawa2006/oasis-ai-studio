import { dbRowToProductForm } from "@/features/productAuthority/productSchemaAdapter";
import type { ProductMediaRow } from "@/features/mediaReadiness/mediaAssetsFromForm";
import { deriveComplianceApprovedForReadiness } from "@/shared/ai/compliancePersistence";
import {
  mapMoqRules,
  mapPricingRules,
  type MoqRuleRow,
  type PricingRuleRow,
} from "./channelAuthorityMappers";
import { evaluateProductReadiness, productTruthInputFromForm } from "./productReadiness";
import type { ProductReadinessResult } from "./productReadiness";

export type ProductListAuthorityBundle = {
  productMediaRows: ProductMediaRow[];
  pricingRows: PricingRuleRow[];
  moqRows: MoqRuleRow[];
};

export function groupRowsByProductId<T extends { product_id?: string | null }>(
  rows: T[],
): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const row of rows) {
    const pid = row.product_id;
    if (!pid) continue;
    if (!map[pid]) map[pid] = [];
    map[pid].push(row);
  }
  return map;
}

export function evaluateListProductReadiness(
  productRow: Record<string, unknown>,
  bundle: Partial<ProductListAuthorityBundle> = {},
): ProductReadinessResult {
  const form = dbRowToProductForm(productRow, {});
  const productId = String(productRow.id ?? form.id ?? "");

  return evaluateProductReadiness(
    productTruthInputFromForm(form, {
      isLegacy: !form.sku,
      complianceApproved: deriveComplianceApprovedForReadiness(form),
      complianceMetaPending: false,
      prices: mapPricingRules(bundle.pricingRows ?? []),
      moqRules: mapMoqRules(bundle.moqRows ?? []),
      productMediaRows: bundle.productMediaRows ?? [],
    }),
  );
}

export function readinessSummaryLabel(readiness: ProductReadinessResult): string {
  if (readiness.readyForCentralSync) return "Ready";
  if (readiness.blockers.length > 0) {
    return `${readiness.blockers.length} blocker${readiness.blockers.length === 1 ? "" : "s"}`;
  }
  return `${readiness.score}/${readiness.maxScore}`;
}

export function dimensionBadgeLabel(
  readiness: ProductReadinessResult,
  dimension: string,
): string | null {
  const dim = readiness.dimensions.find((d) => d.dimension === dimension);
  if (!dim) return null;
  return dim.badge.replace(/_/g, " ");
}
