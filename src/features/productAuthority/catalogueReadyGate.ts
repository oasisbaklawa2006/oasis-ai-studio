/**
 * Hard gate for the Catalogue-ready toggle. "Active" stays a separate concept — this
 * gate only answers whether a product may honestly be marked catalogue-ready.
 * Pure: callers assemble the input from their own authorities (skuGuard, pricing
 * authority, Product Truth) so the gate itself never queries anything.
 */
import { isStructuredOasisSku } from "./skuGuard";
import type { SaleType } from "./saleType";
import { getSaleTypeRequirements } from "./saleType";
import type { ResolvedPricing } from "./pricingAuthority";
import { pricingBlockers } from "./pricingAuthority";

export const CATALOGUE_READY_TRUTH_THRESHOLD = 0.7;

export interface CatalogueReadyGateInput {
  sku: string | null | undefined;
  saleType: SaleType;
  b2bEnabled?: boolean;
  pricing: ResolvedPricing;
  /** Packaging selection state for sale products (packaging_code or pack type present). */
  packagingPresent: boolean;
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

  if (req.requiresPackaging && !input.packagingPresent) {
    blockers.push("Packaging missing");
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
