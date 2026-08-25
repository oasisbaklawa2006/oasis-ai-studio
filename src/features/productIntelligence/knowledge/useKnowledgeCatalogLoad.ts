import { useEffect, useState } from "react";
import {
  catalogModeLabel,
  type KnowledgeCatalogLoadResult,
  type KnowledgeCatalogMode,
  loadKnowledgeCatalog,
} from "./knowledgeCatalogSource";

export function useKnowledgeCatalogLoad(catalogMode: KnowledgeCatalogMode) {
  const [catalogLoad, setCatalogLoad] = useState<KnowledgeCatalogLoadResult | null>(null);
  const [catalogLabel, setCatalogLabel] = useState("Loading catalogue…");
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogLoad(null);
    setCatalogError(null);
    setCatalogLabel(catalogModeLabel(catalogMode));
    void loadKnowledgeCatalog(catalogMode)
      .then((loaded) => {
        if (controller.signal.aborted) return;
        setCatalogLoad(loaded);
        setCatalogLabel(loaded.label);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setCatalogLoad(null);
        setCatalogError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      controller.abort();
    };
  }, [catalogMode]);

  return { catalogLoad, catalogLabel, catalogError };
}
