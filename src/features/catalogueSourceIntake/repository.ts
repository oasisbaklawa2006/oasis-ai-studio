import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type {
  CatalogueSourceBatchRow,
  CatalogueSourceBatchStatus,
  CatalogueSourceDatabase,
  CatalogueSourceEntryInput,
  CatalogueSourceEntryRow,
  CatalogueSourceTableDefinitions,
  StageCatalogueSourceBatchInput,
} from "./types";

const intakeDb = supabase as unknown as SupabaseClient<CatalogueSourceDatabase>;
const UNIQUE_VIOLATION = "23505";
const TERMINAL_BATCH_STATUSES = new Set<CatalogueSourceBatchStatus>([
  "REVIEWED",
  "ARCHIVED",
  "FAILED",
]);

export const CATALOGUE_SOURCE_PRODUCT_CREATION_AUTHORITY = false as const;

type EntryInsert = CatalogueSourceTableDefinitions["catalogue_source_entries"]["Insert"];

function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function nullableText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

export function buildStagedEntryRows(
  batchId: string,
  entries: CatalogueSourceEntryInput[],
): EntryInsert[] {
  if (entries.length === 0) throw new Error("At least one catalogue source entry is required.");

  const seen = new Set<string>();

  return entries.map((entry, index) => {
    const sourceEntryKey = requiredText(entry.sourceEntryKey, `entries[${index}].sourceEntryKey`);
    if (seen.has(sourceEntryKey)) {
      throw new Error(`Duplicate source entry key in intake batch: ${sourceEntryKey}`);
    }
    seen.add(sourceEntryKey);

    const page = entry.sourcePageNumber ?? null;
    if (page !== null && (!Number.isInteger(page) || page <= 0)) {
      throw new Error(`entries[${index}].sourcePageNumber must be a positive integer.`);
    }

    return {
      batch_id: batchId,
      source_entry_key: sourceEntryKey,
      source_page_number: page,
      source_title: nullableText(entry.sourceTitle),
      source_sku: nullableText(entry.sourceSku),
      source_slug: nullableText(entry.sourceSlug),
      raw_source_data: entry.rawSourceData,
      candidate_product_data: entry.candidateProductData ?? {},
      matched_product_id: null,
      match_confidence: null,
      status: "STAGED",
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
    };
  });
}

function assertSameSourceIdentity(
  existing: CatalogueSourceBatchRow,
  input: StageCatalogueSourceBatchInput,
): void {
  const same =
    existing.source_provider === input.sourceProvider.trim() &&
    existing.source_document_id === nullableText(input.sourceDocumentId) &&
    existing.source_revision === nullableText(input.sourceRevision) &&
    existing.source_hash === nullableText(input.sourceHash);

  if (!same) {
    throw new Error(
      `Catalogue source dedupe key ${input.dedupeKey.trim()} already belongs to a different source identity.`,
    );
  }
}

function isTerminalBatchStatus(status: CatalogueSourceBatchStatus): boolean {
  return TERMINAL_BATCH_STATUSES.has(status);
}

/**
 * Core-authority prerequisite for true atomicity:
 * `stage_catalogue_source_batch_v1(batch, entries[], status, audit_event)` must persist
 * batch + entries + status transition + audit log in one database transaction/RPC.
 * Client-side sequencing cannot guarantee all-or-nothing semantics.
 */
export const CORE_ATOMIC_STAGE_CATALOGUE_SOURCE_BATCH_RPC =
  "stage_catalogue_source_batch_v1" as const;

async function resolveTerminalReplay(
  batch: CatalogueSourceBatchRow,
  rows: EntryInsert[],
): Promise<{ batch: CatalogueSourceBatchRow; entriesSubmitted: number } | null> {
  if (!isTerminalBatchStatus(batch.status)) return null;

  const existing = await listCatalogueSourceEntries(batch.id);
  const existingKeys = new Set(existing.map((entry) => entry.source_entry_key));
  const submittedKeys = rows.map((row) => row.source_entry_key);

  for (const key of submittedKeys) {
    if (!existingKeys.has(key)) {
      throw new Error(
        `Catalogue source batch ${batch.dedupe_key} is ${batch.status} and cannot accept new entries. Create a new revision batch instead.`,
      );
    }
  }

  return { batch, entriesSubmitted: 0 };
}

