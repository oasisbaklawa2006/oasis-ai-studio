import { useLayoutEffect, useMemo, useRef } from "react";

/**
 * Latest-request-wins for asynchronous authority loads.
 * Both the product/navigation session and request generation must match.
 * A stale callback captured on A cannot revive after A -> B -> A.
 */
export function useLatestAsyncRequest(sessionKey: string) {
  // A fresh identity is created after every session-key transition, even when
  // navigation later returns to the same product and key string.
  const sessionIdentity = useMemo(() => Symbol(sessionKey), [sessionKey]);
  const currentSession = useRef<symbol | null>(null);
  const latestRequest = useRef<symbol | null>(null);

  useLayoutEffect(() => {
    currentSession.current = sessionIdentity;
    latestRequest.current = null;
    return () => {
      if (currentSession.current === sessionIdentity) {
        currentSession.current = null;
        latestRequest.current = null;
      }
    };
  }, [sessionIdentity]);

  return () => {
    if (currentSession.current !== sessionIdentity) return () => false;
    const token = Symbol("authority-request");
    latestRequest.current = token;
    return () => currentSession.current === sessionIdentity && latestRequest.current === token;
  };
}
