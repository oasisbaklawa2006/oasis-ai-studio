import type { ProductLanguageTermType } from "./terms";

const STORAGE_PREFIX = "oasis-product-language-term-types";

function storageKey(productId: string): string {
  return `${STORAGE_PREFIX}:${productId}`;
}

type TermTypeMap = Record<string, ProductLanguageTermType>;

function readMap(productId: string): TermTypeMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(productId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as TermTypeMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(productId: string, map: TermTypeMap): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(productId), JSON.stringify(map));
}

/** Persist UI-only term type by alias row id or draft alias text key. */
export function getStoredTermType(
  productId: string,
  rowKey: string,
): ProductLanguageTermType | undefined {
  return readMap(productId)[rowKey];
}

export function setStoredTermType(
  productId: string,
  rowKey: string,
  termType: ProductLanguageTermType,
): void {
  const map = readMap(productId);
  map[rowKey] = termType;
  writeMap(productId, map);
}

export function removeStoredTermType(productId: string, rowKey: string): void {
  const map = readMap(productId);
  delete map[rowKey];
  writeMap(productId, map);
}

export function getAllStoredTermTypes(productId: string): TermTypeMap {
  return readMap(productId);
}

export function countStoredTermTypes(productId: string): Partial<Record<ProductLanguageTermType, number>> {
  const counts: Partial<Record<ProductLanguageTermType, number>> = {};
  for (const t of Object.values(readMap(productId))) {
    counts[t] = (counts[t] ?? 0) + 1;
  }
  return counts;
}
