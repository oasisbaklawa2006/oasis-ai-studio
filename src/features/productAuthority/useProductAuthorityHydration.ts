import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLatestAsyncRequest } from "./useLatestAsyncRequest";

/** A product may be catalog-ready only after BOTH current-session authorities hydrate.
 * Each lane is latest-request-wins, including A -> B -> A and unmount.
 * Starting a newer lane request immediately closes the readiness gate.
 */
export function useProductAuthorityHydration(sessionKey: string, isNew: boolean) {
  const [authorityLoaded, setAuthorityLoaded] = useState(isNew);
  const mediaDone = useRef(false);
  const channelDone = useRef(false);
  const beginMedia = useLatestAsyncRequest(sessionKey);
  const beginChannel = useLatestAsyncRequest(sessionKey);
  // A render-captured save callback must not reuse hydrated state across a
  // new product/session (including A -> B -> A) or after unmount.
  const sessionIdentity = useMemo(() => Symbol(sessionKey), [sessionKey]);
  const activeSession = useRef<symbol | null>(null);

  useLayoutEffect(() => {
    activeSession.current = sessionIdentity;
    mediaDone.current = false;
    channelDone.current = false;
    setAuthorityLoaded(isNew);
    return () => {
      if (activeSession.current === sessionIdentity) activeSession.current = null;
    };
  }, [sessionIdentity, isNew]);

  /** Synchronous source of truth for the last check immediately before writes.
   * Unlike render state, this closes instantly when a newer request starts.
   */
  const isAuthorityHydratedNow = () =>
    activeSession.current === sessionIdentity &&
    (isNew || (mediaDone.current && channelDone.current));

  const beginMediaRequest = () => {
    const owns = beginMedia();
    if (owns()) {
      mediaDone.current = false;
      setAuthorityLoaded(false);
    }
    return owns;
  };

  const beginChannelRequest = () => {
    const owns = beginChannel();
    if (owns()) {
      channelDone.current = false;
      setAuthorityLoaded(false);
    }
    return owns;
  };

  const completeMediaRequest = (owns: () => boolean) => {
    if (!owns()) return false;
    mediaDone.current = true;
    if (channelDone.current) setAuthorityLoaded(true);
    return true;
  };

  const completeChannelRequest = (owns: () => boolean) => {
    if (!owns()) return false;
    channelDone.current = true;
    if (mediaDone.current) setAuthorityLoaded(true);
    return true;
  };

  return {
    authorityLoaded,
    isAuthorityHydratedNow,
    beginMediaRequest,
    completeMediaRequest,
    beginChannelRequest,
    completeChannelRequest,
  };
}