async function findBatchByDedupeKey(dedupeKey: string): Promise<CatalogueSourceBatchRow | null> {
  const { data, error } = await intakeDb
    .from("catalogue_source_batches")
    .select("*")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function listCatalogueSourceBatches(): Promise<CatalogueSourceBatchRow[]> {
  const { data, error } = await intakeDb
    .from("catalogue_source_batches")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listCatalogueSourceEntries(
  batchId: string,
): Promise<CatalogueSourceEntryRow[]> {
  const { data, error } = await intakeDb
    .from("catalogue_source_entries")
    .select("*")
    .eq("batch_id", batchId)
    .order("source_page_number", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Persist source material into AI Studio's intake surface only.
 *
 * This function intentionally has no product-master mutation path. Every imported
 * entry is forced to STAGED + matched_product_id=null regardless of source payload.
 * Replaying the same source is idempotent by batch dedupe key and source entry key.
 */
export async function stageCatalogueSourceBatch(input: StageCatalogueSourceBatchInput): Promise<{
  batch: CatalogueSourceBatchRow;
  entriesSubmitted: number;
}> {
  const sourceProvider = requiredText(input.sourceProvider, "sourceProvider");
  const sourceDocumentName = requiredText(input.sourceDocumentName, "sourceDocumentName");
  const dedupeKey = requiredText(input.dedupeKey, "dedupeKey");

  let batch: CatalogueSourceBatchRow | null = null;
  let created = false;

  const { data: inserted, error: insertError } = await intakeDb
    .from("catalogue_source_batches")
    .insert({
      source_provider: sourceProvider,
      source_document_id: nullableText(input.sourceDocumentId),
      source_document_name: sourceDocumentName,
      source_revision: nullableText(input.sourceRevision),
      source_hash: nullableText(input.sourceHash),
      dedupe_key: dedupeKey,
      status: "RECEIVED",
      source_metadata: input.sourceMetadata ?? {},
      imported_by: input.importedBy ?? null,
      completed_at: null,
    })
    .select("*")
    .single();

  if (insertError) {
    if (insertError.code !== UNIQUE_VIOLATION) throw new Error(insertError.message);
    batch = await findBatchByDedupeKey(dedupeKey);
    if (!batch) throw new Error("Catalogue source dedupe conflict could not be resolved.");
    assertSameSourceIdentity(batch, input);
  } else {
    batch = inserted;
    created = true;
  }

  const rows = buildStagedEntryRows(batch.id, input.entries);

  if (!created) {
    const terminalReplay = await resolveTerminalReplay(batch, rows);
    if (terminalReplay) return terminalReplay;
  }

  const { error: entryError } = await intakeDb.from("catalogue_source_entries").upsert(rows, {
    onConflict: "batch_id,source_entry_key",
    ignoreDuplicates: true,
  });
  if (entryError) throw new Error(entryError.message);

  let finalBatch = batch;
  if (batch.status === "RECEIVED" || batch.status === "PARSING") {
    const { data: updated, error: updateError } = await intakeDb
      .from("catalogue_source_batches")
      .update({ status: "READY_FOR_REVIEW", completed_at: new Date().toISOString() })
      .eq("id", batch.id)
      .in("status", ["RECEIVED", "PARSING"])
      .select("*")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (updated) finalBatch = updated;
  }

  const { error: auditError } = await intakeDb.from("catalogue_source_audit_log").insert({
    batch_id: batch.id,
    entry_id: null,
    action: created ? "STAGE_SOURCE_BATCH" : "REPLAY_SOURCE_BATCH",
    from_status: created ? null : batch.status,
    to_status: finalBatch.status,
    actor_id: input.importedBy ?? null,
    metadata: {
      dedupe_key: dedupeKey,
      entries_submitted: rows.length,
      product_creation_authority: false,
    },
  });
  if (auditError) throw new Error(auditError.message);

  return { batch: finalBatch, entriesSubmitted: rows.length };
}
