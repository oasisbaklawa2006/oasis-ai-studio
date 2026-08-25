import { getAliasText } from "@/lib/aliasDisplay";
import {
  inferDefaultTermType,
  PRODUCT_LANGUAGE_TERM_TYPES,
  type ProductLanguageTermType,
} from "@/features/productLanguage/terms";
import { getStoredTermType } from "@/features/productLanguage/termTypeStorage";
import type { LanguageTermCounts, LanguageTermRecord } from "./types";

type AliasRow = {
  id: string;
  alias_text?: string | null;
  alias?: string | null;
  product_id?: string | null;
  canonical_name?: string | null;
  alias_type?: string | null;
};

export function resolveTermTypeForRow(
  productId: string,
  row: AliasRow,
): { termType: ProductLanguageTermType; source: "ui_metadata" | "inferred" } {
  const stored = getStoredTermType(productId, row.id);
  if (stored) return { termType: stored, source: "ui_metadata" };

  return {
    termType: inferDefaultTermType({
      product_id: row.product_id,
      alias_type: row.alias_type,
    }),
    source: "inferred",
  };
}

export function buildLanguageTermInventory(
  productId: string,
  productName: string,
  rows: AliasRow[],
): LanguageTermRecord[] {
  const trimmedName = productName.trim().toLowerCase();
  const seen = new Set<string>();

  return rows
    .filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    })
    .map((row) => {
      const { termType, source } = resolveTermTypeForRow(productId, row);
      return {
        id: row.id,
        alias_text: getAliasText(row),
        term_type: termType,
        term_type_source: source,
        product_id: row.product_id ?? null,
        canonical_name: row.canonical_name ?? (trimmedName ? productName.trim() : null),
      };
    })
    .filter((r) => r.alias_text.length > 0);
}

export function countLanguageTerms(inventory: LanguageTermRecord[]): LanguageTermCounts {
  const counts = Object.fromEntries(
    PRODUCT_LANGUAGE_TERM_TYPES.map((t) => [t, 0]),
  ) as Record<ProductLanguageTermType, number>;

  for (const row of inventory) {
    counts[row.term_type] += 1;
  }

  return {
    ...counts,
    total_aliases: inventory.length,
  };
}

export function emptyLanguageTermCounts(): LanguageTermCounts {
  return {
    official_alias: 0,
    customer_term: 0,
    whatsapp_keyword: 0,
    regional_term: 0,
    legacy_name: 0,
    search_keyword: 0,
    total_aliases: 0,
  };
}
