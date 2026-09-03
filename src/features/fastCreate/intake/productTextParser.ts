import type { FastCreateCategoryKey } from "@/features/productDefaults/categoryDefaults";
import { FAST_CREATE_CATEGORIES } from "@/features/productDefaults/categoryDefaults";
import { normalizeBarcodeInput } from "./barcodeChecksum";
import {
  compactWhitespace,
  isAllDigits,
  isDigitToken,
  splitWords,
  tokenize,
} from "./textTokenUtils";
import type { ParsedProductTextFields } from "./types";

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

const CATEGORY_KEYWORDS: Array<{ key: FastCreateCategoryKey; words: string[] }> = [
  { key: "baklawa", words: ["baklawa", "pyramid"] },
  { key: "dragees", words: ["dragee"] },
  { key: "dates_chocolate", words: ["date", "dates", "chocolate"] },
  { key: "fusion_sweets", words: ["fusion", "macaron"] },
  { key: "nuts", words: ["nut", "nuts", "cashew", "almond"] },
  { key: "ready_packs", words: ["ready pack", "gift box", "box"] },
  { key: "gift_hampers", words: ["hamper", "assortment"] },
  { key: "packaging", words: ["packaging", "ribbon"] },
  { key: "bakery", words: ["bakery", "cookie"] },
];

function includesPhrase(text: string, phrase: string): boolean {
  return text.toLowerCase().includes(phrase);
}

function extractNumberFromSlice(slice: string, maxLen = 24): string | null {
  const bounded = slice.slice(0, maxLen);
  let digits = "";
  let seenDigit = false;
  for (const ch of bounded) {
    if (ch >= "0" && ch <= "9") {
      digits += ch;
      seenDigit = true;
      continue;
    }
    if (ch === "." && !digits.includes(".")) {
      digits += ch;
      continue;
    }
    if (ch === "," && seenDigit) {
      continue;
    }
    if (seenDigit) break;
  }
  return digits || null;
}

function inferCategory(text: string): FastCreateCategoryKey | null {
  const lower = text.toLowerCase();
  for (const hint of CATEGORY_KEYWORDS) {
    if (hint.words.some((word) => includesPhrase(lower, word))) return hint.key;
  }
  return null;
}

function stripNamePrefix(line: string): string {
  const lower = line.toLowerCase();
  for (const prefix of ["product name:", "product:", "item:", "name:"]) {
    if (lower.startsWith(prefix)) return line.slice(prefix.length).trim();
  }
  if (line.startsWith("- ") || line.startsWith("* ")) return line.slice(2).trim();
  return line.trim();
}

function isMetadataLine(line: string): boolean {
  const lower = line.toLowerCase();
  if (lower.startsWith("pack:") || lower.startsWith("pack ")) return true;
  return ["mrp", "b2b", "sku", "barcode", "qty"].some((prefix) => lower.startsWith(prefix));
}

function isSkuToken(value: string): boolean {
  return value.toUpperCase().startsWith("OAS-");
}

function isBarcodeToken(value: string): boolean {
  const compact = compactWhitespace(value);
  if (!isAllDigits(compact)) return false;
  return compact.length === 8 || compact.length === 12 || compact.length === 13;
}

function isQuantityLine(line: string): boolean {
  const lower = line.toLowerCase();
  return (
    lower.includes(" per pack") ||
    lower.includes(" pcs") ||
    lower.includes(" pc ") ||
    lower.endsWith(" pcs") ||
    lower.endsWith(" pc")
  );
}

function extractProductName(lines: string[]): string | null {
  for (const line of lines) {
    const named = stripNamePrefix(line);
    if (named !== line.trim() && named.length >= 2 && !isMetadataLine(named)) return named;
  }

  for (const line of lines) {
    const candidate = stripNamePrefix(line);
    if (candidate.length < 2 || isMetadataLine(candidate) || isQuantityLine(candidate)) continue;
    if (isSkuToken(candidate)) continue;
    if (isBarcodeToken(candidate)) continue;
    return candidate;
  }

  return null;
}

