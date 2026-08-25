import { useEffect, useRef, useState } from "react";
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
  const loadGenerationRef = useRef(0);

  useEffect(() => {
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    setCatalogLoad(null);
    setCatalogError(null);
    setCatalogLabel(catalogModeLabel(catalogMode));
    void loadKnowledgeCatalog(catalogMode)
      .then((loaded) => {
        if (loadGenerationRef.current !== generation) return;
        setCatalogLoad(loaded);
        setCatalogLabel(loaded.label);
      })
      .catch((error) => {
        if (loadGenerationRef.current !== generation) return;
        setCatalogLoad(null);
        setCatalogError(error instanceof Error ? error.message : String(error));
      });
  }, [catalogMode]);

  return { catalogLoad, catalogLabel, catalogError };
}
