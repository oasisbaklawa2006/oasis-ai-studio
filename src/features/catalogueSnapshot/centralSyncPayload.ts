import { getChannelPrice } from "@/features/productTruth/channelPricingMoqEngine";
import type {
  ApprovedCatalogueProductSnapshot,
  CatalogueSnapshotJson,
  CentralSyncPreviewBundle,
} from "./types";
import type { SnapshotValidationResult } from "./snapshotValidation";

export const LIVE_CENTRAL_WRITE_ENABLED = false;

export function validateApprovedCatalogueProductSnapshot(
  payload: ApprovedCatalogueProductSnapshot,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!payload.external_catalogue_product_id) {
    errors.push("external_catalogue_product_id is required");
  }
  if (!payload.name?.trim()) {
    errors.push("name is required");
  }
  if (!payload.version?.trim()) {
    errors.push("version is required");
  }
  if (!payload.updated_at) {
    errors.push("updated_at is required");
  }
  if (
    payload.gst_classification_status === "manual_review_required" &&
    (payload.gst_hsn != null || payload.gst_rate != null)
  ) {
    errors.push("gst_hsn and gst_rate must be null when manual_review_required");
  }
  return { valid: errors.length === 0, errors };
}

export function buildApprovedCatalogueProductSnapshot(
  snapshot: CatalogueSnapshotJson,
  versionCode: string,
): ApprovedCatalogueProductSnapshot {
  const retailPrice = getChannelPrice(snapshot.pricing_rules, "retail");
  const mrp = retailPrice?.mrp ?? retailPrice?.sellingPrice ?? null;
  const basePrice = retailPrice?.sellingPrice ?? retailPrice?.mrp ?? null;

  const packParts: string[] = [];
  const pp = snapshot.packaging_hierarchy.primary_pack;
  if (pp?.qty_per_pack && pp?.uom) {
    packParts.push(`${pp.qty_per_pack} ${pp.uom}`);
  }
  if (pp?.type) packParts.push(String(pp.type));

  const weightG =
    snapshot.uom_conversion_rules.gramsPerPiece != null
      ? Number(snapshot.uom_conversion_rules.gramsPerPiece)
      : snapshot.fulfillment_transform.approximate_piece_weight_g != null
        ? Number(snapshot.fulfillment_transform.approximate_piece_weight_g)
        : null;

  const compliance = snapshot.compliance;

  return {
    external_catalogue_product_id: snapshot.catalogue_product_id,
    central_product_id: null,
    sku: snapshot.identity.sku,
    name: snapshot.identity.name,
    description: snapshot.identity.description,
    approved_image_urls: snapshot.media.approved_image_urls,
    mrp: mrp != null ? Number(mrp) : null,
    base_price: basePrice != null ? Number(basePrice) : null,
    pack_size: packParts.length ? packParts.join(" · ") : null,
    net_weight_g: weightG,
    category: snapshot.identity.category,
    gst_classification_status: compliance.gst_classification_status,
    gst_hsn: compliance.gst_hsn,
    gst_rate: compliance.gst_rate,
    uom:
      (snapshot.uom_conversion_rules as { primary_uom?: string | null }).primary_uom ??
      null,
    barcode_sku: snapshot.identity.sku,
    is_active: true,
    version: versionCode,
    updated_at: snapshot.generated_at,
  };
}

export function buildCentralSyncPreviewBundle(args: {
  snapshot: CatalogueSnapshotJson;
  catalogueVersionId: string;
  versionCode: string;
  versionNumber: number;
  validation: SnapshotValidationResult;
}): CentralSyncPreviewBundle {
  const approved = buildApprovedCatalogueProductSnapshot(args.snapshot, args.versionCode);
  const shapeCheck = validateApprovedCatalogueProductSnapshot(approved);

  const validation = {
    allowed: args.validation.allowed && shapeCheck.valid,
    blockers: [
      ...args.validation.blockers,
      ...shapeCheck.errors.map((e) => `Central payload: ${e}`),
    ],
  };

  return {
    preview_only: true,
    no_live_central_write: true,
    connector: "25B/25C",
    approved_catalogue_product_snapshot: approved,
    full_snapshot: args.snapshot,
    catalogue_version_id: args.catalogueVersionId,
    catalogue_version_code: args.versionCode,
    catalogue_version_number: args.versionNumber,
    validation,
  };
}

/** Returns true when candidate is strictly older than the current head version. */
export function isStaleCatalogueVersion(
  candidateVersionNumber: number,
  currentHeadVersionNumber: number,
): boolean {
  return candidateVersionNumber < currentHeadVersionNumber;
}

export function isNewerCatalogueVersion(
  candidateVersionNumber: number,
  currentHeadVersionNumber: number,
): boolean {
  return candidateVersionNumber > currentHeadVersionNumber;
}
