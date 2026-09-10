import type { Database, Json } from "@/integrations/supabase/types";

/**
 * Catalogue source intake is deliberately separate from product master.
 *
 * These types mirror Core PR #276. A source entry can remain STAGED with no
 * product_id indefinitely. Nothing in this feature is product-creation authority.
 */
export type CatalogueSourceBatchStatus =
  | "RECEIVED"
  | "PARSING"
  | "READY_FOR_REVIEW"
  | "REVIEWED"
  | "FAILED"
  | "ARCHIVED";

export type CatalogueSourceEntryStatus =
  | "STAGED"
  | "MATCHED_EXISTING"
  | "APPROVED_FOR_DRAFT"
  | "IGNORED";

export type CatalogueSourceBatchRow = {
  id: string;
  source_provider: string;
  source_document_id: string | null;
  source_document_name: string;
  source_revision: string | null;
  source_hash: string | null;
  dedupe_key: string;
  status: CatalogueSourceBatchStatus;
  source_metadata: Json;
  imported_by: string | null;
  imported_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CatalogueSourceEntryRow = {
  id: string;
  batch_id: string;
  source_entry_key: string;
  source_page_number: number | null;
  source_title: string | null;
  source_sku: string | null;
  source_slug: string | null;
  raw_source_data: Json;
  candidate_product_data: Json;
  matched_product_id: string | null;
  match_confidence: number | null;
  status: CatalogueSourceEntryStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CatalogueSourceAuditRow = {
  id: string;
  batch_id: string;
  entry_id: string | null;
  action: string;
  from_status: string | null;
  to_status: string | null;
  actor_id: string | null;
  metadata: Json;
  created_at: string;
};

type BatchInsert = Omit<CatalogueSourceBatchRow, "id" | "imported_at" | "created_at" | "updated_at"> & {
  id?: string;
  imported_at?: string;
  created_at?: string;
  updated_at?: string;
};

type BatchUpdate = Partial<Omit<CatalogueSourceBatchRow, "id" | "created_at">>;

type EntryInsert = Omit<CatalogueSourceEntryRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

type EntryUpdate = Partial<Omit<CatalogueSourceEntryRow, "id" | "batch_id" | "created_at">>;

type AuditInsert = Omit<CatalogueSourceAuditRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type CatalogueSourceTableDefinitions = {
  catalogue_source_batches: {
    Row: CatalogueSourceBatchRow;
    Insert: BatchInsert;
    Update: BatchUpdate;
    Relationships: [];
  };
  catalogue_source_entries: {
    Row: CatalogueSourceEntryRow;
    Insert: EntryInsert;
    Update: EntryUpdate;
    Relationships: [
      {
        foreignKeyName: "catalogue_source_entries_batch_id_fkey";
        columns: ["batch_id"];
        isOneToOne: false;
        referencedRelation: "catalogue_source_batches";
        referencedColumns: ["id"];
      },
      {
        foreignKeyName: "catalogue_source_entries_matched_product_id_fkey";
        columns: ["matched_product_id"];
        isOneToOne: false;
        referencedRelation: "products";
        referencedColumns: ["id"];
      },
    ];
  };
  catalogue_source_audit_log: {
    Row: CatalogueSourceAuditRow;
    Insert: AuditInsert;
    Update: never;
    Relationships: [
      {
        foreignKeyName: "catalogue_source_audit_log_batch_id_fkey";
        columns: ["batch_id"];
        isOneToOne: false;
        referencedRelation: "catalogue_source_batches";
        referencedColumns: ["id"];
      },
      {
        foreignKeyName: "catalogue_source_audit_log_entry_id_fkey";
        columns: ["entry_id"];
        isOneToOne: false;
        referencedRelation: "catalogue_source_entries";
        referencedColumns: ["id"];
      },
    ];
  };
};

export type CatalogueSourceDatabase = Database & {
  public: Database["public"] & {
    Tables: Database["public"]["Tables"] & CatalogueSourceTableDefinitions;
  };
};

export type CatalogueSourceEntryInput = {
  sourceEntryKey: string;
  sourcePageNumber?: number | null;
  sourceTitle?: string | null;
  sourceSku?: string | null;
  sourceSlug?: string | null;
  rawSourceData: Json;
  candidateProductData?: Json;
};

export type StageCatalogueSourceBatchInput = {
  sourceProvider: string;
  sourceDocumentId?: string | null;
  sourceDocumentName: string;
  sourceRevision?: string | null;
  sourceHash?: string | null;
  dedupeKey: string;
  sourceMetadata?: Json;
  importedBy?: string | null;
  entries: CatalogueSourceEntryInput[];
};
