/**
 * Hard gate for the Catalogue-ready toggle. "Active" stays a separate concept — this
 * gate only answers whether a product may honestly be marked catalogue-ready.
 * Pure: callers assemble the input from their own authorities (skuGuard, pricing
 * authority, Product Truth) so the gate itself never queries anything.
 */
import { isStructuredOasisSku, skuPackagingSegment } from "./skuGuard";
import type { SaleType } from "./saleType";
import { getSaleTypeRequirements } from "./saleType";
import type { ResolvedPricing } from "./pricingAuthority";
import { pricingBlockers } from "./pricingAuthority";

export const CATALOGUE_READY_TRUTH_THRESHOLD = 0.7;

/**
 * Active packaging taxonomy snapshot (sku_code_rules where code_type = 'packaging',
 * is_active = true), normalized (trim + uppercase) by the caller before it reaches this
 * pure gate — the gate itself never queries Supabase. `null` on the wrapping
 * CatalogueReadyGateInput field means the authority hasn't loaded yet.
 */
export interface PackagingTaxonomyAuthority {
  activeCodes: Set<string>;
}

export interface CatalogueReadyGateInput {
  sku: string | null | undefined;
  saleType: SaleType;
  b2bEnabled?: boolean;
  pricing: ResolvedPricing;
  /** Raw packaging_code as saved on the product row — validated against packagingAuthority
   *  and cross-checked against the SKU's own packaging segment inside the gate. */
  packagingCode: string | null | undefined;
  /** `null` means the packaging taxonomy authority hasn't loaded yet — the gate must not
   *  treat that as "packaging present" just because a form field happens to be non-empty. */
  packagingAuthority: PackagingTaxonomyAuthority | null;
  heroImageUrl: string | null | undefined;
  /** Product Truth score/maxScore, when available. */
  truthScore?: number | null;
  truthMaxScore?: number | null;
  /** Central sync preview / validation blockers, when available. */
  centralBlockers?: string[];
}

export interface CatalogueReadyGateResult {
  allowed: boolean;
  blockers: string[];
}

export function evaluateCatalogueReadyGate(input: CatalogueReadyGateInput): CatalogueReadyGateResult {
  const req = getSaleTypeRequirements(input.saleType, { b2bEnabled: input.b2bEnabled });
  const blockers: string[] = [];

  if (!req.customerFacing) {
    blockers.push("Internal / not-for-sale products cannot be catalogue-ready");
    return { allowed: false, blockers };
  }

  if (!isStructuredOasisSku(input.sku)) {
    blockers.push("SKU invalid — fix packaging/category before approval");
  }

  blockers.push(...pricingBlockers(input.pricing, input.saleType, { b2bEnabled: input.b2bEnabled }));

  if (req.requiresPackaging) {
    if (!input.packagingAuthority) {
      blockers.push("Packaging taxonomy not loaded yet — cannot confirm packaging readiness");
    } else if (
      !evaluatePackagingReadiness({
        packagingCode: input.packagingCode,
        sku: input.sku,
        packagingAuthority: input.packagingAuthority,
      })
    ) {
      blockers.push("Packaging missing");
    }
  }

  if (req.requiresHeroImage && !String(input.heroImageUrl ?? "").trim()) {
    blockers.push("Hero image missing");
  }

  if (
    input.truthScore != null &&
    input.truthMaxScore != null &&
    input.truthMaxScore > 0 &&
    input.truthScore / input.truthMaxScore < CATALOGUE_READY_TRUTH_THRESHOLD
  ) {
    blockers.push(
      `Product Truth ${input.truthScore}/${input.truthMaxScore} below ${Math.round(CATALOGUE_READY_TRUTH_THRESHOLD * 100)}% threshold`,
    );
  }

  for (const blocker of input.centralBlockers ?? []) {
    blockers.push(`Central preview: ${blocker}`);
  }

  return { allowed: blockers.length === 0, blockers };
}

export function catalogueReadyBlockedMessage(result: CatalogueReadyGateResult): string {
  return `Cannot mark catalogue-ready. Missing: ${result.blockers.join(", ")}.`;
}

export function normalizePackagingCode(code: unknown): string {
  return String(code ?? "").trim().toUpperCase();
}

export interface PackagingReadinessInput {
  packagingCode: unknown;
  sku: unknown;
  packagingAuthority: PackagingTaxonomyAuthority | null;
}

/**
 * Packaging readiness for the gate means a real, currently-active taxonomy
 * `packaging_code` was selected — qty-per-pack, free-text pack size, whitespace, or an
 * arbitrary/stale/inactive string do not prove that (original Defect 5 regression, then a
 * second regression where truthiness alone was accepted regardless of taxonomy validity).
 * When the SKU itself encodes a packaging segment, the saved packaging_code must agree
 * with it after normalization — a mismatch means the SKU is stale relative to the current
 * packaging selection. Sale types that don't require packaging at all are exempted
 * separately via `getSaleTypeRequirements(...).requiresPackaging`.
 */
export function evaluatePackagingReadiness(input: PackagingReadinessInput): boolean {
  if (!input.packagingAuthority) return false;
  const code = normalizePackagingCode(input.packagingCode);
  if (!code) return false;
  if (!input.packagingAuthority.activeCodes.has(code)) return false;

  const skuSegment = skuPackagingSegment(String(input.sku ?? ""));
  if (skuSegment && normalizePackagingCode(skuSegment) !== code) return false;

  return true;
}
