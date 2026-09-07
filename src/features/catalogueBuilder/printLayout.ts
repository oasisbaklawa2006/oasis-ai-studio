/** Print production constants — A4 with 3mm bleed (ISO 12647-2 common practice). */
export const PRINT_PAGE = {
  format: "a4" as const,
  widthMm: 210,
  heightMm: 297,
  bleedMm: 3,
  safeMarginMm: 12,
  trimWidthMm: 210,
  trimHeightMm: 297,
};

export const MIN_PRINT_DPI = 300;
export const MIN_IMAGE_WIDTH_PX = 1200;
export const MIN_IMAGE_HEIGHT_PX = 1200;

export type PrintImageQualityInput = {
  imageUrl: string | null;
  widthPx?: number | null;
  heightPx?: number | null;
  approved?: boolean;
};

export type PrintImageQualityResult = {
  ok: boolean;
  issues: string[];
  effectiveDpi: number | null;
};

export type PrintLayoutValidation = {
  ok: boolean;
  issues: string[];
  warnings: string[];
};

/** Estimate effective DPI for a hero image at the printed card size. */
export function estimateEffectiveDpi(
  widthPx: number,
  printWidthMm: number,
): number {
  const printWidthIn = printWidthMm / 25.4;
  return Math.round(widthPx / printWidthIn);
}

export function validatePrintImageQuality(
  input: PrintImageQualityInput,
  printWidthMm = 60,
): PrintImageQualityResult {
  const issues: string[] = [];

  if (!input.imageUrl) {
    issues.push("No approved hero image");
    return { ok: false, issues, effectiveDpi: null };
  }

  if (input.approved === false) {
    issues.push("Image is not approved for catalogue use");
  }

  const w = input.widthPx ?? null;
  const h = input.heightPx ?? null;

  if (w != null && w < MIN_IMAGE_WIDTH_PX) {
    issues.push(`Image width ${w}px below minimum ${MIN_IMAGE_WIDTH_PX}px`);
  }
  if (h != null && h < MIN_IMAGE_HEIGHT_PX) {
    issues.push(`Image height ${h}px below minimum ${MIN_IMAGE_HEIGHT_PX}px`);
  }

  let effectiveDpi: number | null = null;
  if (w != null && w > 0) {
    effectiveDpi = estimateEffectiveDpi(w, printWidthMm);
    if (effectiveDpi < MIN_PRINT_DPI) {
      issues.push(`Effective DPI ~${effectiveDpi} below ${MIN_PRINT_DPI} DPI print minimum`);
    }
  }

  return { ok: issues.length === 0, issues, effectiveDpi };
}

export function validatePrintLayout(args: {
  productCount: number;
  imagesWithIssues: number;
  hasCover: boolean;
}): PrintLayoutValidation {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (args.productCount === 0) {
    issues.push("Catalogue has no products");
  }

  if (args.imagesWithIssues > 0) {
    warnings.push(
      `${args.imagesWithIssues} product(s) fail image-quality gates — export may omit images`,
    );
  }

  const contentWidth =
    PRINT_PAGE.trimWidthMm - 2 * (PRINT_PAGE.safeMarginMm + PRINT_PAGE.bleedMm);
  if (contentWidth < 40) {
    issues.push("Safe area leaves insufficient content width");
  }

  if (!args.hasCover && args.productCount > 0) {
    warnings.push("No cover page configured");
  }

  return { ok: issues.length === 0, issues, warnings };
}

/** Bleed-inclusive coordinates for jsPDF (mm). */
export function contentBoxMm() {
  const left = PRINT_PAGE.safeMarginMm + PRINT_PAGE.bleedMm;
  const top = PRINT_PAGE.safeMarginMm + PRINT_PAGE.bleedMm;
  const width =
    PRINT_PAGE.trimWidthMm - 2 * (PRINT_PAGE.safeMarginMm + PRINT_PAGE.bleedMm);
  const height =
    PRINT_PAGE.trimHeightMm - 2 * (PRINT_PAGE.safeMarginMm + PRINT_PAGE.bleedMm);
  return { left, top, width, height, bottom: top + height, right: left + width };
}