function extractMrp(text: string): string | null {
  const lower = text.toLowerCase();
  const mrpIdx = lower.indexOf("mrp");
  if (mrpIdx >= 0) return extractNumberFromSlice(text.slice(mrpIdx + 3));
  const b2bIdx = lower.indexOf("b2b");

  const rupeeIdx = text.indexOf("₹");
  if (rupeeIdx >= 0) {
    if (b2bIdx >= 0 && rupeeIdx > b2bIdx) return null;
    return extractNumberFromSlice(text.slice(rupeeIdx + 1));
  }

  const rsIdx = lower.indexOf("rs");
  if (rsIdx >= 0) {
    if (b2bIdx >= 0 && rsIdx >= b2bIdx) return null;
    return extractNumberFromSlice(text.slice(rsIdx + 2));
  }
  return null;
}

function extractB2bPrice(text: string): string | null {
  const lower = text.toLowerCase();
  const idx = lower.indexOf("b2b");
  if (idx < 0) return null;
  return extractNumberFromSlice(text.slice(idx + 3));
}

function extractQtyPerPack(text: string): string | null {
  const lower = text.toLowerCase();
  const qtyIdx = lower.indexOf("qty");
  if (qtyIdx >= 0) return extractNumberFromSlice(text.slice(qtyIdx + 3));

  let previous = "";
  for (const token of tokenize(text)) {
    if (
      (token === "pc" || token === "pcs" || token === "piece" || token === "pieces") &&
      isDigitToken(previous)
    ) {
      return previous;
    }
    previous = token;
  }

  const packIdx = lower.indexOf("pack");
  if (packIdx >= 0) return extractNumberFromSlice(text.slice(packIdx + 4));
  return null;
}

function extractSku(text: string): string | null {
  for (const token of splitWords(text)) {
    if (isSkuToken(token)) return token.toUpperCase();
  }
  return null;
}

function extractLabeledBarcodeValue(text: string, labelEndIdx: number): string | null {
  const remainder = text.slice(labelEndIdx).replace(/^[:\s]+/, "");
  if (!remainder) return null;

  let raw = "";
  for (const ch of remainder) {
    if ((ch >= "0" && ch <= "9") || ch === " " || ch === "-" || ch === "\t") {
      raw += ch;
      continue;
    }
    if (raw.length > 0) break;
  }

  const normalized = normalizeBarcodeInput(raw);
  return normalized.ok ? normalized.barcode : null;
}

function extractBarcode(text: string, sku: string | null): string | null {
  const lower = text.toLowerCase();
  for (const label of ["barcode", "ean", "upc"]) {
    const idx = lower.indexOf(label);
    if (idx >= 0) {
      const value = extractLabeledBarcodeValue(text, idx + label.length);
      if (value) return value;
    }
  }

  if (sku) return null;
  for (const token of splitWords(text)) {
    const compact = compactWhitespace(token);
    if (isBarcodeToken(compact)) return compact;
  }
  return null;
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

  const lines: string[] = [];
  let current = "";
  for (const ch of text) {
    if (ch === "\n" || ch === "\r") {
      const trimmed = current.trim();
      if (trimmed) lines.push(trimmed);
      current = "";
      continue;
    }
    current += ch;
  }
  const tail = current.trim();
  if (tail) lines.push(tail);

  const joined = lines.join(" ");
  const productName = extractProductName(lines);
  const sku = extractSku(joined);
  const barcode = extractBarcode(joined, sku);
  const categoryKey = inferCategory(joined);
  const notes = buildNotes(categoryKey, productName, lines.length);

  return {
    productName,
    mrp: extractMrp(joined),
    b2bPrice: extractB2bPrice(joined),
    qtyPerPack: extractQtyPerPack(joined),
    sku,
    barcode,
    categoryKey,
    notes,
  };
}
