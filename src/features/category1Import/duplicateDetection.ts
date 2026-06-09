import { supabase } from "@/integrations/supabase/client";
import type { Category1AuthorityRow, DuplicateMatch, StagedCategory1Row } from "./types";

function normSku(sku: string | null | undefined): string | null {
  const v = sku?.trim().toLowerCase();
  return v || null;
}

function normNamePack(row: Category1AuthorityRow): string {
  return `${row.product_name.trim().toLowerCase()}|${(row.pack_size ?? "").trim().toLowerCase()}`;
}

export function detectInFileDuplicates(staged: StagedCategory1Row[]): {
  rowIndex: number;
  duplicates: DuplicateMatch[];
}[] {
  const skuMap = new Map<string, number>();
  const namePackMap = new Map<string, number>();
  const results: { rowIndex: number; duplicates: DuplicateMatch[] }[] = [];

  for (const entry of staged) {
    const dupes: DuplicateMatch[] = [];
    const sku = normSku(entry.row.sku);
    if (sku) {
      const first = skuMap.get(sku);
      if (first != null) {
        dupes.push({
          kind: "in_file_sku",
          matchedValue: entry.row.sku!,
          matchedRowIndex: first,
        });
      } else {
        skuMap.set(sku, entry.row.rowIndex);
      }
    }

    const np = normNamePack(entry.row);
    if (entry.row.product_name) {
      const first = namePackMap.get(np);
      if (first != null) {
        dupes.push({
          kind: "in_file_name_pack",
          matchedValue: `${entry.row.product_name} / ${entry.row.pack_size ?? "—"}`,
          matchedRowIndex: first,
        });
      } else {
        namePackMap.set(np, entry.row.rowIndex);
      }
    }

    if (dupes.length) {
      results.push({ rowIndex: entry.row.rowIndex, duplicates: dupes });
    }
  }

  return results;
}

type ExistingProduct = {
  id: string;
  sku?: string | null;
  product_name?: string | null;
  name?: string | null;
  pack_size?: string | null;
};

function productLabel(p: ExistingProduct): string {
  const name = p.product_name ?? p.name ?? "Unnamed";
  return p.sku ? `${name} (${p.sku})` : name;
}

/**
 * Read-only duplicate check against master `products` — no writes.
 */
export async function detectExistingProductDuplicates(
  staged: StagedCategory1Row[],
): Promise<StagedCategory1Row[]> {
  const skus = [
    ...new Set(
      staged.map((s) => normSku(s.row.sku)).filter((s): s is string => !!s),
    ),
  ];

  let existing: ExistingProduct[] = [];

  if (skus.length) {
    const { data: bySku } = await (supabase as any)
      .from("products")
      .select("id, sku, name, pack_size")
      .in("sku", skus);

    existing = [...(bySku ?? [])];
  }

  const names = [
    ...new Set(staged.map((s) => s.row.product_name.trim()).filter(Boolean)),
  ];

  for (const name of names.slice(0, 25)) {
    const { data: byName } = await (supabase as any)
      .from("products")
      .select("id, sku, name, pack_size")
      .eq("name", name);

    for (const row of byName ?? []) {
      if (!existing.some((e) => e.id === row.id)) existing.push(row);
    }
  }

  const skuIndex = new Map<string, ExistingProduct>();
  const nameIndex = new Map<string, ExistingProduct[]>();

  for (const p of existing) {
    const sku = normSku(p.sku);
    if (sku) skuIndex.set(sku, p);
    const name = (p.product_name ?? p.name ?? "").trim().toLowerCase();
    if (name) {
      const list = nameIndex.get(name) ?? [];
      list.push(p);
      nameIndex.set(name, list);
    }
  }

  return staged.map((entry) => {
    const duplicates = [...entry.duplicates];
    const issues = [...entry.issues];

    const sku = normSku(entry.row.sku);
    if (sku && skuIndex.has(sku)) {
      const match = skuIndex.get(sku)!;
      duplicates.push({
        kind: "existing_sku",
        matchedValue: entry.row.sku!,
        existingProductId: match.id,
        existingLabel: productLabel(match),
      });
      issues.push({
        level: "warning",
        code: "duplicate_existing_sku",
        message: `SKU already exists: ${productLabel(match)}`,
      });
    }

    const nameKey = entry.row.product_name.trim().toLowerCase();
    const nameMatches = nameIndex.get(nameKey) ?? [];
    const packMatch = nameMatches.find(
      (p) =>
        (p.pack_size ?? "").trim().toLowerCase() ===
        (entry.row.pack_size ?? "").trim().toLowerCase(),
    );
    if (packMatch && !duplicates.some((d) => d.kind === "existing_sku")) {
      duplicates.push({
        kind: "existing_name",
        matchedValue: entry.row.product_name,
        existingProductId: packMatch.id,
        existingLabel: productLabel(packMatch),
      });
      issues.push({
        level: "warning",
        code: "duplicate_existing_name",
        message: `Possible existing product: ${productLabel(packMatch)}`,
      });
    }

    return {
      ...entry,
      duplicates,
      issues,
      canSubmit: !issues.some((i) => i.level === "error"),
    };
  });
}
