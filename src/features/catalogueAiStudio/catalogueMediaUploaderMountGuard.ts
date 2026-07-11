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
 */

export interface MediaUploaderMountGuardState {
  mountKey: string | null;
  skipNextChange: boolean;
}

export const INITIAL_MEDIA_UPLOADER_MOUNT_GUARD_STATE: MediaUploaderMountGuardState = {
  mountKey: null,
  skipNextChange: false,
};

/** The uploader is only mounted while the Media tab is the active tab. */
export function computeMediaUploaderMountKey(
  studioTab: string,
  productId: string | null | undefined,
): string | null {
  return studioTab === "media" ? (productId ?? null) : null;
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

/** Call this from the `onMediaChange` handler itself to decide whether to forward the change. */
export function consumeMediaUploaderChange(state: MediaUploaderMountGuardState): {
  shouldForward: boolean;
  nextState: MediaUploaderMountGuardState;
} {
  if (state.skipNextChange) {
    return { shouldForward: false, nextState: { ...state, skipNextChange: false } };
  }
  return { shouldForward: true, nextState: state };
}
