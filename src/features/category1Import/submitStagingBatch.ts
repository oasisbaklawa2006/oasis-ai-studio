import { submitCatalogueDraft } from "@/features/catalogueDrafts/draftService";
import { buildCategory1DraftPayload } from "./buildDraftPayload";
import { createImportLogEntry, isImportLogsTableAvailable } from "./importLogService";
import type { StagedCategory1Row, SubmitBatchResult } from "./types";

export function newBatchId(): string {
  return `cat1-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Submits validated rows as catalogue_product_drafts only — never master products.
 */
export async function submitCategory1StagingBatch(args: {
  batchId: string;
  fileName: string;
  rows: StagedCategory1Row[];
}): Promise<SubmitBatchResult> {
  const importLogsEnabled = await isImportLogsTableAvailable();

  const result: SubmitBatchResult = {
    batchId: args.batchId,
    submitted: 0,
    skipped: 0,
    failed: [],
    draftIds: [],
    importLogIds: [],
    importLogsSkipped: !importLogsEnabled,
  };

  for (const entry of args.rows) {
    if (!entry.canSubmit) {
      result.skipped += 1;
      continue;
    }

    const payload = buildCategory1DraftPayload({
      row: entry.row,
      batchId: args.batchId,
      fileName: args.fileName,
    });

    const warningNotes = entry.issues
      .filter((i) => i.level === "warning")
      .map((i) => i.message)
      .join("; ");

    const draftRes = await submitCatalogueDraft({
      draftType: "product",
      operation: "create",
      payload,
      targetRecordId: null,
    });

    if (!draftRes.ok) {
      result.failed.push({ rowIndex: entry.row.rowIndex, message: draftRes.message });
      const logRes = await createImportLogEntry({
        row: entry.row,
        importStatus: "draft_submit_failed",
        warningNotes: `${warningNotes}; error: ${draftRes.message}`.trim(),
      });
      if (logRes.skipped) result.importLogsSkipped = true;
      continue;
    }

    const logRes = await createImportLogEntry({
      row: entry.row,
      importStatus: "draft_submitted",
      warningNotes: warningNotes || null,
      productId: entry.duplicates.find((d) => d.existingProductId)?.existingProductId ?? null,
    });

    if (logRes.skipped) {
      result.importLogsSkipped = true;
    } else if (logRes.ok && logRes.id) {
      result.importLogIds.push(logRes.id);
    }

    if (draftRes.draftId) {
      result.draftIds.push(draftRes.draftId);
    }

    result.submitted += 1;
  }

  return result;
}
