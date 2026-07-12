/**
 * Latest-request-wins guard for async effects keyed by an id (route param, product id,
 * etc). Two independent staleness sources must both clear before a resolved request is
 * treated as authoritative:
 *  - `cancelled`: the effect instance that started this request has since been cleaned up
 *    (deps changed, or the component unmounted) — tracked via a closure flag set in the
 *    effect's cleanup function.
 *  - `latestId`: a newer request for a different id has since started — tracked via a ref
 *    so it reflects state *at resolution time*, not at call time.
 * A request must fail both checks to be discarded as a genuine duplicate of itself; either
 * one failing means a newer/away-navigated request has taken over and this result must not
 * mutate state.
 */
export function isCurrentAsyncRequest(
  requestId: string,
  cancelled: boolean,
  latestId: string | null,
): boolean {
  return !cancelled && latestId === requestId;
}

/**
 * Narrower than isCurrentAsyncRequest: true only when a newer request for a different id has
 * started, ignoring whether the effect instance that started this request was itself cleaned up
 * (e.g. by an unmount). Bugbot-caught (PR #84): ProductMediaUploader used the full
 * isCurrentAsyncRequest check (unmount OR id change) to decide whether to forward a completed
 * hero/media mutation to its onHeroChange/onMediaChange callbacks — but those callbacks update the
 * *parent's* state, which outlives this component's mount. Treating a bare unmount (Media tab
 * closed, product unchanged) the same as a genuine product switch meant a mutation that had
 * already succeeded in the database was silently never reported to the parent, leaving hero/
 * readiness state stale until some other refresh path happened to run. Use this for anything that
 * notifies a caller rather than this component's own local state (which should keep using
 * isCurrentAsyncRequest — there's no benefit to updating state nobody can see once the component
 * that owns it is gone).
 */
export function isSupersededById(requestId: string, latestId: string | null): boolean {
  return latestId !== requestId;
}

/**
 * Whether an id-keyed fetch effect should start a new fetch this render. When it
 * shouldn't (no id yet, a "new" placeholder route, or the id is already loaded), any
 * fetch-in-flight UI state (e.g. a "pending" flag) must be explicitly reset by the caller
 * in that same branch — an abandoned fetch for a *previous* id is not guaranteed to ever
 * resolve and clear it itself (Bugbot-caught regression: navigating away and back to an
 * already-loaded id could leave a pending flag stuck true forever, since no new fetch
 * starts to eventually flip it back to false).
 */
export function shouldFetchById(
  isNew: boolean,
  id: string | null | undefined,
  loadedId: string | null,
): boolean {
  return !isNew && !!id && loadedId !== id;
}
