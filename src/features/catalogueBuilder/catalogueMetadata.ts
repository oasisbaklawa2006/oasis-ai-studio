import type { CatalogueAudience } from "./exportProfiles";

export type CatalogueExportMetadata = {
  version: string;
  generatedAt: string;
  generatedBy?: string;
  sourceCollectionId?: string;
  sourceRevision?: string;
};

export function normaliseCatalogueVersion(value?: string) {
  const clean = value?.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
  return clean || "draft";
}

export function buildCatalogueFilename(args: {
  title: string;
  audience: CatalogueAudience;
  metadata: CatalogueExportMetadata;
}) {
  const slug = args.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "catalogue";
  const date = args.metadata.generatedAt.slice(0, 10);
  return `${slug}-${args.audience}-${normaliseCatalogueVersion(args.metadata.version)}-${date}.pdf`;
}

export function buildProvenanceLine(metadata: CatalogueExportMetadata) {
  const parts = [`Version ${normaliseCatalogueVersion(metadata.version)}`, `Generated ${metadata.generatedAt}`];
  if (metadata.sourceCollectionId) parts.push(`Collection ${metadata.sourceCollectionId}`);
  if (metadata.sourceRevision) parts.push(`Revision ${metadata.sourceRevision}`);
  return parts.join(" · ");
}
