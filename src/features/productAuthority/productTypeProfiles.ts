export const PRODUCT_TYPE_PROFILES = {
  loose_bulk_material: {
    label: "Loose / Bulk Material",
    showPrivateLabel: false,
    showCustomization: false,
    showHamperBom: false,
  },
  prepacked_ready_packs: {
    label: "Prepacked Products / Ready Packs",
    showPrivateLabel: true,
    showCustomization: false,
    showHamperBom: false,
  },
  premium_gift_packs: {
    label: "Premium Gift Packs",
    showPrivateLabel: false,
    showCustomization: true,
    showHamperBom: true,
  },
  hamper_assorted_gift_pack: {
    label: "Hamper / Assorted Gift Pack",
    showPrivateLabel: false,
    showCustomization: true,
    showHamperBom: true,
  },
  semi_prepared_frozen_bake_and_serve: {
    label: "Semi-prepared / Frozen / Bake-and-Serve Products",
    showPrivateLabel: false,
    showCustomization: false,
    showHamperBom: false,
  },
  packaging_decoration_material: {
    label: "Packaging / Decoration Material",
    showPrivateLabel: false,
    showCustomization: false,
    showHamperBom: false,
  },
} as const;

export type ProductTypeProfileKey = keyof typeof PRODUCT_TYPE_PROFILES;

export const PRODUCT_TYPE_OPTIONS = Object.entries(PRODUCT_TYPE_PROFILES).map(([v, profile]) => ({
  v,
  label: profile.label,
}));

/** Existing records can retain an old value without silently discarding it from the select. */
export function productTypeOptionsForValue(value: unknown) {
  const legacyValue = typeof value === "string" ? value.trim() : "";
  if (!legacyValue || legacyValue in PRODUCT_TYPE_PROFILES) return PRODUCT_TYPE_OPTIONS;
  return [{ v: legacyValue, label: `${legacyValue} (legacy)` }, ...PRODUCT_TYPE_OPTIONS];
}
