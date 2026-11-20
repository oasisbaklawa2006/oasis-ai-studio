import { useLayoutEffect, useRef } from "react";

/**
 * Latest-request-wins for asynchronous authority loads.
 * Both the product/navigation session and the request generation must match.
 * Callers captured by an older render cannot start work in a newer session.
 */
export function useLatestAsyncRequest(sessionKey: string) {
  const currentSession = useRef<{ key: string; token: symbol } | null>(null);
  const latestRequest = useRef<symbol | null>(null);

  useLayoutEffect(() => {
    currentSession.current = { key: sessionKey, token: Symbol("authority-session") };
    latestRequest.current = null;
    return () => {
      currentSession.current = null;
      latestRequest.current = null;
    };
  }, [sessionKey]);

  return () => {
    const session = currentSession.current;
    if (!session || session.key !== sessionKey) return () => false;
    const token = Symbol("authority-request");
    latestRequest.current = token;
    return () => currentSession.current === session && latestRequest.current === token;
  };
}
