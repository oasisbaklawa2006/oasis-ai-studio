import { useEffect, useState } from "react";
import { isCatalogueReviewer } from "@/shared/auth/centralPermissions";

/** Resolves catalogue reviewer RPC once on mount — shared by approval surfaces. */
export function useCatalogueReviewer() {
  const [isReviewer, setIsReviewer] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await isCatalogueReviewer();
      if (!cancelled) setIsReviewer(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { isReviewer: isReviewer === true, loading: isReviewer === null };
}
