import { useLayoutEffect, useRef } from "react";

/** A save owns completion effects only within the navigation session that started it. */
export function useSaveRequestOwner(sessionKey: string) {
  const session = useRef<symbol | null>(null);
  const activeRequest = useRef<symbol | null>(null);
  useLayoutEffect(() => {
    session.current = Symbol(sessionKey);
    activeRequest.current = null;
    return () => {
      session.current = null;
      activeRequest.current = null;
    };
  }, [sessionKey]);

  return () => {
    if (!session.current || activeRequest.current) return null;
    const ownerSession = session.current;
    const request = Symbol("save");
    activeRequest.current = request;
    const isCurrent = () => session.current === ownerSession && activeRequest.current === request;
    return {
      isCurrent,
      release: () => {
        if (isCurrent()) activeRequest.current = null;
      },
    };
  };
}
