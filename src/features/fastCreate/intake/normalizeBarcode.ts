import { checksumEan8, checksumEan13, checksumUpcA } from "./barcodeChecksum";
import { isAllDigits } from "./textTokenUtils";

export type BarcodeNormalization =
  | { ok: true; barcode: string; format: "ean13" | "ean8" | "upc_a" | "code128" }
  | { ok: false; reason: string };

function stripBarcodeSeparators(raw: string): string {
  return raw.replaceAll(" ", "").replaceAll("-", "");
}

function isCode128Token(value: string): boolean {
  if (value.length < 4 || value.length > 32) return false;
  for (const ch of value) {
    const isDigit = ch >= "0" && ch <= "9";
    const isUpper = ch >= "A" && ch <= "Z";
    const isLower = ch >= "a" && ch <= "z";
    if (isDigit || isUpper || isLower || ch === "-") continue;
    return false;
  }
  return true;
}

/**
 * Normalize and validate a barcode string. Accepts typed or scanned values with
 * optional whitespace/dashes. Returns unsupported for empty or non-numeric junk.
 */
export function normalizeBarcodeInput(raw: string): BarcodeNormalization {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "Barcode is empty." };

  const digits = stripBarcodeSeparators(trimmed);
  if (!isAllDigits(digits)) {
    if (isCode128Token(trimmed)) {
      return { ok: true, barcode: trimmed.toUpperCase(), format: "code128" };
    }
    return { ok: false, reason: "Barcode must be numeric (EAN/UPC) or a short alphanumeric code." };
  }

  if (digits.length === 13) {
    if (!checksumEan13(digits))
      return { ok: false, reason: "EAN-13 checksum failed — verify the scan." };
    return { ok: true, barcode: digits, format: "ean13" };
  }
  if (digits.length === 8) {
    if (!checksumEan8(digits))
      return { ok: false, reason: "EAN-8 checksum failed — verify the scan." };
    return { ok: true, barcode: digits, format: "ean8" };
  }
  if (digits.length === 12) {
    if (!checksumUpcA(digits))
      return { ok: false, reason: "UPC-A checksum failed — verify the scan." };
    return { ok: true, barcode: digits, format: "upc_a" };
  }

  if (digits.length >= 4 && digits.length <= 32) {
    return { ok: true, barcode: digits, format: "code128" };
  }

  return { ok: false, reason: "Unsupported barcode length." };
}
