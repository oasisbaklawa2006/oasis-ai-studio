import { loadRuntimeCatalog } from "../runtime/catalogLexicon";
import { PHASE2A_FIXTURE_CATALOG } from "../runtime/fixtures/phase2aCatalog";
import { PRODUCTION_SNAPSHOT_CATALOG } from "../runtime/fixtures/productionSnapshotCatalog";
import type { RuntimeCatalog } from "../runtime/types";

export type KnowledgeCatalogMode = "live" | "phase2a_fixture" | "production_fixture";

export type KnowledgeCatalogLoadResult = {
  mode: KnowledgeCatalogMode;
  catalog: RuntimeCatalog;
  label: string;
  isFixture: boolean;
};

export function catalogModeLabel(mode: KnowledgeCatalogMode): string {
  switch (mode) {
    case "live":
      return "Live canonical product catalogue (read-only Supabase)";
    case "phase2a_fixture":
      return "Phase 2A regression fixture corpus (tests only)";
    case "production_fixture":
      return "Production-shaped regression fixture corpus (tests only)";
  }
}

export function loadFixtureCatalog(mode: Exclude<KnowledgeCatalogMode, "live">): RuntimeCatalog {
  return mode === "production_fixture" ? PRODUCTION_SNAPSHOT_CATALOG : PHASE2A_FIXTURE_CATALOG;
}

export async function loadKnowledgeCatalog(mode: KnowledgeCatalogMode): Promise<KnowledgeCatalogLoadResult> {
  if (mode !== "live") {
    const catalog = loadFixtureCatalog(mode);
    return {
      mode,
      catalog,
      label: catalogModeLabel(mode),
      isFixture: true,
    };
  }

  const loaded = await loadRuntimeCatalog();
  const catalog: RuntimeCatalog = {
    products: loaded.products.filter((product) => product.is_active !== false),
    aliases: loaded.aliases,
  };
  return {
    mode: "live",
    catalog,
    label: catalogModeLabel("live"),
    isFixture: false,
  };
}
