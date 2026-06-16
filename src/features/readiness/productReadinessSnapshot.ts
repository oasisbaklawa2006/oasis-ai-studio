import { dbRowToProductForm } from "@/features/productAuthority/productSchemaAdapter";
import {
  authoritativeMediaAssets,
  deriveHeroUrlFromMediaRows,
  deriveMediaStatusFromRows,
  type DerivedMediaStatus,
} from "@/features/mediaReadiness/mediaAuthorityContract";
import type { ProductMediaRow } from "@/features/mediaReadiness/mediaAssetsFromForm";
import { deriveComplianceApprovedForReadiness } from "@/shared/ai/compliancePersistence";
import {
  mapMoqRules,
  mapPricingRules,
  type MoqRuleRow,
  type PricingRuleRow,
} from "@/features/productTruth/channelAuthorityMappers";
import { getChannelPrice } from "@/features/productTruth/channelPricingMoqEngine";
import {
  evaluateProductReadiness,
  productTruthInputFromForm,
  type ProductReadinessResult,
} from "@/features/productTruth/productReadiness";

/** Persisted authority tables — single snapshot for list + detail readiness. */
export type ProductAuthorityBundle = {
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

export type ProductReadinessSnapshot = {
  readiness: ProductReadinessResult;
  /** Form enriched with authority-derived media fields (not stale localStorage). */
  authorityForm: Record<string, unknown>;
  derivedMediaStatus: DerivedMediaStatus;
  derivedHeroUrl: string | null;
};

/**
 * Single readiness engine input — list cards, Product Truth, Status sidebar, Central Sync.
 * Never uses localStorage. Never invents packaging defaults.
 */
export function buildProductReadinessSnapshot(
  productRow: Record<string, unknown>,
  bundle: Partial<ProductAuthorityBundle> = {},
  opts?: {
    complianceApproved?: boolean;
    complianceMetaPending?: boolean;
  },
): ProductReadinessSnapshot {
  const baseForm = dbRowToProductForm(productRow, {});
  const mediaRows = bundle.productMediaRows ?? [];
  const derivedMediaStatus = deriveMediaStatusFromRows(mediaRows);
  const derivedHeroUrl = deriveHeroUrlFromMediaRows(mediaRows);

  const authorityForm: Record<string, unknown> = {
    ...baseForm,
    media_status: derivedMediaStatus,
    hero_image_url: derivedHeroUrl ?? baseForm.hero_image_url ?? null,
    image_url: derivedHeroUrl ?? baseForm.image_url ?? null,
  };

  const mediaAssets = authoritativeMediaAssets(mediaRows, authorityForm);
  const complianceApproved =
    opts?.complianceApproved ?? deriveComplianceApprovedForReadiness(authorityForm);

  const truthInput = productTruthInputFromForm(authorityForm, {
    isLegacy: !authorityForm.sku,
    complianceApproved,
    complianceMetaPending: opts?.complianceMetaPending ?? false,
    prices: mapPricingRules(bundle.pricingRows ?? []),
    moqRules: mapMoqRules(bundle.moqRows ?? []),
    productMediaRows: mediaRows,
    mediaAssets,
    derivedMediaStatus,
  });

  return {
    readiness: evaluateProductReadiness(truthInput),
    authorityForm,
    derivedMediaStatus,
    derivedHeroUrl,
  };
}

export type ProductCardStatusTone = "ok" | "warn" | "destructive";

export type ProductCardTopLevelStatus = {
  label: string;
  tone: ProductCardStatusTone;
};

const MOQ_GAP_CHANNELS = ["retail", "b2b"] as const;

/** True when a channel has pricing but no MOQ rule (retail/b2b seed targets). */
export function channelNeedsMoq(
  pricingRows: PricingRuleRow[] = [],
  moqRows: MoqRuleRow[] = [],
): boolean {
  const prices = mapPricingRules(pricingRows);
  const moqRules = mapMoqRules(moqRows);
  for (const ch of MOQ_GAP_CHANNELS) {
    const price = getChannelPrice(prices, ch);
    const priceExists = !!(price?.sellingPrice ?? price?.mrp);
    const moq = moqRules.find((r) => r.channel === ch);
    if (priceExists && !moq) return true;
  }
  return false;
}

export type ProductCardStatusOpts = {
  /** Latest immutable catalogue_versions row (approved / published / synced). */
  catalogueVersionApproved?: boolean;
  pricingRows?: PricingRuleRow[];
  moqRows?: MoqRuleRow[];
};

/**
 * Single top-level product card status — same contract as Product Truth.
 * Never returns legacy "draft"; label_status is not consulted here.
 */
export function productCardTopLevelStatus(
  readiness: ProductReadinessResult | null | undefined,
  opts: ProductCardStatusOpts = {},
): ProductCardTopLevelStatus {
  if (!readiness) {
    return { label: "…", tone: "warn" };
  }

  if (readiness.readyForCentralSync || opts.catalogueVersionApproved) {
    return { label: "Ready", tone: "ok" };
  }

  if (!dimensionIsComplete(readiness, "media_status")) {
    return { label: "Needs media", tone: "warn" };
  }
  if (!dimensionIsComplete(readiness, "pricing_status")) {
    return { label: "Needs pricing", tone: "warn" };
  }
  if (channelNeedsMoq(opts.pricingRows, opts.moqRows)) {
    return { label: "Needs MOQ", tone: "warn" };
  }
  if (!dimensionIsComplete(readiness, "compliance_status")) {
    return { label: "Needs compliance", tone: "warn" };
  }

  if (readiness.blockers.length > 0) {
    return { label: "Blocked", tone: "destructive" };
  }

  return { label: `${readiness.score}/${readiness.maxScore}`, tone: "warn" };
}

export function readinessSummaryLabel(
  readiness: ProductReadinessResult,
  opts?: ProductCardStatusOpts,
): string {
  return productCardTopLevelStatus(readiness, opts).label;
}

export function dimensionBadgeLabel(
  readiness: ProductReadinessResult,
  dimension: string,
): string | null {
  const dim = readiness.dimensions.find((d) => d.dimension === dimension);
  if (!dim) return null;
  return dim.badge.replace(/_/g, " ");
}

export function dimensionIsComplete(
  readiness: ProductReadinessResult,
  dimension: string,
): boolean {
  return readiness.dimensions.find((d) => d.dimension === dimension)?.complete ?? false;
}

/** User-facing card label — uses complete flag, not internal badge names like "human edited". */
export function dimensionCardLabel(
  readiness: ProductReadinessResult,
  dimension: string,
): string {
  const dim = readiness.dimensions.find((d) => d.dimension === dimension);
  if (!dim) return "—";
  if (dim.complete) return "complete";
  if (dim.badge === "pending_approval") return "pending";
  return "missing";
}

/** @deprecated Use buildProductReadinessSnapshot */
export function evaluateListProductReadiness(
  productRow: Record<string, unknown>,
  bundle: Partial<ProductAuthorityBundle> = {},
  opts?: { complianceApproved?: boolean; complianceMetaPending?: boolean },
): ProductReadinessResult {
  return buildProductReadinessSnapshot(productRow, bundle, opts).readiness;
}
