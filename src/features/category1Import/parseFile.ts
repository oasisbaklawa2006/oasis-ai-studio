import { buildColumnMappings, mapRawRowToCategory1 } from "./columnMapping";
import { detectInFileDuplicates } from "./duplicateDetection";
import type { ParseFileResult, StagedCategory1Row } from "./types";
import { validateCategory1Row } from "./validate";

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

export function parseCsvText(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = cells[idx] ?? "";
    });
    return row;
  });
}

export function parseJsonText(text: string): Record<string, string>[] {
  const parsed = JSON.parse(text) as unknown;
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { rows?: unknown }).rows)
      ? (parsed as { rows: unknown[] }).rows
      : null;

  if (!rows) {
    throw new Error("JSON must be an array of objects or { rows: [...] }");
  }

  return rows.map((row) => {
    if (!row || typeof row !== "object") return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      out[k] = v == null ? "" : String(v);
    }
    return out;
  });
}

function stageRows(
  rawRows: Record<string, string>[],
  fileName: string,
  format: "csv" | "json",
): StagedCategory1Row[] {
  const sourceDocument = fileName.replace(/\.[^.]+$/, "");
  const staged: StagedCategory1Row[] = rawRows.map((raw, idx) => {
    const row = mapRawRowToCategory1(raw, idx + 1, sourceDocument);
    const issues = validateCategory1Row(row);
    return {
      row,
      raw,
      columnMappings: buildColumnMappings(raw),
      issues,
      duplicates: [],
      canSubmit: false,
    };
  });

  const dupes = detectInFileDuplicates(staged);
  for (const entry of dupes) {
    const target = staged.find((s) => s.row.rowIndex === entry.rowIndex);
    if (!target) continue;
    target.duplicates.push(...entry.duplicates);
    if (entry.duplicates.some((d) => d.kind.startsWith("in_file"))) {
      target.issues.push({
        level: "error",
        code: "duplicate_in_file",
        message: `Duplicate in file: ${entry.duplicates.map((d) => d.matchedValue).join(", ")}`,
      });
    }
  }

  for (const s of staged) {
    s.canSubmit = !s.issues.some((i) => i.level === "error");
  }

  return staged;
}

export function parseCategory1File(file: File, text: string): ParseFileResult {
  const lower = file.name.toLowerCase();
  const format: "csv" | "json" = lower.endsWith(".json") ? "json" : "csv";
  const rawRows = format === "json" ? parseJsonText(text) : parseCsvText(text);

  if (!rawRows.length) {
    throw new Error("No data rows found in file");
  }

  return {
    format,
    fileName: file.name,
    sourceDocument: file.name.replace(/\.[^.]+$/, ""),
    rawRows,
    staged: stageRows(rawRows, file.name, format),
  };
}
