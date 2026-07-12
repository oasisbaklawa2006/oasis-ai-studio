/**
 * Single product-media mutation authority, replacing the accumulating mount-guard/callback-
 * suppression patches on `ProductMediaUploader` (PR #84, multiple Bugbot rounds).
 *
 * ROOT PROBLEM those rounds kept re-discovering variations of: `ProductMediaUploader` conflated
 * three independent concerns behind one "is this stale?" check —
 *  1. whether its own local React state may still be updated;
 *  2. whether the operator has switched to a different product; and
 *  3. whether a successfully committed database mutation must be reconciled into application
 *     authority.
 * A component unmount (closing the Media tab) can invalidate (1), but it must never suppress (3):
 * a write that already committed to the database is true regardless of which tab is open or which
 * component instances are alive. Every prior round's fix narrowed *when* callbacks were suppressed,
 * but kept reconciliation itself routed through a component-owned callback prop — so it stayed
 * hostage to that component's mount lifecycle by construction.
 *
 * This module moves reconciliation entirely outside any component's lifecycle:
 *  - `beginProductMediaOperation` captures an immutable (productId, operationId) pair before a
 *    mutation's database/storage work starts.
 *  - `reconcileProductMediaAuthority` performs the *one* completion pipeline every mutation (hero
 *    upload, set-as-hero, clear hero, delete, or any other product_media change) funnels through
 *    after its write commits: re-read product_media for that exact productId, repair/sync the
 *    denormalized `products` columns from it, and — if no *newer* operation for the same product
 *    has since started — cache and publish the authoritative result.
 *  - Subscribers (Catalogue Studio's page state, Full Editor's form state) receive every published
 *    result regardless of their own mount state, and decide for themselves whether to apply it to
 *    the screen (only when `result.productId` matches whatever is currently displayed) — this file
 *    has no concept of "currently displayed" at all, by design.
 *
 * Lifecycle rules this module enforces or assumes:
 *  - READS (a component's own passive display fetch) are the *only* thing that may still be
 *    aborted/ignored on unmount or product switch — unaffected by this module.
 *  - CHILD LOCAL STATE may still be gated on "am I still mounted and showing the same product,"
 *    entirely at the component's discretion — unaffected by this module.
 *  - COMMITTED WRITES always complete reconciliation for the immutable productId they were made
 *    for, via the monotonic per-product operationId below — never suppressed by unmount.
 *  - CURRENT SCREEN PROJECTION is the subscriber's job: apply a result only if it matches whatever
 *    productId is currently on screen.
 *  - Toasts/UI-context messaging are also the caller's job (this module has no UI concerns) —
 *    identify the affected product, or suppress when the visible context has changed.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  repairDirectMasterMediaRows,
  syncProductMediaAuthority,
  type DerivedMediaStatus,
} from "@/features/mediaReadiness/mediaAuthorityContract";
import type { ProductMediaRow } from "@/features/mediaReadiness/mediaAssetsFromForm";

export interface ProductMediaAuthorityResult {
  productId: string;
  operationId: number;
  heroUrl: string | null;
  mediaStatus: DerivedMediaStatus;
  rows: ProductMediaRow[];
}

export type ProductMediaAuthoritySubscriber = (result: ProductMediaAuthorityResult) => void;

/** Monotonic per-product operation counter — never reset, never shared across products. */
const latestOperationIdByProduct = new Map<string, number>();

/** Last reconciled authoritative result per product, retained even once it leaves the screen. */
const authorityByProduct = new Map<string, ProductMediaAuthorityResult>();

const subscribers = new Set<ProductMediaAuthoritySubscriber>();

/**
 * Call once, immediately before a mutation's database/storage work starts, and capture the
 * returned id in a local const alongside the productId it was called for. Never call this more
 * than once per logical mutation, and never call it speculatively for work that might not run.
 */
