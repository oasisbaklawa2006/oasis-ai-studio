import { supabase } from "@/integrations/supabase/client";
import type { Category1AuthorityRow } from "./types";

let importLogsAvailability: boolean | null = null;

function isImportLogsUnavailableError(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST204" ||
    (msg.includes("import_logs") &&
      (msg.includes("does not exist") ||
        msg.includes("not found") ||
        msg.includes("could not find")))
  );
}

/** Read-only probe — cached for the session. */
export async function isImportLogsTableAvailable(): Promise<boolean> {
  if (importLogsAvailability !== null) return importLogsAvailability;

  const { error } = await supabase
    .from("import_logs")
    .select("id", { count: "exact", head: true });

  if (error && isImportLogsUnavailableError(error)) {
    importLogsAvailability = false;
    return false;
  }

  importLogsAvailability = !error;
  return importLogsAvailability;
}

export type ImportLogResult = {
  ok: boolean;
  skipped?: boolean;
  id?: string;
  message: string;
};

/**
 * Optional audit append — skipped when `import_logs` is missing on shared Supabase.
 * Draft submission does not depend on this table.
 */
export async function createImportLogEntry(args: {
  row: Category1AuthorityRow;
  importStatus: string;
  warningNotes?: string | null;
  productId?: string | null;
}): Promise<ImportLogResult> {
  const available = await isImportLogsTableAvailable();
  if (!available) {
    return {
      ok: true,
      skipped: true,
      message: "Import audit log unavailable — draft submission still recorded in catalogue_product_drafts.",
    };
  }

  const warningParts = [
    args.warningNotes,
    args.row.import_confidence ? `confidence: ${args.row.import_confidence}` : null,
  ].filter(Boolean);

  const insertRow = {
    source_document: args.row.source_document,
    source_page: args.row.source_page,
    source_pdf_sku: args.row.source_pdf_sku,
    product_name: args.row.product_name,
    pack_size: args.row.pack_size,
    product_id: args.productId ?? null,
    import_status: args.importStatus,
    warning_notes: warningParts.length ? warningParts.join(" · ") : null,
  };

  const { data, error } = await supabase
    .from("import_logs")
    .insert(insertRow)
    .select("id")
    .single();

  if (error) {
    if (isImportLogsUnavailableError(error)) {
      importLogsAvailability = false;
      return {
        ok: true,
        skipped: true,
        message: "Import audit log unavailable — draft submission still recorded in catalogue_product_drafts.",
      };
    }
    return { ok: false, message: error.message };
  }

  return { ok: true, id: data?.id, message: "Import log recorded" };
}
