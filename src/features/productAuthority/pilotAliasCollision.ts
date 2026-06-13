import type { PilotSkuCode } from "./skuGuard";
import type { PilotAliasCollision, PilotAliasTermSuggestion } from "./pilotAliasTypes";

/** Bare generics — reject without product-specific anchor tokens. */
export const BARE_GENERIC_TERMS = new Set([
  "baklawa",
  "baklava",
  "cashew",
  "kaju",
  "pista",
  "pistachio",
  "kitta",
  "kita",
  "finger",
  "ring",
  "pyramid",
  "tart",
  "durum",
  "coconut",
  "asiyah",
  "asabi",
  "lebanese baklawa",
  "lebanese sweet",
  "turkish roll",
  "durum roll",
  "coconut roll",
  "baklawa roll",
  "turkish baklawa",
  "sweet",
  "piece",
  "kg",
]);

/** Shared phrases that need SKU context — warn if used alone. */
export const AMBIGUOUS_SHARED_PHRASES = new Set([
  "durum roll",
  "turkish roll",
  "coconut roll",
  "cashew piece",
  "kaju piece",
  "diamond baklawa",
  "katori",
]);

export function normalizeAliasText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isBareGenericAlias(aliasText: string): boolean {
  const n = normalizeAliasText(aliasText);
  if (BARE_GENERIC_TERMS.has(n)) return true;
  const tokens = n.split(" ");
  if (tokens.length === 1 && BARE_GENERIC_TERMS.has(tokens[0])) return true;
  return false;
}

export function hasProductAnchor(aliasText: string, productName: string, sku: string): boolean {
  const n = normalizeAliasText(aliasText);
  if (n.includes(normalizeAliasText(sku))) return true;

  const nameParts = normalizeAliasText(productName).split(" ").filter((t) => t.length > 2);
  const matchedParts = nameParts.filter((part) => n.includes(part));
  if (matchedParts.length >= 2) return true;
  if (matchedParts.length === 1 && matchedParts[0].length >= 5) return true;

  const skuAnchors: Record<string, string[]> = {
    "OAS-AS-BKL-0001": ["kitta", "kita"],
    "OAS-AS-BKL-0007": ["finger", "asabi", "asabeh"],
    "OAS-AS-BKL-0020": ["tart", "katori"],
    "OAS-AS-BKL-0024": ["mor", "pista", "beetroot", "pistachio durum"],
    "OAS-AS-BKL-0025": ["coconut", "nariyal", "coco"],
  };
  const anchors = skuAnchors[sku] ?? [];
  return anchors.filter((a) => n.includes(a)).length >= 1;
}

export type CollisionIndexEntry = {
  sku: PilotSkuCode;
  label: string;
  alias_text: string;
};

export function buildCollisionIndex(
  terms: Array<{ sku: PilotSkuCode; label: string; alias_text: string }>,
): Map<string, CollisionIndexEntry[]> {
  const index = new Map<string, CollisionIndexEntry[]>();
  for (const t of terms) {
    const key = normalizeAliasText(t.alias_text);
    const list = index.get(key) ?? [];
    list.push({ sku: t.sku, label: t.label, alias_text: t.alias_text });
    index.set(key, list);
  }
  return index;
}

export function checkPilotAliasCollision(
  term: Pick<PilotAliasTermSuggestion, "sku" | "product_name" | "alias_text">,
  index: Map<string, CollisionIndexEntry[]>,
): PilotAliasCollision {
  const n = normalizeAliasText(term.alias_text);

  if (isBareGenericAlias(term.alias_text)) {
    return {
      level: "block",
      reason: "Rejected: bare generic alias without product-specific anchor.",
    };
  }

  if (!hasProductAnchor(term.alias_text, term.product_name, term.sku)) {
    if (AMBIGUOUS_SHARED_PHRASES.has(n)) {
      return {
        level: "block",
        reason: "Rejected: ambiguous shared phrase — include full product name or SKU anchor.",
      };
    }
    return {
      level: "warning",
      reason: "Weak product anchor — confirm term is specific enough before approval.",
    };
  }

  const hits = (index.get(n) ?? []).filter((h) => h.sku !== term.sku);
  if (hits.length > 0) {
    return {
      level: "block",
      reason: `Cross-SKU collision: same normalized text on ${hits.map((h) => h.sku).join(", ")}.`,
      conflictsWith: hits.map((h) => ({ sku: h.sku, label: h.label, term: h.alias_text })),
    };
  }

  if (AMBIGUOUS_SHARED_PHRASES.has(n)) {
    return {
      level: "warning",
      reason: "Shared vocabulary across Batch 001 — resolver may need SKU disambiguation.",
    };
  }

  return { level: "none", reason: "No collision detected." };
}

export function applyCollisionChecks(
  terms: PilotAliasTermSuggestion[],
): PilotAliasTermSuggestion[] {
  const index = buildCollisionIndex(
    terms.map((t) => ({ sku: t.sku, label: t.product_name, alias_text: t.alias_text })),
  );

  return terms.map((term) => {
    const collision = checkPilotAliasCollision(term, index);
    let review_status = term.review_status;
    let review_notes = term.review_notes;

    if (collision.level === "block" && review_status === "suggested") {
      review_status = "rejected";
      review_notes = collision.reason;
    }

    return { ...term, collision, review_status, review_notes };
  });
}
