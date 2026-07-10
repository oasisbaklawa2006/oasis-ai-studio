/**
 * Thin adapter over the existing media-readiness authority (mediaReadinessEngine.ts /
 * mediaAuthorityContract.ts) for the Catalogue Studio Media tab. Deliberately does not
 * reimplement slot applicability, required-vs-optional classification, or approval rules — those
 * all live in evaluateMediaReadiness()/authoritativeMediaAssets(), already used elsewhere in this
 * app (Product Truth, ProductEdit). This module only shapes their output for display here.
 */
import { authoritativeMediaAssets } from "@/features/mediaReadiness/mediaAuthorityContract";
import { evaluateMediaReadiness } from "@/features/mediaReadiness/mediaReadinessEngine";
import type { ProductMediaContext } from "@/features/mediaReadiness/types";
import type { ProductMediaRow } from "@/features/mediaReadiness/mediaAssetsFromForm";

export type CatalogueMediaSlotStatus = "satisfied" | "missing" | "not_applicable";

export interface CatalogueMediaSlot {
  type: string;
  label: string;
  status: CatalogueMediaSlotStatus;
}

/**
 * Required media slots for this product, with satisfied/missing status from the same approved-
 * media authority evaluateMediaReadiness() already uses (pending/draft/rejected rows never count
 * as satisfied — see buildSlot()'s `approved` check in mediaReadinessEngine.ts). "not_applicable"
 * is intentionally never emitted here: evaluateMediaReadiness()'s required-slot list already IS
 * the applicable set for this product's detected media profile — nothing outside it is surfaced.
 */
/**
 * Missing required media slots always deep-link to this literal path — not through
 * catalogueStudioNavigation.ts's category-based fullEditorDeepLink(), which resolves to different
 * Full Editor sections per readiness category. Media has exactly one owner section regardless of
 * slot type, so the link is fixed.
 */
export function catalogueMediaTabDeepLink(productId: string): string {
  return `/products/${productId}?tab=media`;
}

export function catalogueRequiredMediaSlots(
  product: ProductMediaContext,
  mediaRows: ProductMediaRow[],
): CatalogueMediaSlot[] {
  const assets = authoritativeMediaAssets(mediaRows);
  const readiness = evaluateMediaReadiness(product, assets);
  return readiness.slots
    .filter((slot) => slot.required)
    .map((slot) => ({
      type: slot.type,
      label: slot.label,
      status: slot.present && slot.approved ? "satisfied" : "missing",
    }));
}
