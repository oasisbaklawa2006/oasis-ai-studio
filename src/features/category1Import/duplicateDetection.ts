import {
  normalizeNamePackKey,
  normalizeProductName,
  normalizeProductSku,
  productCollisionLabel,
} from "@/features/productGovernance/productDuplicateContract";
import { supabase } from "@/integrations/supabase/client";
import type { DuplicateMatch, StagedCategory1Row } from "./types";

export function detectInFileDuplicates(staged: StagedCategory1Row[]): {
  rowIndex: number;
  duplicates: DuplicateMatch[];
}[] {
  const skuMap = new Map<string, number>();
  const namePackMap = new Map<string, number>();
  const results: { rowIndex: number; duplicates: DuplicateMatch[] }[] = [];

  for (const entry of staged) {
    const dupes: DuplicateMatch[] = [];
    const sku = normalizeProductSku(entry.row.sku);
    if (sku) {
      const first = skuMap.get(sku);
      if (first != null) {
        dupes.push({
          kind: "in_file_sku",
          matchedValue: entry.row.sku ?? sku,
          matchedRowIndex: first,
        });
      } else {
        skuMap.set(sku, entry.row.rowIndex);
      }
    }

    const np = normalizeNamePackKey(entry.row.product_name, entry.row.pack_size);
    if (np) {
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
  return productCollisionLabel(p);
}

function stagedSkuValues(staged: StagedCategory1Row[]): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const entry of staged) {
    const trimmed = entry.row.sku?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    values.push(trimmed);
  }
  return values;
}

/**
 * Read-only duplicate check against master `products` — no writes.
 * Exact SKU collisions fail closed; name/pack matches remain review-only warnings.
 */
export async function detectExistingProductDuplicates(
  staged: StagedCategory1Row[],
): Promise<StagedCategory1Row[]> {
  const skuValues = stagedSkuValues(staged);

  let existing: ExistingProduct[] = [];

  if (skuValues.length) {
    const { data: bySku } = await (supabase as any)
      .from("products")
      .select("id, sku, name, pack_size")
      .in("sku", skuValues);

    existing = [...(bySku ?? [])];
  }

  const names = [...new Set(staged.map((s) => s.row.product_name.trim()).filter(Boolean))];

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
    const sku = normalizeProductSku(p.sku);
    if (sku) skuIndex.set(sku, p);
    const name = normalizeProductName(p.product_name ?? p.name);
    if (name) {
      const list = nameIndex.get(name) ?? [];
      list.push(p);
      nameIndex.set(name, list);
    }
  }

  return staged.map((entry) => {
    const duplicates = [...entry.duplicates];
    const issues = [...entry.issues];

    const sku = normalizeProductSku(entry.row.sku);
    const match = sku ? skuIndex.get(sku) : undefined;
    if (match) {
      duplicates.push({
        kind: "existing_sku",
        matchedValue: entry.row.sku ?? sku,
        existingProductId: match.id,
        existingLabel: productLabel(match),
      });
      issues.push({
        level: "error",
        code: "duplicate_existing_sku",
        message: `SKU already exists: ${productLabel(match)}`,
      });
    }

    const nameKey = normalizeProductName(entry.row.product_name);
    const nameMatches = nameKey ? (nameIndex.get(nameKey) ?? []) : [];
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
