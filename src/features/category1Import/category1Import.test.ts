import { describe, expect, it, vi } from "vitest";
import { mapRawRowToCategory1 } from "./columnMapping";
import { parseCsvText } from "./parseFile";
import { buildCategory1DraftPayload } from "./buildDraftPayload";
import { validateCategory1Row } from "./validate";
import { detectInFileDuplicates } from "./duplicateDetection";
import { createImportLogEntry } from "./importLogService";
import type { StagedCategory1Row } from "./types";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const importLogsMissing = table === "import_logs";
      const missingError = {
        code: "PGRST205",
        message: "Could not find the table public.import_logs",
      };
      return {
        select: () =>
          importLogsMissing
            ? Promise.resolve({ data: null, error: missingError })
            : Promise.resolve({ data: [], error: null }),
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: missingError }),
          }),
        }),
      };
    },
  },
}));

describe("category1Import", () => {
  it("parses CSV with header aliases", () => {
    const rows = parseCsvText(
      "name,sku,category,mrp\nCashew Pyramid,OB-001,Baklawa,1200\n",
    );
    expect(rows).toHaveLength(1);
    const mapped = mapRawRowToCategory1(rows[0], 1, "test.csv");
    expect(mapped.product_name).toBe("Cashew Pyramid");
    expect(mapped.sku).toBe("OB-001");
    expect(mapped.category).toBe("Baklawa");
    expect(mapped.mrp).toBe(1200);
  });

  it("requires product_name and category", () => {
    const issues = validateCategory1Row(
      mapRawRowToCategory1({ sku: "X" }, 1, "f"),
    );
    expect(issues.some((i) => i.code === "missing_product_name")).toBe(true);
    expect(issues.some((i) => i.code === "missing_category")).toBe(true);
  });

  it("detects in-file duplicate SKU", () => {
    const staged: StagedCategory1Row[] = [1, 2].map((i) => {
      const row = mapRawRowToCategory1(
        { name: `Product ${i}`, sku: "DUP-1", category: "Baklawa" },
        i,
        "f",
      );
      return {
        row,
        raw: {},
        columnMappings: [],
        issues: validateCategory1Row(row),
        duplicates: [],
        canSubmit: true,
      };
    });
    const dupes = detectInFileDuplicates(staged);
    expect(dupes.length).toBe(1);
    expect(dupes[0].duplicates[0].kind).toBe("in_file_sku");
  });

  it("skips import_logs write when table is missing", async () => {
    const row = mapRawRowToCategory1({ name: "Test", category: "Baklawa" }, 1, "f.csv");
    const res = await createImportLogEntry({
      row,
      importStatus: "draft_submitted",
    });
    expect(res.skipped).toBe(true);
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/catalogue_product_drafts/);
  });

  it("builds draft payload with category1_import flag", () => {
    const row = mapRawRowToCategory1(
      { name: "Test", category: "Baklawa", sku: "T-1" },
      1,
      "batch.csv",
    );
    const payload = buildCategory1DraftPayload({
      row,
      batchId: "batch-1",
      fileName: "batch.csv",
    });
    expect(payload.category1_import).toBe(true);
    expect(payload.import_meta.batch_id).toBe("batch-1");
    expect(payload.identity.product_name).toBe("Test");
  });
});
