import { useLayoutEffect, useRef, useState } from "react";
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: a navigation-session change intentionally invalidates both hydration lanes, even though sessionKey is not read inside the effect.
  useLayoutEffect(() => {
    mediaDone.current = false;
    channelDone.current = false;
    setAuthorityLoaded(isNew);
  }, [sessionKey, isNew]);

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
    beginMediaRequest,
    completeMediaRequest,
    beginChannelRequest,
    completeChannelRequest,
  };
}
