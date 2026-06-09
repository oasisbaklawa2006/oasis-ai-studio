import { supabase } from "@/integrations/supabase/client";
import type { Category1AuthorityRow } from "./types";

export async function createImportLogEntry(args: {
  row: Category1AuthorityRow;
  importStatus: string;
  warningNotes?: string | null;
  productId?: string | null;
}): Promise<{ ok: boolean; id?: string; message: string }> {
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
    return { ok: false, message: error.message };
  }

  return { ok: true, id: data?.id, message: "Import log recorded" };
}
