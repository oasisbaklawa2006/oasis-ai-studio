import type { ProductReadinessResult } from "@/features/productTruth/productReadiness";
import type { SnapshotLanguageIntelligence } from "@/features/productIntelligence/types";
import type {
  ChannelMoqRule,
  ChannelPriceRecord,
  PackagingHierarchy,
} from "@/features/productTruth/types";

export type CatalogueVersionStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "published"
  | "synced";

export const IMMUTABLE_VERSION_STATUSES: CatalogueVersionStatus[] = [
  "approved",
  "published",
  "synced",
];

export type CatalogueVersionRow = {
  id: string;
  product_id: string;
  sku_id: string | null;
  version_code: string;
  version_number: number;
  snapshot_json: CatalogueSnapshotJson;
  status: CatalogueVersionStatus;
  approved_by: string | null;
  approved_at: string | null;
  published_at: string | null;
  synced_to_central_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GstClassificationStatus = "approved" | "manual_review_required";

export type CatalogueSnapshotJson = {
  generated_at: string;
  catalogue_product_id: string;
  catalogue_sku_id: string | null;
  identity: {
    sku: string | null;
    legacy_skus: string[];
    code: string | null;
    name: string;
    display_name: string | null;
    category: string | null;
    subcategory: string | null;
    division: string | null;
    description: string | null;
  };
  readiness: ProductReadinessResult;
  compliance: {
    status: string;
    gst_classification_status: GstClassificationStatus;
    gst_hsn: string | null;
    gst_rate: string | number | null;
    ingredients: string | null;
    allergen_warnings: string | null;
    manually_approved: boolean;
  };
  uom_conversion_rules: PackagingHierarchy & Record<string, unknown>;
  packaging_hierarchy: {
    primary_pack: Record<string, unknown>;
    master_carton: Record<string, unknown>;
  };
  channel_rules: ChannelMoqRule[];
  pricing_rules: ChannelPriceRecord[];
  media: {
    hero_image_url: string | null;
    approved_image_urls: string[];
    media_status: string | null;
    requirements: string[];
    media_readiness_blockers?: string[];
    can_sync_media_to_central?: boolean;
  };
  fulfillment_transform: Record<string, unknown>;
  /** Product Intelligence — read-only until product_language_terms schema ships. */
  language_intelligence: SnapshotLanguageIntelligence;
  /** Durable search aliases from product_aliases (preview / downstream discoverability). */
  product_aliases?: Array<{
    alias: string;
    alias_type?: string | null;
    source?: string | null;
  }>;
  synced_at: string | null;
  ready_for_central_sync: boolean;
};

/**
 * Canonical wire envelope emitted by the server-side publication RPC.
 * Central-owned IDs are deliberately absent from the approved catalogue snapshot;
 * the optional target reference only records an already-known target mapping.
 */
export type CataloguePublicationEnvelopeV1 = {
  schema_version: "oasis.catalogue.publication.v1";
  publication_id: string;
  published_at: string;
  target_system: string;
  source: {
    catalogue_version_id: string;
    product_id: string;
    version_number: number;
    version_code: string;
    content_sha256: string;
    approved_at: string;
  };
  mapping: {
    shared_product_id: string;
    sku: string;
    external_target_product_ref: string | null;
  };
  catalogue: CatalogueSnapshotJson;
};

export type CentralSyncPreviewBundle = {
  preview_only: true;
  no_live_central_write: true;
  connector: "catalogue-publication-v1";
  publication_envelope: CataloguePublicationEnvelopeV1;
  full_snapshot: CatalogueSnapshotJson;
  catalogue_version_id: string;
  catalogue_version_code: string;
  catalogue_version_number: number;
  validation: {
    allowed: boolean;
    blockers: string[];
  };
};

export type CatalogueSyncEventRow = {
  id: string;
  catalogue_version_id: string;
  target_system: string;
  sync_status: "preview_only" | "pending" | "success" | "failed";
  payload_json: CentralSyncPreviewBundle;
  error_message: string | null;
  triggered_by: string | null;
  triggered_at: string;
};

export type SnapshotGeneratorInput = {
  form: Record<string, unknown>;
  productId: string;
  complianceApproved: boolean;
  complianceMetaPending?: boolean;
  prices?: ChannelPriceRecord[];
  moqRules?: ChannelMoqRule[];
  productMediaRows?: import("@/features/mediaReadiness/mediaAssetsFromForm").ProductMediaRow[];
  approvedBy?: string | null;
  /** Optional alias rows for language_intelligence section (read-only preview). */
  languageAliasRows?: Array<{
    id: string;
    alias_text?: string | null;
    alias?: string | null;
    product_id?: string | null;
    canonical_name?: string | null;
    alias_type?: string | null;
  }>;
};
