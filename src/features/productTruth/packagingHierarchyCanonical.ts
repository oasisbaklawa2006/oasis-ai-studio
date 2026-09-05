import { packagingHierarchyFromForm } from "./packagingHierarchyFromForm";
import type { PackagingHierarchy } from "./types";

/** Canonical Point 33 hierarchy levels (product SKU scope — no variant table). */
export type PackagingHierarchyLevel =
  | "product"
  | "sellable_pack"
  | "case_carton"
  | "master_carton"
  | "pallet";

export type PackagingPersistence = "products_row" | "form_only" | "snapshot_only" | "core_blocked";

export type PackagingHierarchyNode = {
  level: PackagingHierarchyLevel;
  label: string;
  /** Child units contained in one unit at this level (e.g. packs per carton). */
  qtyPerParent: number | null;
  uom: string | null;
  persistence: PackagingPersistence;
  sourceFields: string[];
  present: boolean;
};

export type CanonicalPackagingHierarchy = {
  productId: string | null;
  sku: string | null;
  /** Single-SKU scope until Core variant table ships. */
  variantScope: "product_sku";
  nodes: PackagingHierarchyNode[];
  engine: PackagingHierarchy;
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  /** Exact Core gaps — do not shadow-persist these in AI Studio. */
  coreDependencies: string[];
  /** Dimensions/CBM remain Point 35 authority — referenced only, never computed here. */
  point35DimensionAuthority: true;
};

export const POINT_33_CORE_DEPENDENCIES = {
  pallet: [
    "products.cartons_per_pallet",
    "products.master_cartons_per_pallet",
    "products.pallet_uom",
  ],
  variant: ["product_variants table (per-variant pack hierarchy)"],
} as const;

