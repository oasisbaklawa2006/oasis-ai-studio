import type { FastCreateCategoryKey } from "@/features/productDefaults/categoryDefaults";
import { FAST_CREATE_CATEGORIES } from "@/features/productDefaults/categoryDefaults";
import type { ParsedProductTextFields } from "./types";

const SKU_PATTERN = /^OAS-[A-Z0-9-]+$/i;
const BARCODE_PATTERN = /^(?:\d{8}|\d{12}|\d{13})$/;

const CATEGORY_HINTS: Array<{ key: FastCreateCategoryKey; patterns: RegExp[] }> = [
  { key: "baklawa", patterns: [/\bbaklawa\b/i, /\bpyramid\b/i] },
  { key: "dragees", patterns: [/\bdragee\b/i] },
  { key: "dates_chocolate", patterns: [/\bdates?\b/i, /\bchocolate\b/i] },
  { key: "fusion_sweets", patterns: [/\bfusion\b/i, /\bmacaron\b/i] },
  { key: "nuts", patterns: [/\bnuts?\b/i, /\bcashew\b/i, /\balmond\b/i] },
  { key: "ready_packs", patterns: [/\bready\s*pack\b/i, /\bgift\s*box\b/i, /\bbox\b/i] },
  { key: "gift_hampers", patterns: [/\bhamper\b/i, /\bassortment\b/i] },
  { key: "packaging", patterns: [/\bpackaging\b/i, /\bribbon\b/i] },
  { key: "bakery", patterns: [/\bbakery\b/i, /\bcookie\b/i] },
];

const EMPTY_PARSED: ParsedProductTextFields = {
  productName: null,
  mrp: null,
  b2bPrice: null,
  qtyPerPack: null,
  sku: null,
  barcode: null,
  categoryKey: null,
  notes: null,
};

function captureGroup(match: RegExpMatchArray | null, index = 1): string | null {
  const value = match?.[index]?.trim();
  return value || null;
}

function inferCategory(text: string): FastCreateCategoryKey | null {
  for (const hint of CATEGORY_HINTS) {
    if (hint.patterns.some((pattern) => pattern.test(text))) return hint.key;
  }
  return null;
}

function cleanProductName(line: string): string | null {
  const trimmed = line
    .replace(/^(?:product(?:\s*name)?|item|name)\s*[:=-]\s*/i, "")
    .replace(/^[-*•]\s*/, "")
    .trim();
  if (!trimmed || trimmed.length < 2) return null;
  if (/^(?:mrp|b2b|sku|barcode|qty|pack)/i.test(trimmed)) return null;
  return trimmed;
}

function extractProductName(lines: string[]): string | null {
  for (const line of lines) {
    const named = captureGroup(line.match(/^(?:product(?:\s*name)?|item|name)\s*[:=-]\s*(.+)$/i));
    if (named) {
      const cleaned = cleanProductName(named);
      if (cleaned) return cleaned;
    }
  }

  for (const line of lines) {
    const candidate = cleanProductName(line);
    if (!candidate) continue;
    if (SKU_PATTERN.test(candidate)) continue;
    if (BARCODE_PATTERN.test(candidate.replace(/\s/g, ""))) continue;
    return candidate;
  }

  return null;
}

function extractPricing(
  joined: string,
): Pick<ParsedProductTextFields, "mrp" | "b2bPrice" | "qtyPerPack"> {
  const mrp =
    captureGroup(joined.match(/\bmrp\b\s*[:=]?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)/i)) ??
    captureGroup(joined.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d{1,2})?)/i));

  const b2bPrice = captureGroup(
    joined.match(/\bb2b(?:\s*price)?\b\s*[:=]?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)/i),
  );

  const qtyPerPack =
    captureGroup(joined.match(/\b(?:qty|quantity)\s*(?:per\s*pack)?\s*[:=]?\s*(\d{1,4})\b/i)) ??
    captureGroup(joined.match(/\b(\d{1,4})\s*(?:pc|pcs|pieces|piece)\b/i)) ??
    captureGroup(joined.match(/\bpack\s*(?:of|size)?\s*(\d{1,4})\b/i));

  return { mrp, b2bPrice, qtyPerPack };
}

function extractIdentifiers(joined: string): Pick<ParsedProductTextFields, "sku" | "barcode"> {
  const sku = captureGroup(joined.match(/\b(OAS-[A-Z0-9-]+)\b/i))?.toUpperCase() ?? null;

  let barcode = captureGroup(joined.match(/\b(?:barcode|ean|upc)\s*[:=]?\s*(\d{8,13})\b/i));
  if (!barcode && !sku) {
    barcode = captureGroup(joined.match(/\b(\d{13}|\d{12}|\d{8})\b/));
  }

  return { sku, barcode };
}

function buildNotes(
  categoryKey: FastCreateCategoryKey | null,
  productName: string | null,
  lineCount: number,
): string | null {
  if (!categoryKey) {
    return lineCount > 1 ? "Review parsed fields — some values may be incomplete." : null;
  }

  const categoryLabel =
    FAST_CREATE_CATEGORIES.find((entry) => entry.key === categoryKey)?.label ?? categoryKey;
  return productName ? null : `Category hint: ${categoryLabel}`;
}

/**
 * Deterministic free-text parser shared by paste, voice transcript, and OCR review text.
 */
export function parseProductText(raw: string): ParsedProductTextFields {
  const text = raw.trim();
  if (!text) return { ...EMPTY_PARSED };

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const joined = lines.join(" ");

  const productName = extractProductName(lines);
  const { mrp, b2bPrice, qtyPerPack } = extractPricing(joined);
  const { sku, barcode } = extractIdentifiers(joined);
  const categoryKey = inferCategory(joined);
  const notes = buildNotes(categoryKey, productName, lines.length);

  return { productName, mrp, b2bPrice, qtyPerPack, sku, barcode, categoryKey, notes };
}
