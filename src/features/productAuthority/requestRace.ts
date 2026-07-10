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