function positiveNum(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isExplicitZero(v: unknown): boolean {
  if (v === "" || v == null) return false;
  const n = Number(v);
  return Number.isFinite(n) && n === 0;
}

function str(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  return s || null;
}

function sellablePackQty(form: Record<string, unknown>): number | null {
  return (
    positiveNum(form.qty_per_pack) ??
    positiveNum(form.pcs_per_pack) ??
    positiveNum(form.net_weight_g)
  );
}

function sellablePackUom(form: Record<string, unknown>): string | null {
  return (
    str(form.primary_pack_uom) ?? str(form.primary_uom) ?? str(form.retail_uom) ?? str(form.b2b_uom)
  );
}

function caseCartonQty(
  form: Record<string, unknown>,
  packsPerCarton: number | null,
): number | null {
  const pcsPerCarton = positiveNum(form.pcs_per_carton);
  const pcsPerPack = sellablePackQty(form);
  if (pcsPerCarton && pcsPerPack) {
    return Number((pcsPerCarton / pcsPerPack).toFixed(4));
  }
  return positiveNum(form.carton_qty) ?? packsPerCarton;
}

function masterCartonChildQty(
  form: Record<string, unknown>,
  caseQty: number | null,
): number | null {
  const masterQty = positiveNum(form.master_carton_qty);
  if (!masterQty) return null;
  const masterUom = String(form.master_carton_uom ?? "").toLowerCase();
  if (masterUom.includes("carton") || masterUom === "case") {
    return caseQty != null ? Number((masterQty / caseQty).toFixed(4)) : masterQty;
  }
  return masterQty;
}

/** Enrich UI-only pack fields from persisted products-row columns (safe read adapter). */
export function enrichPackFormFromDbRow(data: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const pcsPerPack = positiveNum(data.pcs_per_pack);
  const primaryUom = str(data.primary_uom) ?? str(data.retail_uom) ?? str(data.b2b_uom);

  if (!data.qty_per_pack && pcsPerPack) {
    patch.qty_per_pack = pcsPerPack;
  }
  if (!data.pcs_per_pack && data.qty_per_pack) {
    patch.pcs_per_pack = data.qty_per_pack;
  }
  if (!data.primary_pack_uom && primaryUom) {
    patch.primary_pack_uom = primaryUom;
  }
  if (!data.primary_pack_type) {
    const fromPackagingCode = str(data.packaging_code);
    const fromPackSize = str(data.pack_size);
    if (fromPackagingCode) {
      patch.primary_pack_type = fromPackagingCode;
    } else if (fromPackSize) {
      patch.primary_pack_type = fromPackSize;
    }
  }
  if (!data.qty_content_uom) {
    const contentUom = str(data.primary_uom) ?? (pcsPerPack ? "pcs" : null);
    if (contentUom) patch.qty_content_uom = contentUom;
  }
  return patch;
}

export function buildCanonicalPackagingHierarchy(
  form: Record<string, unknown>,
): CanonicalPackagingHierarchy {
  const engine = packagingHierarchyFromForm(form);
  const packsPerCarton = engine.packsPerCarton;
  const sellableQty = sellablePackQty(form);
  const sellableUom = sellablePackUom(form);
  const caseQty = caseCartonQty(form, packsPerCarton);
  const caseUom = str(form.carton_uom) ?? "carton";
  const masterQty = positiveNum(form.master_carton_qty);
  const masterUom = str(form.master_carton_uom) ?? "master_carton";
  const masterChildQty = masterCartonChildQty(form, caseQty);

  const nodes: PackagingHierarchyNode[] = [
    {
      level: "product",
      label: "Product / SKU",
      qtyPerParent: null,
      uom: null,
      persistence: "products_row",
      sourceFields: ["id", "sku", "product_name"],
      present: !!(str(form.sku) || str(form.product_name)),
    },
    {
      level: "sellable_pack",
      label: "Sellable pack",
      qtyPerParent: sellableQty,
      uom: sellableUom,
      persistence: positiveNum(form.pcs_per_pack) != null ? "products_row" : "form_only",
      sourceFields: [
        "pcs_per_pack",
        "qty_per_pack",
        "primary_pack_type",
        "primary_pack_uom",
        "pack_size",
      ],
      present: sellableQty != null || !!str(form.primary_pack_type),
    },
    {
      level: "case_carton",
      label: "Case / inner carton",
      qtyPerParent: caseQty,
      uom: caseUom,
      persistence: "products_row",
      sourceFields: ["carton_qty", "carton_uom", "pcs_per_carton"],
      present: caseQty != null || positiveNum(form.pcs_per_carton) != null,
    },
    {
      level: "master_carton",
      label: "Master carton",
      qtyPerParent: masterChildQty ?? masterQty,
      uom: masterUom,
      persistence: "products_row",
      sourceFields: ["master_carton_qty", "master_carton_uom"],
      present: masterQty != null,
    },
    {
      level: "pallet",
      label: "Pallet (optional)",
      qtyPerParent: null,
      uom: null,
      persistence: "core_blocked",
      sourceFields: POINT_33_CORE_DEPENDENCIES.pallet,
      present: false,
    },
  ];

  const errors: string[] = [];
  const warnings: string[] = [];

  if (isExplicitZero(form.pcs_per_carton)) {
    errors.push("pcs_per_carton must be greater than zero");
  }
  if (isExplicitZero(form.carton_qty)) {
    errors.push("carton_qty must be greater than zero");
  }
  if (isExplicitZero(form.master_carton_qty)) {
    errors.push("master_carton_qty must be greater than zero");
  }
  if (isExplicitZero(form.qty_per_pack) || isExplicitZero(form.pcs_per_pack)) {
    errors.push("sellable pack quantity must be greater than zero");
  }

  const pcsPerCarton = positiveNum(form.pcs_per_carton);
  if (pcsPerCarton && sellableQty && packsPerCarton != null) {
    const implied = Number((pcsPerCarton / sellableQty).toFixed(4));
    const cartonQty = positiveNum(form.carton_qty);
    if (cartonQty != null && Math.abs(implied - cartonQty) > 0.01) {
      warnings.push(
        `carton_qty (${cartonQty}) differs from pcs_per_carton/pcs_per_pack (${implied})`,
      );
    }
  }

  if (nodes[1].present && nodes[2].present && caseQty != null && sellableQty != null) {
    if (caseQty < 1) {
      errors.push("case/carton must contain at least one sellable pack");
    }
  }

  if (nodes[2].present && nodes[3].present && masterQty != null && caseQty != null) {
    const masterUomLower = masterUom.toLowerCase();
    if (masterUomLower.includes("carton") && masterQty < caseQty) {
      warnings.push("master_carton_qty is smaller than case carton_qty — verify nesting");
    }
  }

  const coreDependencies = [...POINT_33_CORE_DEPENDENCIES.pallet];

  return {
    productId: str(form.id),
    sku: str(form.sku),
    variantScope: "product_sku",
    nodes,
    engine,
    validation: {
      valid: errors.length === 0,
      errors,
      warnings,
    },
    coreDependencies,
    point35DimensionAuthority: true,
  };
}

export type SnapshotPackagingHierarchy = {
  schema: "point33_v1";
  variant_scope: "product_sku";
  primary_pack: Record<string, unknown>;
  case_carton: Record<string, unknown>;
  master_carton: Record<string, unknown>;
  pallet: {
    persistence: "core_blocked";
    core_dependencies: string[];
    optional: true;
  };
  hierarchy_chain: Array<{
    level: PackagingHierarchyLevel;
    qty_per_parent: number | null;
    uom: string | null;
    persistence: PackagingPersistence;
  }>;
  validation: CanonicalPackagingHierarchy["validation"];
  /** Point 35 owns dimensions/CBM — pass-through refs only when present on form. */
  dimension_refs: {
    product_dimensions_cm: string | null;
    carton_dimensions_cm: string | null;
    dimension_l_cm: number | null;
    dimension_w_cm: number | null;
    dimension_h_cm: number | null;
    cbm: number | null;
    authority: "point35";
  };
};

export function serializePackagingHierarchyForSnapshot(
  form: Record<string, unknown>,
): SnapshotPackagingHierarchy {
  const canonical = buildCanonicalPackagingHierarchy(form);

  return {
    schema: "point33_v1",
    variant_scope: canonical.variantScope,
    primary_pack: {
      type: form.primary_pack_type,
      uom: form.primary_pack_uom ?? form.primary_uom,
      qty_per_pack: form.qty_per_pack ?? form.pcs_per_pack,
      qty_content_uom: form.qty_content_uom,
      pack_label: form.pack_label,
      pcs_per_pack: form.pcs_per_pack,
    },
    case_carton: {
      qty: form.carton_qty,
      uom: form.carton_uom,
      pcs_per_carton: form.pcs_per_carton,
      packs_per_carton: canonical.engine.packsPerCarton,
      fixed_carton_required: form.fixed_carton_required ?? false,
      carton_logic: form.carton_logic,
    },
    master_carton: {
      qty: form.master_carton_qty,
      uom: form.master_carton_uom,
      trays_or_units_per_master: canonical.engine.traysPerMasterCarton,
      weight_kg: form.master_carton_weight_kg ?? null,
    },
    pallet: {
      persistence: "core_blocked",
      core_dependencies: [...canonical.coreDependencies],
      optional: true,
    },
    hierarchy_chain: canonical.nodes.map((n) => ({
      level: n.level,
      qty_per_parent: n.qtyPerParent,
      uom: n.uom,
      persistence: n.persistence,
    })),
    validation: canonical.validation,
    dimension_refs: {
      product_dimensions_cm: str(form.product_dimensions_cm),
      carton_dimensions_cm: str(form.carton_dimensions_cm),
      dimension_l_cm: positiveNum(form.dimension_l_cm),
      dimension_w_cm: positiveNum(form.dimension_w_cm),
      dimension_h_cm: positiveNum(form.dimension_h_cm),
      cbm: positiveNum(form.cbm),
      authority: "point35",
    },
  };
}

/** Round-trip only persisted products-row pack fields (never writes core_blocked pallet). */
export function persistedPackFieldsFromHierarchy(
  form: Record<string, unknown>,
): Record<string, unknown> {
  const canonical = buildCanonicalPackagingHierarchy(form);
  const out: Record<string, unknown> = {};

  const sellable = canonical.nodes.find((n) => n.level === "sellable_pack");
  if (sellable?.qtyPerParent) {
    out.pcs_per_pack = sellable.qtyPerParent;
  }

  const caseNode = canonical.nodes.find((n) => n.level === "case_carton");
  if (caseNode?.qtyPerParent) {
    out.carton_qty = caseNode.qtyPerParent;
  }
  if (form.carton_uom) out.carton_uom = form.carton_uom;

  const master = canonical.nodes.find((n) => n.level === "master_carton");
  if (master?.qtyPerParent) {
    out.master_carton_qty = positiveNum(form.master_carton_qty) ?? master.qtyPerParent;
  }
  if (form.master_carton_uom) out.master_carton_uom = form.master_carton_uom;

  const pcsPerCarton = positiveNum(form.pcs_per_carton);
  if (pcsPerCarton) out.pcs_per_carton = pcsPerCarton;

  return out;
}
