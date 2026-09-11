import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { ExtendedDatabase } from "@/integrations/supabase/types.extensions";
import type {
  CatalogueSourceBatchRow,
  CatalogueSourceEntryRow,
  StageCatalogueSourceBatchInput,
} from "./types";

const intakeDb = supabase as unknown as SupabaseClient<ExtendedDatabase>;

export const CATALOGUE_SOURCE_PRODUCT_CREATION_AUTHORITY = false as const;

export const CORE_ATOMIC_STAGE_CATALOGUE_SOURCE_BATCH_RPC =
  "stage_catalogue_source_batch_v1" as const;

type StageCatalogueSourceBatchRpcPayload = {
  source_provider: string;
  source_document_name: string;
  source_document_id: string | null;
  source_revision: string | null;
  source_hash: string | null;
  dedupe_key: string;
  source_metadata: Record<string, unknown>;
  imported_by: string | null;
  entries: Array<{
    source_entry_key: string;
    source_page_number?: number | null;
    source_title?: string | null;
    source_sku?: string | null;
    source_slug?: string | null;
    raw_source_data: Record<string, unknown>;
    candidate_product_data?: Record<string, unknown>;
  }>;
};

type StageCatalogueSourceBatchRpcResult = {
  batch: CatalogueSourceBatchRow;
  entries_submitted: number;
  created: boolean;
};

function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function nullableText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

export function buildStageCatalogueSourceRpcPayload(
  input: StageCatalogueSourceBatchInput,
): StageCatalogueSourceBatchRpcPayload {
  if (input.entries.length === 0) {
    throw new Error("At least one catalogue source entry is required.");
  }
  if (input.entries.length > 500) {
    throw new Error("One intake submission is limited to 500 staged entries.");
  }

  const seen = new Set<string>();
  const entries = input.entries.map((entry, index) => {
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
      source_entry_key: sourceEntryKey,
      ...(page === undefined ? {} : { source_page_number: page }),
      ...(entry.sourceTitle === undefined ? {} : { source_title: nullableText(entry.sourceTitle) }),
      ...(entry.sourceSku === undefined ? {} : { source_sku: nullableText(entry.sourceSku) }),
      ...(entry.sourceSlug === undefined ? {} : { source_slug: nullableText(entry.sourceSlug) }),
      raw_source_data: entry.rawSourceData as Record<string, unknown>,
      ...(entry.candidateProductData === undefined
        ? {}
        : { candidate_product_data: entry.candidateProductData as Record<string, unknown> }),
    };
  });

  return {
    source_provider: requiredText(input.sourceProvider, "sourceProvider"),
    source_document_name: requiredText(input.sourceDocumentName, "sourceDocumentName"),
    source_document_id: nullableText(input.sourceDocumentId),
    source_revision: nullableText(input.sourceRevision),
    source_hash: nullableText(input.sourceHash),
    dedupe_key: requiredText(input.dedupeKey, "dedupeKey"),
    source_metadata: (input.sourceMetadata as Record<string, unknown> | undefined) ?? {},
    imported_by: input.importedBy ?? null,
    entries,
  };
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
 * Persist source material through Core's atomic staging RPC only.
 *
 * This function intentionally has no product-master mutation path. Every imported
 * entry is forced to STAGED + matched_product_id=null regardless of source payload.
 */
export async function stageCatalogueSourceBatch(input: StageCatalogueSourceBatchInput): Promise<{
  batch: CatalogueSourceBatchRow;
  entriesSubmitted: number;
}> {
  const payload = buildStageCatalogueSourceRpcPayload(input);

  const { data, error } = await intakeDb.rpc(CORE_ATOMIC_STAGE_CATALOGUE_SOURCE_BATCH_RPC, {
    p_payload: payload,
  });

  if (error) {
    if (error.message.includes("Could not find the function")) {
      throw new Error(
        `${CORE_ATOMIC_STAGE_CATALOGUE_SOURCE_BATCH_RPC} is not deployed yet. Merge and protected-deploy Core catalogue source atomic staging before using this workspace.`,
      );
    }
    throw new Error(error.message);
  }

  const result = data as StageCatalogueSourceBatchRpcResult | null;
  if (!result?.batch) {
    throw new Error("Catalogue source staging returned an invalid RPC response.");
  }

  return {
    batch: result.batch,
    entriesSubmitted: result.entries_submitted,
  };
}
