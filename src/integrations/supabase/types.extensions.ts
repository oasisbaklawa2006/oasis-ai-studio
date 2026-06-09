/**
 * Supplemental Database types derived from in-repo schema sources only (no live gen):
 * - supabase/migrations/20260602140000_catalogue_versions_and_sync_events.sql
 * - supabase/migrations/20260602160000_catalogue_collections_foundation.sql
 * - scripts/supabase/PR06B_draft_approval_migration.sql (draft table shape)
 */
import type { Database } from "./types";

export type CatalogueDraftRow = {
  id: string;
  source_app: string;
  target_table: string;
  target_record_id: string | null;
  operation: "create" | "update" | "delete_request";
  payload: Record<string, unknown>;
  status: "pending_approval" | "approved" | "rejected" | "cancelled";
  submitted_by: string;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CatalogueAuthorityTableDefinitions = {
  catalogue_versions: {
    Row: {
      id: string;
      product_id: string;
      sku_id: string | null;
      version_code: string;
      version_number: number;
      snapshot_json: Record<string, unknown>;
      status: string;
      approved_by: string | null;
      approved_at: string | null;
      published_at: string | null;
      synced_to_central_at: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: Partial<CatalogueAuthorityTableDefinitions["catalogue_versions"]["Row"]> & {
      product_id: string;
      version_code: string;
      version_number: number;
      snapshot_json: Record<string, unknown>;
    };
    Update: Partial<CatalogueAuthorityTableDefinitions["catalogue_versions"]["Row"]>;
    Relationships: [];
  };
  catalogue_sync_events: {
    Row: {
      id: string;
      catalogue_version_id: string;
      target_system: string;
      sync_status: string;
      payload_json: Record<string, unknown>;
      error_message: string | null;
      triggered_by: string | null;
      triggered_at: string;
    };
    Insert: Partial<CatalogueAuthorityTableDefinitions["catalogue_sync_events"]["Row"]> & {
      catalogue_version_id: string;
      payload_json: Record<string, unknown>;
    };
    Update: Partial<CatalogueAuthorityTableDefinitions["catalogue_sync_events"]["Row"]>;
    Relationships: [];
  };
  catalogue_collections: {
    Row: {
      id: string;
      title: string;
      slug: string;
      catalogue_type: string;
      channel: string | null;
      status: string;
      description: string | null;
      theme: string | null;
      created_by: string | null;
      created_at: string;
      updated_at: string;
    };
    Insert: Partial<CatalogueAuthorityTableDefinitions["catalogue_collections"]["Row"]> & {
      title: string;
      slug: string;
      catalogue_type: string;
    };
    Update: Partial<CatalogueAuthorityTableDefinitions["catalogue_collections"]["Row"]>;
    Relationships: [];
  };
  catalogue_collection_items: {
    Row: {
      id: string;
      collection_id: string;
      product_id: string;
      catalogue_version_id: string | null;
      sort_order: number;
      display_name_override: string | null;
      description_override: string | null;
      price_visibility: string;
      is_featured: boolean;
      created_at: string;
    };
    Insert: Partial<CatalogueAuthorityTableDefinitions["catalogue_collection_items"]["Row"]> & {
      collection_id: string;
      product_id: string;
    };
    Update: Partial<CatalogueAuthorityTableDefinitions["catalogue_collection_items"]["Row"]>;
    Relationships: [];
  };
  catalogue_share_links: {
    Row: {
      id: string;
      collection_id: string;
      share_token: string;
      share_type: string;
      status: string;
      expires_at: string | null;
      created_at: string;
    };
    Insert: Partial<CatalogueAuthorityTableDefinitions["catalogue_share_links"]["Row"]> & {
      collection_id: string;
      share_token: string;
    };
    Update: Partial<CatalogueAuthorityTableDefinitions["catalogue_share_links"]["Row"]>;
    Relationships: [];
  };
  catalogue_product_drafts: { Row: CatalogueDraftRow; Insert: Partial<CatalogueDraftRow>; Update: Partial<CatalogueDraftRow>; Relationships: [] };
  catalogue_media_submissions: { Row: CatalogueDraftRow; Insert: Partial<CatalogueDraftRow>; Update: Partial<CatalogueDraftRow>; Relationships: [] };
  catalogue_alias_drafts: { Row: CatalogueDraftRow; Insert: Partial<CatalogueDraftRow>; Update: Partial<CatalogueDraftRow>; Relationships: [] };
  catalogue_bom_drafts: { Row: CatalogueDraftRow; Insert: Partial<CatalogueDraftRow>; Update: Partial<CatalogueDraftRow>; Relationships: [] };
  catalogue_moq_drafts: { Row: CatalogueDraftRow; Insert: Partial<CatalogueDraftRow>; Update: Partial<CatalogueDraftRow>; Relationships: [] };
  catalogue_pricing_drafts: { Row: CatalogueDraftRow; Insert: Partial<CatalogueDraftRow>; Update: Partial<CatalogueDraftRow>; Relationships: [] };
  catalogue_tag_drafts: { Row: CatalogueDraftRow; Insert: Partial<CatalogueDraftRow>; Update: Partial<CatalogueDraftRow>; Relationships: [] };
};

export type ExtendedDatabase = Database & {
  public: Database["public"] & {
    Tables: Database["public"]["Tables"] & CatalogueAuthorityTableDefinitions;
  };
};

/** Refreshed-at marker for audit trail (in-repo migration sources). */
export const CATALOGUE_AUTHORITY_TYPES_REFRESHED_AT = "2026-06-09";
