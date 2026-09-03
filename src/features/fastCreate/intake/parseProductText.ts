import type { FastCreateCategoryKey } from "@/features/productDefaults/categoryDefaults";
import { FAST_CREATE_CATEGORIES } from "@/features/productDefaults/categoryDefaults";
import type { ParsedProductTextFields } from "./types";

const SKU_PATTERN = /^OAS-[A-Z0-9-]+$/i;
const BARCODE_PATTERN = /^(?:\d{8}|\d{12}|\d{13})$/;

const CATEGORY_HINTS: Array<{ key: FastCreateCategoryKey; patterns: RegExp[] }> = [
  { key: "baklawa", patterns: [/\bbaklawa\b/i, /\bpyramid\b/i, /\bphyllo\b/i, /\bfilo\b/i] },
  { key: "dragees", patterns: [/\bdragee\b/i, /\bdragée\b/i] },
  { key: "dates_chocolate", patterns: [/\bdates?\b/i, /\bchocolate\b/i, /\bchoco\b/i] },
  { key: "fusion_sweets", patterns: [/\bfusion\b/i, /\bmacaron\b/i] },
  { key: "nuts", patterns: [/\bnuts?\b/i, /\bcashew\b/i, /\balmond\b/i, /\bpistachio\b/i] },
  { key: "ready_packs", patterns: [/\bready\s*pack\b/i, /\bgift\s*box\b/i, /\bhamper\b/i, /\bbox\b/i] },
  { key: "gift_hampers", patterns: [/\bhamper\b/i, /\bassortment\b/i] },
  { key: "packaging", patterns: [/\bpackaging\b/i, /\bribbon\b/i, /\bbox\s*only\b/i] },
  { key: "bakery", patterns: [/\bbakery\b/i, /\bcookie\b/i, /\bbiscuit\b/i] },
];

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
    if (match?.[0]) return match[0].trim();
  }
  return null;
}

function inferCategory(text: string): FastCreateCategoryKey | null {
  for (const hint of CATEGORY_HINTS) {
    if (hint.patterns.some((p) => p.test(text))) return hint.key;
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

/**
 * Deterministic free-text parser shared by paste, voice transcript, and OCR review text.
 * Never invents facts — ambiguous fields stay null.
 */
export function parseProductText(raw: string): ParsedProductTextFields {
  const text = raw.trim();
  if (!text) {
    return {
      productName: null,
      mrp: null,
      b2bPrice: null,
      qtyPerPack: null,
      sku: null,
      barcode: null,
      categoryKey: null,
      notes: null,
    };
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const joined = lines.join(" ");

  let productName: string | null = null;
  for (const line of lines) {
    const named = firstMatch(line, [/^(?:product(?:\s*name)?|item|name)\s*[:=-]\s*(.+)$/i]);
    if (named) {
      productName = cleanProductName(named);
      break;
    }
  }
  if (!productName) {
    for (const line of lines) {
      const candidate = cleanProductName(line);
      if (candidate && !SKU_PATTERN.test(candidate) && !BARCODE_PATTERN.test(candidate.replace(/\s/g, ""))) {
        productName = candidate;
        break;
      }
    }
  }

  const mrp =
    firstMatch(joined, [
      /\bmrp\b\s*[:=]?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)/i,
      /(?:₹|rs\.?|inr)\s*(\d+(?:\.\d{1,2})?)/i,
    ]) ?? null;

  const b2bPrice =
    firstMatch(joined, [/\bb2b(?:\s*price)?\b\s*[:=]?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)/i]) ?? null;

  const qtyPerPack =
    firstMatch(joined, [
      /\b(?:qty|quantity)\s*(?:per\s*pack)?\s*[:=]?\s*(\d{1,4})\b/i,
      /\b(\d{1,4})\s*(?:pc|pcs|pieces|piece)\b/i,
      /\bpack\s*(?:of|size)?\s*(\d{1,4})\b/i,
    ]) ?? null;

  let sku: string | null = null;
  const skuHit = joined.match(/\b(OAS-[A-Z0-9-]+)\b/i);
  if (skuHit) sku = skuHit[1].toUpperCase();

  let barcode: string | null = null;
  const barcodeHit = joined.match(/\b(?:barcode|ean|upc)\s*[:=]?\s*(\d{8,13})\b/i);
  if (barcodeHit) barcode = barcodeHit[1];
  if (!barcode) {
    const loneDigits = joined.match(/\b(\d{13}|\d{12}|\d{8})\b/);
    if (loneDigits && !sku) barcode = loneDigits[1];
  }

  const categoryKey = inferCategory(joined);
  const categoryLabel = categoryKey
    ? (FAST_CREATE_CATEGORIES.find((c) => c.key === categoryKey)?.label ?? categoryKey)
    : null;

  const notes =
    categoryLabel && !productName
      ? `Category hint: ${categoryLabel}`
      : categoryLabel
        ? null
        : lines.length > 1
          ? "Review parsed fields — some values may be incomplete."
          : null;

  return {
    productName,
    mrp,
    b2bPrice,
    qtyPerPack,
    sku,
    barcode,
    categoryKey,
    notes,
  };
}
