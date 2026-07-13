import { canonicalPublicationJson, sha256Hex } from "./publicationHash";
import type {
  CataloguePublicationEnvelopeV1,
  CatalogueSnapshotJson,
  CentralSyncPreviewBundle,
} from "./types";
import type { SnapshotValidationResult } from "./snapshotValidation";

export const LIVE_CENTRAL_WRITE_ENABLED = false;

export function validateCataloguePublicationEnvelope(
  payload: CataloguePublicationEnvelopeV1,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (payload.schema_version !== "oasis.catalogue.publication.v1") errors.push("schema_version is invalid");
  if (!payload.publication_id) errors.push("publication_id is required");
  if (!payload.target_system?.trim()) errors.push("target_system is required");
  if (!payload.published_at || Number.isNaN(Date.parse(payload.published_at))) errors.push("published_at must be an ISO timestamp");
  if (!payload.source.catalogue_version_id) errors.push("source.catalogue_version_id is required");
  if (!payload.source.product_id) errors.push("source.product_id is required");
  if (!Number.isInteger(payload.source.version_number) || payload.source.version_number < 1) errors.push("source.version_number must be positive");
  if (!payload.source.version_code?.trim()) errors.push("source.version_code is required");
  if (!/^[a-f0-9]{64}$/i.test(payload.source.content_sha256)) errors.push("source.content_sha256 must be a SHA-256 hex digest");
  if (!payload.source.approved_at || Number.isNaN(Date.parse(payload.source.approved_at))) errors.push("source.approved_at must be an ISO timestamp");
  if (payload.mapping.shared_product_id !== payload.source.product_id) errors.push("mapping.shared_product_id must match source.product_id");
  if (!payload.mapping.sku?.trim()) errors.push("mapping.sku is required");
  if (payload.catalogue.catalogue_product_id !== payload.source.product_id) errors.push("catalogue product identity does not match source.product_id");
  return { valid: errors.length === 0, errors };
}

export async function buildCataloguePublicationEnvelopePreview(args: {
  snapshot: CatalogueSnapshotJson;
  catalogueVersionId: string;
  versionCode: string;
  versionNumber: number;
  approvedAt?: string;
}): Promise<CataloguePublicationEnvelopeV1> {
  const contentSha256 = await sha256Hex(canonicalPublicationJson(args.snapshot));
  return {
    schema_version: "oasis.catalogue.publication.v1",
    publication_id: crypto.randomUUID(),
    published_at: new Date().toISOString(),
    target_system: "oasis_central",
    source: {
      catalogue_version_id: args.catalogueVersionId,
      product_id: args.snapshot.catalogue_product_id,
      version_number: args.versionNumber,
      version_code: args.versionCode,
      content_sha256: contentSha256,
      approved_at: args.approvedAt ?? new Date().toISOString(),
    },
    mapping: {
      shared_product_id: args.snapshot.catalogue_product_id,
      sku: args.snapshot.identity.sku?.trim() ?? "",
      external_target_product_ref: null,
    },
    catalogue: args.snapshot,
  };
}

export async function buildCentralSyncPreviewBundle(args: {
  snapshot: CatalogueSnapshotJson;
  catalogueVersionId: string;
  versionCode: string;
  versionNumber: number;
  validation: SnapshotValidationResult;
}): Promise<CentralSyncPreviewBundle> {
  const envelope = await buildCataloguePublicationEnvelopePreview({
    snapshot: args.snapshot,
    catalogueVersionId: args.catalogueVersionId,
    versionCode: args.versionCode,
    versionNumber: args.versionNumber,
  });
  const shapeCheck = validateCataloguePublicationEnvelope(envelope);
  const validation = {
    allowed: args.validation.allowed && shapeCheck.valid,
    blockers: [...args.validation.blockers, ...shapeCheck.errors.map((error) => `Central payload: ${error}`)],
  };
  return {
    preview_only: true,
    no_live_central_write: true,
    connector: "catalogue-publication-v1",
    publication_envelope: envelope,
    full_snapshot: args.snapshot,
    catalogue_version_id: args.catalogueVersionId,
    catalogue_version_code: args.versionCode,
    catalogue_version_number: args.versionNumber,
    validation,
  };
}

export const isStaleCatalogueVersion = (candidate: number, current: number) => candidate < current;
export const isNewerCatalogueVersion = (candidate: number, current: number) => candidate > current;
