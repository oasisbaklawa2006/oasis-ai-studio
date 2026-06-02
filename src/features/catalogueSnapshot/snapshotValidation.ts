import type { ProductReadinessResult } from "@/features/productTruth/productReadiness";
import type { ReadinessBadge, ReadinessDimension } from "@/features/productTruth/types";
import type { CatalogueSnapshotJson } from "./types";

export type SnapshotValidationResult = {
  allowed: boolean;
  blockers: string[];
};

const APPROVED_LIKE_BADGES: ReadinessBadge[] = [
  "approved",
  "human_edited",
  "locked",
  "published",
];

const GATE_DIMENSIONS: { dimension: ReadinessDimension; label: string }[] = [
  { dimension: "content_status", label: "Content" },
  { dimension: "media_status", label: "Media" },
  { dimension: "pricing_status", label: "Pricing" },
  { dimension: "uom_status", label: "UOM" },
  { dimension: "packaging_status", label: "Packaging" },
  { dimension: "compliance_status", label: "Compliance" },
  { dimension: "production_mapping_status", label: "Production mapping" },
];

function dimensionApproved(
  readiness: ProductReadinessResult,
  dimension: ReadinessDimension,
): boolean {
  const row = readiness.dimensions.find((d) => d.dimension === dimension);
  if (!row?.complete) return false;
  return APPROVED_LIKE_BADGES.includes(row.badge);
}

export function validateSnapshotMediaGate(snapshot: CatalogueSnapshotJson): string[] {
  const blockers: string[] = [];
  if (snapshot.media.can_sync_media_to_central === false) {
    blockers.push("Media not ready for Central sync");
    for (const b of snapshot.media.media_readiness_blockers ?? []) {
      blockers.push(b);
    }
  }
  if (!snapshot.media.approved_image_urls.length) {
    blockers.push("No approved media URLs for Central payload");
  }
  return blockers;
}

/**
 * Blocks snapshot / Central preview unless all Product Truth dimensions are approved
 * and ready_for_central_sync is true.
 */
export function validateSnapshotGate(
  readiness: ProductReadinessResult,
  opts: { complianceManuallyApproved: boolean },
): SnapshotValidationResult {
  const blockers: string[] = [];

  for (const { dimension, label } of GATE_DIMENSIONS) {
    if (!dimensionApproved(readiness, dimension)) {
      const row = readiness.dimensions.find((d) => d.dimension === dimension);
      blockers.push(
        row?.note ? `${label}: ${row.note}` : `${label} not approved`,
      );
    }
  }

  if (!opts.complianceManuallyApproved) {
    blockers.push("GST/HSN require manual compliance approval");
  }

  if (!readiness.readyForCentralSync) {
    for (const b of readiness.blockers) {
      if (!blockers.some((x) => x.toLowerCase().includes(b.toLowerCase().slice(0, 12)))) {
        blockers.push(b);
      }
    }
    if (!blockers.length) {
      blockers.push("Product not ready for Central sync");
    }
  }

  const unique = Array.from(new Set(blockers));
  return {
    allowed: unique.length === 0,
    blockers: unique,
  };
}

export function validateSnapshotGateWithMedia(
  readiness: ProductReadinessResult,
  snapshot: CatalogueSnapshotJson,
  opts: { complianceManuallyApproved: boolean },
): SnapshotValidationResult {
  const base = validateSnapshotGate(readiness, opts);
  const mediaBlockers = validateSnapshotMediaGate(snapshot);
  const blockers = Array.from(new Set([...base.blockers, ...mediaBlockers]));
  return { allowed: blockers.length === 0, blockers };
}
