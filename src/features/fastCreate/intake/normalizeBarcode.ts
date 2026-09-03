const EAN13 = /^\d{13}$/;
const EAN8 = /^\d{8}$/;
const UPC_A = /^\d{12}$/;

export type BarcodeNormalization =
  | { ok: true; barcode: string; format: "ean13" | "ean8" | "upc_a" | "code128" }
  | { ok: false; reason: string };

function checksumEan13(digits: string): boolean {
  if (digits.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const n = Number(digits[i]);
    sum += i % 2 === 0 ? n : n * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[12]);
}

function checksumEan8(digits: string): boolean {
  if (digits.length !== 8) return false;
  let sum = 0;
  for (let i = 0; i < 7; i += 1) {
    const n = Number(digits[i]);
    sum += i % 2 === 0 ? n * 3 : n;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[7]);
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
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "Barcode is empty." };

  const digits = trimmed.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(digits)) {
    if (/^[A-Za-z0-9-]{4,32}$/.test(trimmed)) {
      return { ok: true, barcode: trimmed.toUpperCase(), format: "code128" };
    }
    return { ok: false, reason: "Barcode must be numeric (EAN/UPC) or a short alphanumeric code." };
  }

  if (EAN13.test(digits)) {
    if (!checksumEan13(digits))
      return { ok: false, reason: "EAN-13 checksum failed — verify the scan." };
    return { ok: true, barcode: digits, format: "ean13" };
  }
  if (EAN8.test(digits)) {
    if (!checksumEan8(digits))
      return { ok: false, reason: "EAN-8 checksum failed — verify the scan." };
    return { ok: true, barcode: digits, format: "ean8" };
  }
  if (UPC_A.test(digits)) {
    if (!checksumUpcA(digits))
      return { ok: false, reason: "UPC-A checksum failed — verify the scan." };
    return { ok: true, barcode: digits, format: "upc_a" };
  }

  if (digits.length >= 4 && digits.length <= 32) {
    return { ok: true, barcode: digits, format: "code128" };
  }

  return { ok: false, reason: "Unsupported barcode length." };
}
