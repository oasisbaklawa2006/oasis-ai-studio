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

export { checksumEan8, checksumEan13, checksumUpcA };
