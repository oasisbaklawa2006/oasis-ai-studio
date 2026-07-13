import type { CatalogueProductCard } from "./types";
import { getCatalogueExportProfile, type CatalogueAudience } from "./exportProfiles";
import { planCatalogueLayout } from "./catalogueLayout";
import { preflightCatalogueExport } from "./cataloguePreflight";
import { buildCatalogueFilename, type CatalogueExportMetadata } from "./catalogueMetadata";

export type CatalogueExportInput = {
  title: string;
  subtitle?: string;
  products: CatalogueProductCard[];
  audience?: CatalogueAudience;
  metadata?: Partial<CatalogueExportMetadata>;
  terms?: string[];
  contact?: {
    organisation?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
  };
};

export function prepareCatalogueExport(input: CatalogueExportInput) {
  const profile = getCatalogueExportProfile(input.audience ?? "b2b");
  const metadata: CatalogueExportMetadata = {
    version: input.metadata?.version ?? "draft",
    generatedAt: input.metadata?.generatedAt ?? new Date().toISOString(),
    generatedBy: input.metadata?.generatedBy,
    sourceCollectionId: input.metadata?.sourceCollectionId,
    sourceRevision: input.metadata?.sourceRevision,
  };
  return {
    profile,
    metadata,
    plan: planCatalogueLayout(input.products, profile),
    preflight: preflightCatalogueExport(input.products, profile),
    filename: buildCatalogueFilename({ title: input.title, audience: profile.id, metadata }),
  };
}
