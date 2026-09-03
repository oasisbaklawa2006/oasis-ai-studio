import { isAllDigits, isCode128Token } from "./textTokenUtils";

export type BarcodeNormalization =
  | { ok: true; barcode: string; format: "ean13" | "ean8" | "upc_a" | "code128" }
  | { ok: false; reason: string };

function checksumEan13(digits: string): boolean {
  if (digits.length !== 13) return false;
  const parts = digits.split("").map((digit) => Number(digit));
  if (parts.length !== 13 || parts.some((digit) => Number.isNaN(digit))) return false;

  const sum =
    parts[0] +
    parts[1] * 3 +
    parts[2] +
    parts[3] * 3 +
    parts[4] +
    parts[5] * 3 +
    parts[6] +
    parts[7] * 3 +
    parts[8] +
    parts[9] * 3 +
    parts[10] +
    parts[11] * 3;
  const check = (10 - (sum % 10)) % 10;
  return check === parts[12];
}

function checksumEan8(digits: string): boolean {
  if (digits.length !== 8) return false;
  const parts = digits.split("").map((digit) => Number(digit));
  if (parts.length !== 8 || parts.some((digit) => Number.isNaN(digit))) return false;

  const sum =
    parts[0] * 3 + parts[1] + parts[2] * 3 + parts[3] + parts[4] * 3 + parts[5] + parts[6] * 3;
  const check = (10 - (sum % 10)) % 10;
  return check === parts[7];
}

function checksumUpcA(digits: string): boolean {
  if (digits.length !== 12) return false;
  return checksumEan13(`0${digits}`);
}

/**
 * Normalize and validate a barcode string. Accepts typed or scanned values with
 * optional whitespace/dashes. Returns unsupported for empty or non-numeric junk.
 */
export function normalizeBarcodeInput(raw: string): BarcodeNormalization {
  let digits = "";
  for (const ch of raw) {
    if (ch !== " " && ch !== "-") digits += ch;
  }
  if (!digits) return { ok: false, reason: "Barcode is empty." };

  if (!isAllDigits(digits)) {
    let token = "";
    for (const ch of raw) {
      if (ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r") token += ch;
    }
    if (isCode128Token(token)) {
      let barcode = "";
      for (const ch of token) {
        if (ch >= "a" && ch <= "z") {
          barcode += String.fromCharCode(ch.charCodeAt(0) - 32);
        } else {
          barcode += ch;
        }
      }
      return { ok: true, barcode, format: "code128" };
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

export { checksumEan8, checksumEan13, checksumUpcA };
