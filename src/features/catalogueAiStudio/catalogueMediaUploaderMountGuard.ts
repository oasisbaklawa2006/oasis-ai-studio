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
 * refused to forward any call while nothing is currently mounted, regardless of the one-shot skip.
 * (Superseded by a later round below — see `consumeMediaUploaderChange`'s doc comment.)
 *
 * Bugbot (post-round-4 regression, closed in round 6): deferring the uploader's mount until the
 * page's own media fetch finishes loading meant a genuine mutation's own `retryMediaLoad()` call
 * also unmounts-then-remounts the uploader once that reload finishes — the remount's own mount call
 * must be absorbed too, or it loops indefinitely.
 *
 * Bugbot (round 9): absorbing *every* fresh mount unconditionally is itself wrong. A bare
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
 *
 * Bugbot (this round): round 9's `cameFromLoadingCycle` check only recognized "the tail of our own
 * reload cycle" by requiring the tab to have already been open a moment ago. It missed the far more
 * common case: opening the Media tab for the *first time* for a product whose media the page
 * already fetched independently (e.g. the operator selected a product, stayed on Content, and only
 * later clicked into Media). There, `prior.tabOpen` was `false` the whole time — indistinguishable,
 * by the old logic, from a genuine bare reopen after an absorbed mutation — so it forwarded and
 * forced a wholly unnecessary `retryMediaLoad()`, even though nothing could possibly be stale (no
 * mutation can happen before the uploader has ever been mounted for this product at all, since
 * every media mutation runs *through* this same uploader). `everMountedForProduct` tracks whether
 * the uploader has been mounted at least once for the *current* productId — reset on every genuine
 * product switch — so a truly first-ever mount is always absorbed, and the existing reopen/
 * reload-cycle distinctions only apply once there's actually been a prior mount to have missed
 * something during.
 */

export interface MediaUploaderMountGuardState {
  tabOpen: boolean;
  productId: string | null;
  eligible: boolean;
  skipNextChange: boolean;
  everMountedForProduct: boolean;
}

export const INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE: MediaUploaderMountGuardState = {
  tabOpen: false,
  productId: null,
  eligible: false,
  skipNextChange: false,
  everMountedForProduct: false,
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
  const productChanged = normalizedProductId !== prior.productId;
  // A product switch always starts a fresh slate — nothing has been mounted yet for the new
  // product, so there is no suppressed mutation for it that a later reopen would need to catch up
  // on. Tracked independently of tabOpen: it must survive across renders where the tab stays closed
  // (e.g. selecting a product while on Content), which is exactly the case round 9 got wrong.
  const everMountedForProduct = productChanged ? false : prior.everMountedForProduct;
  const next = {
    tabOpen,
    productId: normalizedProductId,
    eligible: uploaderEligibleToRender,
    everMountedForProduct,
  };
  const wasMounted = isUploaderMounted(prior);
  const nowMounted = isUploaderMounted(next);

  if (!nowMounted) {
    // Nothing mounted right now — consumeMediaUploaderChange no longer treats "not mounted" as
    // automatic proof of staleness (see its own doc comment), so this flag is what actually decides
    // whether the next callback forwards; reset it so a fresh mount transition decides it anew.
    return { ...next, skipNextChange: false };
  }

  if (wasMounted && !productChanged) {
    // Continuously mounted for the exact same product as of the prior render — no new mount and
    // no product-driven reload either, so there's nothing new to decide here.
    return { ...next, everMountedForProduct: true, skipNextChange: prior.skipNextChange };
  }

  // A fresh mount is happening this render (wasMounted was false), or the uploader stayed mounted
  // but its productId prop just changed (round-3 case: product switch while the Media tab stays
  // continuously open). Bugbot-caught (this round): if the uploader has never been mounted for this
  // exact product before, there is nothing it could have missed — every media mutation happens
  // through this same uploader, which can only run while mounted — so this first-ever mount is
  // always safe to absorb, regardless of tab-open history.
  if (!everMountedForProduct) {
    return { ...next, everMountedForProduct: true, skipNextChange: true };
  }

  // The uploader has been mounted for this product before. Only skip the resulting redundant load
  // if the page's own independent fetch is provably already covering the same data:
  //  - the product changed (the page's own product-switch effect refetches for it too), or
  //  - this is the tail of a loading cycle: the tab was already open a moment ago, so "not mounted"
  //    back then could only have meant `eligible` was false (our own retryMediaLoad()) — not a bare
  //    tab reopen, which is exactly the case that must NOT be treated as redundant.
  const cameFromLoadingCycle = !wasMounted && prior.tabOpen === tabOpen;
  const isProvablyRedundant = productChanged || cameFromLoadingCycle;
  return { ...next, everMountedForProduct: true, skipNextChange: isProvablyRedundant };
}

/**
 * Call this from the `onMediaChange`/`onHeroChange` handler itself to decide whether to forward
 * the change.
 *
 * Bugbot (this round): earlier rounds refused to forward *any* call while the uploader wasn't
 * currently mounted, on the theory that a callback arriving off-tab could only be a leftover stale
 * one. That's no longer true in general: `ProductMediaUploader` itself now only suppresses
 * `onHeroChange`/`onMediaChange` on a genuine product switch (see its own
 * `isSupersededByProductSwitch`), not on a bare unmount — so a real hero/media mutation completing
 * just after the Media tab closes still reaches here, for the product it actually happened to.
 * Refusing it unconditionally left the sticky bar, Build Meter, and readiness silently wrong until
 * the tab happened to be reopened.
 *
 * There is exactly one case where "not mounted" still reliably means "this can only be our own
 * echo": `tabOpen` is true but `eligible` is false — the operator hasn't gone anywhere, the
 * uploader is only unmounted because our own `retryMediaLoad()` flipped the page into "loading"
 * (round 6's infinite-loop case). Refuse unconditionally there, regardless of `skipNextChange`,
 * since a real operator interaction is structurally impossible while the uploader isn't rendered
 * for reasons other than the tab being closed. Every other case — including a genuine completion
 * arriving after the tab was closed outright — is carried by the one-shot `skipNextChange` computed
 * in `advanceMediaUploaderMountGuard`, which already knows how to absorb the uploader's own
 * redundant mount-triggered echoes (first-ever mount, product switch, reload-cycle tail).
 */
export function consumeMediaUploaderChange(state: MediaUploaderMountGuardState): {
  shouldForward: boolean;
  nextState: MediaUploaderMountGuardState;
} {
  if (state.productId === null) {
    return { shouldForward: false, nextState: state };
  }
  if (state.tabOpen && !state.eligible) {
    return { shouldForward: false, nextState: state };
  }
  if (state.skipNextChange) {
    return { shouldForward: false, nextState: { ...state, skipNextChange: false } };
  }
  return { shouldForward: true, nextState: state };
}
