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
 * The guard tracks a "mount key" — the (tab-open, productId) pair the uploader is currently
 * mounted for — and arms a one-shot skip whenever that key changes, since a key change always
 * coincides with a fresh uploader mount (or a productId prop change on an already-mounted
 * uploader) about to fire its own redundant load. Only the next `onMediaChange` call after that is
 * absorbed; any call after that is a genuine post-mount mutation (upload, hero change, approval
 * submit, delete) and must still propagate.
 *
 * Bugbot round 2: ProductMediaUploader doesn't cancel its in-flight `load()` on unmount, so leaving
 * the Media tab entirely (or switching products) while a fetch is still pending lets that stale
 * callback fire anyway once it resolves — after the uploader is gone. Forwarding it would still
 * force the page's independent media state back into "loading" and flicker anchor/readiness on
 * whatever tab is now active. `consumeMediaUploaderChange` therefore also refuses to forward any
 * call while `mountKey` is null (i.e. no uploader is currently mounted at all), regardless of the
 * one-shot skip's state.
 *
 * Bugbot (post-round-4 regression): once the page started deferring the uploader's own mount until
 * its independent media fetch finishes loading (closing the hero-race in round 4), every loading
 * cycle — including the one a genuine mutation itself triggers via `retryMediaLoad()` — now
 * unmounts and remounts the uploader. `computeMediaUploaderMountKey` originally only depended on
 * (tab-open, productId), neither of which changes across that loading cycle, so the skip was never
 * re-armed for the remount's own redundant mount call — that call was forwarded, calling
 * `retryMediaLoad()` again, causing another loading cycle, another remount, and so on indefinitely.
 * The key must therefore also depend on whether the uploader is actually eligible to be rendered
 * right now (i.e. the same condition the page's JSX uses to decide whether to mount it at all) —
 * every loading→eligible transition is a real (re)mount, and must re-arm the skip exactly like a
 * tab-reopen or product-switch does.
 */

export interface MediaUploaderMountGuardState {
  mountKey: string | null;
  skipNextChange: boolean;
}

export const INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE: MediaUploaderMountGuardState = {
  mountKey: null,
  skipNextChange: false,
};

/**
 * The uploader is only mounted while the Media tab is active, a product is selected, AND it's
 * actually eligible to render right now — pass the exact same condition the page's JSX uses to
 * decide whether to mount `ProductMediaUploader` (currently: the page's own media fetch isn't
 * "loading"). Any moment this condition is false is a moment nothing is mounted; any transition
 * from false to true is a fresh (re)mount about to fire its own redundant load.
 */
export function computeMediaUploaderMountKey(
  studioTab: string,
  productId: string | null | undefined,
  uploaderEligibleToRender: boolean,
): string | null {
  return studioTab === "media" && uploaderEligibleToRender ? (productId ?? null) : null;
}

/**
 * Call this every render (before any effect can fire) with the latest mount key. A changed,
 * non-null key means the uploader is about to (re)mount for a new (tab-open, product) pair, so a
 * skip is armed for its next `onMediaChange` call.
 */
export function advanceMediaUploaderMountGuard(
  prior: MediaUploaderMountGuardState,
  mountKey: string | null,
): MediaUploaderMountGuardState {
  if (prior.mountKey === mountKey) return prior;
  return { mountKey, skipNextChange: mountKey !== null };
}

/**
 * Call this from the `onMediaChange`/`onHeroChange` handler itself to decide whether to forward
 * the change. Never forwards while no uploader is currently mounted (`mountKey === null`) — that
 * can only mean the callback is a stale one from an in-flight `load()` that outlived its unmounted
 * component, since a real operator interaction requires the uploader to still be on screen.
 */
export function consumeMediaUploaderChange(state: MediaUploaderMountGuardState): {
  shouldForward: boolean;
  nextState: MediaUploaderMountGuardState;
} {
  if (state.mountKey === null) {
    return { shouldForward: false, nextState: state };
  }
  if (state.skipNextChange) {
    return { shouldForward: false, nextState: { ...state, skipNextChange: false } };
  }
  return { shouldForward: true, nextState: state };
}