export function beginProductMediaOperation(productId: string): number {
  const next = (latestOperationIdByProduct.get(productId) ?? 0) + 1;
  latestOperationIdByProduct.set(productId, next);
  return next;
}

function isLatestOperation(productId: string, operationId: number): boolean {
  return latestOperationIdByProduct.get(productId) === operationId;
}

/** Subscribe for the lifetime of a page/screen (not a child component) — never unmount-gated. */
export function subscribeToProductMediaAuthority(fn: ProductMediaAuthoritySubscriber): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

/**
 * Last known authoritative result for productId, if any mutation has ever reconciled it in this
 * session — lets a component that re-displays a product show the committed result instantly,
 * without waiting on a network round trip, even if the operator switched away and back.
 */
export function getCachedProductMediaAuthority(productId: string): ProductMediaAuthorityResult | null {
  return authorityByProduct.get(productId) ?? null;
}

/** Passive read only — no repair/sync write, no sequencing, no publish. For initial display. */
export async function fetchProductMediaRows(productId: string): Promise<ProductMediaRow[]> {
  const { data, error } = await supabase
    .from("product_media")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProductMediaRow[];
}

/**
 * The one completion pipeline every product-media mutation must call after its write commits.
 * Re-reads product_media for productId (never any other product), optionally repairs legacy
 * pending/raw rows to approved (direct-write governance only — pass `repair: true` only where the
 * caller already had direct-write authority for this mutation), and syncs the denormalized
 * `products.hero_image_url`/`products.media_status` columns from the fresh rows.
 *
 * Returns null (and never caches or publishes) if a *newer* operation for this exact productId has
 * started since `operationId` was captured — an out-of-order/superseded completion must never
 * overwrite a newer result. Checked both before and after the `products`-table write, since a newer
 * operation could start while this one's write is still in flight.
 */
export async function reconcileProductMediaAuthority(
  productId: string,
  operationId: number,
  opts?: { fallbackHeroUrl?: string | null; repair?: boolean },
): Promise<ProductMediaAuthorityResult | null> {
  let rows = await fetchProductMediaRows(productId);
  if (!isLatestOperation(productId, operationId)) return null;

  if (opts?.repair) {
    rows = await repairDirectMasterMediaRows(productId, rows);
    if (!isLatestOperation(productId, operationId)) return null;
  }

  const synced = await syncProductMediaAuthority(productId, rows, {
    fallbackHeroUrl: opts?.fallbackHeroUrl,
  });
  if (!isLatestOperation(productId, operationId)) return null;

  const result: ProductMediaAuthorityResult = {
    productId,
    operationId,
    heroUrl: synced.hero_image_url,
    mediaStatus: synced.media_status,
    rows,
  };
  authorityByProduct.set(productId, result);
  for (const fn of subscribers) fn(result);
  return result;
}

/**
 * For a mutation whose authoritative heroUrl/mediaStatus/rows are already fully known to the
 * caller — not derivable by re-reading product_media — rather than needing the general re-derive
 * pipeline above. Concretely: clearing the hero designation ("Remove as hero," which intentionally
 * leaves the underlying product_media row and its approval status untouched — "the image stays in
 * the gallery" — is a `products`-column override, not something a fresh product_media read would
 * agree with; re-deriving from rows here would immediately resurrect the old hero). Still respects
 * the exact same per-product sequencing guarantee against out-of-order completions as
 * `reconcileProductMediaAuthority`.
 */
export function publishProductMediaAuthority(
  productId: string,
  operationId: number,
  result: { heroUrl: string | null; mediaStatus: DerivedMediaStatus; rows: ProductMediaRow[] },
): ProductMediaAuthorityResult | null {
  if (!isLatestOperation(productId, operationId)) return null;
  const full: ProductMediaAuthorityResult = { productId, operationId, ...result };
  authorityByProduct.set(productId, full);
  for (const fn of subscribers) fn(full);
  return full;
}
