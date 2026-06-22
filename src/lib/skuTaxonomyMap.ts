/**
 * Pilot-safe SKU taxonomy filters — frontend mapping until sku_code_rules.parent_code ships.
 * Division → category is not enforced here; subcategory and packaging are filtered by category_code.
 */

export const CATEGORY_SUBCATEGORY_MAP: Readonly<Record<string, readonly string[]>> = {
  BKL: ["PYR", "ROL", "BIR", "KAT", "SQR", "ASS", "PST", "CSH", "ALM", "MIX"],
  KNF: ["KNF", "KDF", "KTF"],
  DAT: ["ASS", "MIX", "PST"],
  DRG: ["MIX", "PST", "CSH", "ALM"],
  HMP: ["EID", "DWL", "WED", "ASS"],
  NUT: ["MIX", "ASS"],
  CKE: ["SQR", "ASS"],
  FUS: ["ASS", "MIX"],
  /** Frozen / semi-prepared (division FR) — kunafa-style subcategories only */
  FRZ: ["KNF", "KDF", "KTF", "ASS"],
  BOX: ["ASS", "MIX"],
  JAR: ["ASS", "MIX"],
  RAW: ["ASS", "MIX"],
};

/** Division FR uses frozen subcategory set when category is not more specific */
export const FROZEN_DIVISION_SUBCATEGORIES = CATEGORY_SUBCATEGORY_MAP.FRZ;

const BULK_PACKAGING = ["LOOSE", "BULK", "TRAY1KG", "JAR500", "MAAPET"];
const RETAIL_PACKAGING = ["RBOX", "TIN", "PAPERBOX", "CRYSTAL", "666", "888", "MAAPET"];
const FROZEN_PACKAGING = ["FROZEN", "MAPTRAY", "MAAPET"];
const HAMPER_PACKAGING = ["RBOX", "CRYSTAL", "TIN", "PAPERBOX", "888", "666"];

const CATEGORY_PACKAGING_MAP: Readonly<Record<string, readonly string[]>> = {
  BKL: BULK_PACKAGING,
  KNF: [...RETAIL_PACKAGING, "TRAY1KG"],
  DAT: BULK_PACKAGING,
  DRG: BULK_PACKAGING,
  HMP: HAMPER_PACKAGING,
  NUT: BULK_PACKAGING,
  CKE: [...RETAIL_PACKAGING, "TRAY1KG"],
  FUS: BULK_PACKAGING,
  FRZ: FROZEN_PACKAGING,
  BOX: RETAIL_PACKAGING,
  JAR: ["JAR500", "TIN", "RBOX"],
  RAW: ["LOOSE", "BULK", "PAPERBOX"],
};

const PRODUCT_CLASS_PACKAGING: Readonly<Record<string, readonly string[]>> = {
  bulk_loose_product: BULK_PACKAGING,
  ready_pack: RETAIL_PACKAGING,
  gift_hamper: HAMPER_PACKAGING,
  semi_prepared_frozen: FROZEN_PACKAGING,
  packaging_decoration_material: ["LOOSE", "BULK", "PAPERBOX", "CRYSTAL"],
};

export type SkuCodeOption = { code: string; label: string; code_type: string };

export function allowedSubcategoryCodes(
  categoryCode: string | null | undefined,
  divisionCode?: string | null,
): readonly string[] | null {
  const cat = categoryCode?.trim().toUpperCase();
  if (cat && CATEGORY_SUBCATEGORY_MAP[cat]) {
    return CATEGORY_SUBCATEGORY_MAP[cat];
  }
  if (divisionCode?.trim().toUpperCase() === "FR") {
    return FROZEN_DIVISION_SUBCATEGORIES;
  }
  return null;
}

export function allowedPackagingCodes(
  categoryCode: string | null | undefined,
  productClass?: string | null,
  divisionCode?: string | null,
): readonly string[] | null {
  const cat = categoryCode?.trim().toUpperCase();
  const byClass = productClass ? PRODUCT_CLASS_PACKAGING[productClass] : null;
  const byCategory = cat ? CATEGORY_PACKAGING_MAP[cat] : null;

  if (divisionCode?.trim().toUpperCase() === "FR" && !byCategory) {
    return FROZEN_PACKAGING;
  }

  if (byClass && byCategory) {
    const classSet = new Set(byClass);
    return byCategory.filter((c) => classSet.has(c));
  }
  return byCategory ?? byClass ?? null;
}

export function filterSkuCodeOptions(
  options: SkuCodeOption[],
  allowedCodes: readonly string[] | null,
): SkuCodeOption[] {
  if (!allowedCodes?.length) return options;
  const allowed = new Set(allowedCodes.map((c) => c.toUpperCase()));
  const filtered = options.filter((o) => allowed.has(o.code.toUpperCase()));
  return filtered.length ? filtered : options;
}

export function isSubcategoryAllowedForCategory(
  categoryCode: string | null | undefined,
  subcategoryCode: string | null | undefined,
  divisionCode?: string | null,
): boolean {
  if (!subcategoryCode) return true;
  const allowed = allowedSubcategoryCodes(categoryCode, divisionCode);
  if (!allowed) return true;
  return allowed.includes(subcategoryCode.toUpperCase());
}

export function isPackagingAllowed(
  categoryCode: string | null | undefined,
  packagingCode: string | null | undefined,
  productClass?: string | null,
  divisionCode?: string | null,
): boolean {
  if (!packagingCode) return true;
  const allowed = allowedPackagingCodes(categoryCode, productClass, divisionCode);
  if (!allowed) return true;
  return allowed.includes(packagingCode.toUpperCase());
}

export function isValidSkuTaxonomyCombination(args: {
  category_code?: string | null;
  subcategory_code?: string | null;
  packaging_code?: string | null;
  division_code?: string | null;
  product_class?: string | null;
}): { valid: boolean; message?: string } {
  const { category_code, subcategory_code, packaging_code, division_code, product_class } = args;

  if (category_code && subcategory_code && !isSubcategoryAllowedForCategory(category_code, subcategory_code, division_code)) {
    return {
      valid: false,
      message: `Subcategory ${subcategory_code} is not valid for category ${category_code}. Choose a matching subcategory.`,
    };
  }

  if (category_code && packaging_code && !isPackagingAllowed(category_code, packaging_code, product_class, division_code)) {
    return {
      valid: false,
      message: `Packaging ${packaging_code} is not valid for this product type. Choose retail/bulk/frozen packaging as appropriate.`,
    };
  }

  return { valid: true };
}

export function invalidSkuTaxonomyMessage(args: {
  category_code?: string | null;
  subcategory_code?: string | null;
  packaging_code?: string | null;
  division_code?: string | null;
  product_class?: string | null;
}): string | null {
  const result = isValidSkuTaxonomyCombination(args);
  return result.valid ? null : (result.message ?? "Invalid SKU taxonomy combination.");
}
