import type { FastCreateCategoryKey } from "@/features/productDefaults/categoryDefaults";
import { FAST_CREATE_CATEGORIES } from "@/features/productDefaults/categoryDefaults";
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

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

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
  return ["mrp", "b2b", "sku", "barcode", "qty", "pack"].some((prefix) => lower.startsWith(prefix));
}

function isSkuToken(value: string): boolean {
  return value.toUpperCase().startsWith("OAS-");
}

function isBarcodeToken(value: string): boolean {
  const compact = value.replace(/\s/g, "");
  if (!/^\d+$/.test(compact)) return false;
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
  const rupeeIdx = text.indexOf("₹");
  if (rupeeIdx >= 0) return extractNumberFromSlice(text.slice(rupeeIdx + 1));
  const rsIdx = lower.indexOf("rs");
  if (rsIdx >= 0) return extractNumberFromSlice(text.slice(rsIdx + 2));
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

  const tokens = tokenize(text);
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === "pc" || token === "pcs" || token === "piece" || token === "pieces") {
      const prev = tokens[i - 1];
      if (prev && /^\d{1,4}$/.test(prev)) return prev;
    }
  }

  const packIdx = lower.indexOf("pack");
  if (packIdx >= 0) return extractNumberFromSlice(text.slice(packIdx + 4));
  return null;
}

function extractSku(text: string): string | null {
  const tokens = text.split(/\s+/);
  for (const token of tokens) {
    if (isSkuToken(token)) return token.toUpperCase();
  }
  return null;
}

function extractBarcode(text: string, sku: string | null): string | null {
  const lower = text.toLowerCase();
  for (const label of ["barcode", "ean", "upc"]) {
    const idx = lower.indexOf(label);
    if (idx >= 0) {
      const digits = extractNumberFromSlice(text.slice(idx + label.length));
      if (digits) return digits;
    }
  }

  if (sku) return null;
  const tokens = text.split(/\s+/);
  for (const token of tokens) {
    const digits = token.replace(/\s/g, "");
    if (isBarcodeToken(digits)) return digits;
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

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
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
