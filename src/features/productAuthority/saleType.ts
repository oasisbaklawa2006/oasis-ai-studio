/**
 * Sale type / product use — the single truth that drives which fields are required,
 * optional, or not applicable across Fast Create, Full Editor, and readiness gates.
 *
 * NOTE: `sale_type` itself has no products column. It maps onto the existing persisted
 * `product_class` where a class exists (ready_pack, bulk_loose_product, gift_hamper),
 * and is otherwise a UI/session concept only — reported as a schema gap, never faked
 * as a persisted field.
 */

export type SaleType =
  | "retail_ready_pack"
  | "b2b_horeca"
  | "export"
  | "internal_bom"
  | "gift_hamper"
  | "packaging_material";

export const SALE_TYPES: { key: SaleType; label: string }[] = [
  { key: "retail_ready_pack", label: "Retail / Ready Pack" },
  { key: "b2b_horeca", label: "B2B / HoReCa" },
  { key: "export", label: "Export" },
  { key: "internal_bom", label: "Internal / BOM component" },
  { key: "gift_hamper", label: "Gift / Hamper" },
  { key: "packaging_material", label: "Packaging material (not for sale)" },
];

export interface SaleTypeRequirements {
  /** Product is sold to customers (any channel). */
  customerFacing: boolean;
  /** Product is expected to appear in the catalogue. */
  catalogueVisible: boolean;
  requiresMrp: boolean;
  requiresB2bPrice: boolean;
  requiresExportPrice: boolean;
  requiresHeroImage: boolean;
  requiresPackaging: boolean;
  requiresQtyPerPack: boolean;
  requiresMoqCartonLogic: boolean;
  /** Pieces-per-kg / grams-per-piece only applies to loose / kg-based selling. */
  requiresPiecesPerKg: boolean;
  /** Export-detail fields (CBM, container qty, country labels) — completed in Full Editor. */
  requiresExportFields: boolean;
}

const REQUIREMENTS: Record<SaleType, SaleTypeRequirements> = {
  retail_ready_pack: {
    customerFacing: true,
    catalogueVisible: true,
    requiresMrp: true,
    requiresB2bPrice: false,
    requiresExportPrice: false,
    requiresHeroImage: true,
    requiresPackaging: true,
    requiresQtyPerPack: true,
    requiresMoqCartonLogic: false,
    requiresPiecesPerKg: false,
    requiresExportFields: false,
  },
  b2b_horeca: {
    customerFacing: true,
    catalogueVisible: true,
    requiresMrp: false,
    requiresB2bPrice: true,
    requiresExportPrice: false,
    requiresHeroImage: false,
    requiresPackaging: true,
    requiresQtyPerPack: false,
    requiresMoqCartonLogic: true,
    requiresPiecesPerKg: true,
    requiresExportFields: false,
  },
  export: {
    customerFacing: true,
    catalogueVisible: true,
    requiresMrp: false,
    requiresB2bPrice: false,
    requiresExportPrice: true,
    requiresHeroImage: true,
    requiresPackaging: true,
    requiresQtyPerPack: false,
    requiresMoqCartonLogic: true,
    requiresPiecesPerKg: false,
    requiresExportFields: true,
  },
  internal_bom: {
    customerFacing: false,
    catalogueVisible: false,
    requiresMrp: false,
    requiresB2bPrice: false,
    requiresExportPrice: false,
    requiresHeroImage: false,
    requiresPackaging: false,
    requiresQtyPerPack: false,
    requiresMoqCartonLogic: false,
    requiresPiecesPerKg: false,
    requiresExportFields: false,
  },
  gift_hamper: {
    customerFacing: true,
    catalogueVisible: true,
    requiresMrp: true,
    requiresB2bPrice: false,
    requiresExportPrice: false,
    requiresHeroImage: true,
    requiresPackaging: true,
    requiresQtyPerPack: false,
    requiresMoqCartonLogic: false,
    requiresPiecesPerKg: false,
    requiresExportFields: false,
  },
  packaging_material: {
    customerFacing: false,
    catalogueVisible: false,
    requiresMrp: false,
    requiresB2bPrice: false,
    requiresExportPrice: false,
    requiresHeroImage: false,
    requiresPackaging: false,
    requiresQtyPerPack: false,
    requiresMoqCartonLogic: false,
    requiresPiecesPerKg: false,
    requiresExportFields: false,
  },
};

export function getSaleTypeRequirements(
  saleType: SaleType,
  opts?: { b2bEnabled?: boolean },
): SaleTypeRequirements {
  const base = REQUIREMENTS[saleType] ?? REQUIREMENTS.retail_ready_pack;
  if (saleType === "retail_ready_pack" && opts?.b2bEnabled) {
    return { ...base, requiresB2bPrice: true };
  }
  return base;
}

/** Maps sale type onto the existing persisted product_class where one exists. */
export function productClassForSaleType(saleType: SaleType): string | null {
  switch (saleType) {
    case "retail_ready_pack":
      return "ready_pack";
    case "b2b_horeca":
      return "bulk_loose_product";
    case "gift_hamper":
      return "gift_hamper";
    default:
      return null; // export / internal_bom / packaging_material have no dedicated class today
  }
}

/** Best-effort inverse: derive a sale type from persisted product fields. */
export function saleTypeFromForm(form: Record<string, unknown>): SaleType {
  const cls = String(form.product_class ?? "").toLowerCase();
  if (cls === "ready_pack") return "retail_ready_pack";
  if (cls === "gift_hamper") return "gift_hamper";
  if (cls === "bulk_loose_product") return "b2b_horeca";
  const dept = String(form.main_department ?? "").toLowerCase();
  if (dept === "packing_material" || String(form.category ?? "").toLowerCase().includes("packaging")) {
    return "packaging_material";
  }
  return "b2b_horeca";
}
