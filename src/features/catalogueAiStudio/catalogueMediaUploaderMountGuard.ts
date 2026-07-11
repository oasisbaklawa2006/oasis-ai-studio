/**
 * Pure state machine extracted out of CatalogueProductStudio.tsx (no RTL/.test.tsx convention in
 * this repo — page-level closure logic is otherwise untestable) for a Bugbot finding on PR #84:
 * ProductMediaUploader calls its `onMediaChange` callback after every internal `load()`, including
 * the mount-triggered fetch that fires every time the Media tab is (re)opened (Radix unmounts
 * inactive TabsContent) or the selected product changes while it's already mounted (its own
 * `[productId]`-keyed effect reruns). The studio page also independently fetches the identical
 * `product_media` rows for the same (productId, retry token) pair, so forwarding that mount call
 * straight into a full reload forced the page's own already-in-flight/loaded state back to
 * "loading" and cleared its rows, letting mediaSummary/anchor/readiness briefly drop an approved
 * hero right after selecting a product or reopening the tab.
 *
 * Bugbot round 2: ProductMediaUploader doesn't cancel its in-flight `load()` on unmount, so leaving
 * the Media tab entirely (or switching products) while a fetch is still pending lets that stale
 * callback fire anyway once it resolves — after the uploader is gone. `consumeMediaUploaderChange`
 * refuses to forward any call while nothing is currently mounted, regardless of the one-shot skip.
 *
 * Bugbot (post-round-4 regression, closed in round 6): deferring the uploader's mount until the
 * page's own media fetch finishes loading meant a genuine mutation's own `retryMediaLoad()` call
 * also unmounts-then-remounts the uploader once that reload finishes — the remount's own mount call
 * must be absorbed too, or it loops indefinitely.
 *
 * Bugbot (this round): absorbing *every* fresh mount unconditionally is itself wrong. A bare
 * Media-tab close-then-reopen for the *same* product (no product switch, no page-triggered reload
 * in between) is also a "fresh mount" by the old key-based definition, but the page's own
 * `[selected.id, mediaRetryToken]`-keyed fetch effect does **not** rerun on a tab-visibility change
 * alone — so if a hero/media mutation completed (and was correctly suppressed as stale) while the
 * tab was closed, absorbing the reopen's mount call means `retryMediaLoad()` never fires again, and
 * the page's sticky bar/Build Meter/readiness silently stay out of sync with the database
 * indefinitely. The two cases that genuinely coincide with the page already having (or concurrently
 * fetching) fresh data — a product switch, and our own reload cycle — must still be absorbed; a bare
 * tab reopen with nothing else different must not be. Distinguishing them requires tracking
 * tab-open-ness, productId, and load-eligibility as three separate signals instead of collapsing
 * them into one opaque "mount key" string, since the *reason* the uploader wasn't mounted a moment
 * ago (tab closed vs. still loading) determines whether this mount is safe to skip.
 */

export interface MediaUploaderMountGuardState {
  tabOpen: boolean;
  productId: string | null;
  eligible: boolean;
  skipNextChange: boolean;
}

export const INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE: MediaUploaderMountGuardState = {
  tabOpen: false,
  productId: null,
  eligible: false,
  skipNextChange: false,
};

function isUploaderMounted(state: {
  tabOpen: boolean;
  productId: string | null;
  eligible: boolean;
}): boolean {
  return state.tabOpen && state.productId !== null && state.eligible;
}

/**
 * Call this every render (before any effect can fire, render-phase) with the current (studioTab,
 * productId, uploaderEligibleToRender) — the same three inputs the page's JSX uses to decide
 * whether `ProductMediaUploader` is actually rendered right now.
 */
export function advanceMediaUploaderMountGuard(
  prior: MediaUploaderMountGuardState,
  studioTab: string,
  productId: string | null | undefined,
  uploaderEligibleToRender: boolean,
): MediaUploaderMountGuardState {
  const tabOpen = studioTab === "media";
  const normalizedProductId = productId ?? null;
  const next = { tabOpen, productId: normalizedProductId, eligible: uploaderEligibleToRender };
  const wasMounted = isUploaderMounted(prior);
  const nowMounted = isUploaderMounted(next);

  if (!nowMounted) {
    // Nothing mounted right now — consumeMediaUploaderChange refuses to forward regardless of this
    // flag, so it doesn't matter what it's set to; reset it so the next real mount decides fresh.
    return { ...next, skipNextChange: false };
  }

  const productChanged = normalizedProductId !== prior.productId;
  if (wasMounted && !productChanged) {
    // Continuously mounted for the exact same product as of the prior render — no new mount and
    // no product-driven reload either, so there's nothing new to decide here.
    return { ...next, skipNextChange: prior.skipNextChange };
  }

  // Either a fresh mount is happening this render (wasMounted was false), or the uploader stayed
  // mounted but its productId prop just changed — its own [productId]-keyed effect will refire and
  // reload exactly like a remount would (this is the round-3 case: product switch while the Media
  // tab stays continuously open). Only skip the resulting redundant load if the page's own
  // independent fetch is provably already covering the same data:
  //  - the product changed (the page's own product-switch effect refetches for it too), or
  //  - this is the tail of a loading cycle: the tab was already open a moment ago, so "not mounted"
  //    back then could only have meant `eligible` was false (our own retryMediaLoad(), or the very
  //    first load after selecting this product) — not a bare tab reopen, which is exactly the case
  //    that must NOT be treated as redundant (see the module doc comment).
  const cameFromLoadingCycle = !wasMounted && prior.tabOpen === tabOpen;
  const isProvablyRedundant = productChanged || cameFromLoadingCycle;
  return { ...next, skipNextChange: isProvablyRedundant };
}

/**
 * Call this from the `onMediaChange`/`onHeroChange` handler itself to decide whether to forward
 * the change. Never forwards while nothing is currently mounted — that can only mean the callback
 * is a stale one from an in-flight `load()` that outlived its unmounted component, since a real
 * operator interaction requires the uploader to still be on screen.
 */
export function consumeMediaUploaderChange(state: MediaUploaderMountGuardState): {
  shouldForward: boolean;
  nextState: MediaUploaderMountGuardState;
} {
  if (!isUploaderMounted(state)) {
    return { shouldForward: false, nextState: state };
  }
  if (state.skipNextChange) {
    return { shouldForward: false, nextState: { ...state, skipNextChange: false } };
  }
  return { shouldForward: true, nextState: state };
}
