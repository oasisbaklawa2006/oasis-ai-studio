/**
 * Point 37 — packaging / label-readiness canonical authority.
 *
 * Ownership:
 * - Packaging type/form: Core `products.packaging_code` validated against active taxonomy
 *   (`evaluatePackagingReadiness`) — wins over shadow free-text `pack_size` / `primary_pack_type`
 * - Pack / inner / master carton declarations: Point 33 `buildCanonicalPackagingHierarchy`
 * - Legal / FSSAI / metrology: `labelReadiness.ts` data gaps (not scored as pass until persisted)
 * - Artwork / label assets: media readiness slots (`label_front_image`, `label_back_image`,
 *   `packaging_reference`) — Trace print execution remains Point 95
 * - Barcode / EAN linkage: Core `products.barcode_sku` (claim-governed write path)
 *
 * Deliberately separate from catalogue readiness (`catalogueReadyGate`, `buildMeter`) and
 * Product Truth packaging conversion (`productReadiness.evalPackaging`). This answers whether
 * a product can honestly move toward label design / packaging print — fail-closed on
 * placeholders, shadow-only fields, and schema-blocked legal data.
 *
 * Point 35 dimensions/CBM and Point 36 MOQ/lead-time are referenced only, never computed here.
 */
import { hasNumericInput, hasText } from "@/features/catalogueAiStudio/catalogueFieldUtils";
import { normalizeBarcodeInput } from "@/features/fastCreate/intake/barcodeChecksum";
import type { MediaAsset } from "@/features/mediaReadiness/types";
import { buildCanonicalPackagingHierarchy } from "@/features/productTruth/packagingHierarchyCanonical";
import {
  evaluatePackagingReadiness,
  normalizePackagingCode,
  type PackagingTaxonomyAuthority,
} from "./catalogueReadyGate";
import {
  computeLabelReadiness,
  getLabelDataGaps,
  type LabelReadinessResult,
} from "./labelReadiness";
import { getSaleTypeRequirements, type SaleType } from "./saleType";

export const POINT_37_CORE_DEPENDENCIES = {
  /** Smallest bounded Core prerequisite — FSSAI licence is mandatory for Indian retail label print. */
  fssaiLicence: ["products.fssai_licence_number (or equivalent label-compliance column bundle)"],
} as const;

export const PACKAGING_TYPE_SHADOW_FIELDS = [
  "pack_size",
  "primary_pack_type",
  "pack_label",
  "pdf_primary_packaging",
  "pdf_secondary_packaging",
] as const;

export type PackagingTypeAuthorityState =
  | "complete"
  | "missing"
  | "invalid"
  | "shadow_only"
  | "not_required";

export type HierarchyLabelLevel = "sellable_pack" | "inner_carton" | "master_carton";

export type HierarchyLabelState = "pass" | "warn" | "missing" | "not_applicable";

export interface PackagingTypeAuthorityResult {
  state: PackagingTypeAuthorityState;
  canonicalField: "packaging_code";
  packagingCode: string | null;
  shadowOnly: boolean;
  publicationBlockers: string[];
  warnings: string[];
}

export interface HierarchyLabelLevelResult {
  level: HierarchyLabelLevel;
  label: string;
  state: HierarchyLabelState;
  detail: string;
  publicationBlockers: string[];
}

export interface ArtworkLabelAssetResult {
  state: "complete" | "partial" | "missing" | "not_required";
  requiredSlots: string[];
  presentApproved: string[];
  publicationBlockers: string[];
}

export interface BarcodeLinkageResult {
  state: "complete" | "missing" | "invalid" | "not_required";
  barcode: string | null;
  format: string | null;
  publicationBlockers: string[];
}

export type Point37PackagingLabelReadinessSnapshot = {
  schema: "point37_v1";
  packaging_type: {
    state: PackagingTypeAuthorityState;
    canonical_field: "packaging_code";
    packaging_code: string | null;
    shadow_only: boolean;
    publication_blockers: string[];
  };
  hierarchy_labels: Array<{
    level: HierarchyLabelLevel;
    state: HierarchyLabelState;
    detail: string;
    publication_blockers: string[];
  }>;
  legal_label_gaps: {
    not_persisted: string[];
    no_column: string[];
    core_dependencies: readonly string[];
  };
  artwork: {
    state: ArtworkLabelAssetResult["state"];
    required_slots: string[];
    present_approved: string[];
    publication_blockers: string[];
  };
  barcode: {
    state: BarcodeLinkageResult["state"];
    barcode: string | null;
    format: string | null;
    publication_blockers: string[];
  };
  label_readiness: Pick<LabelReadinessResult, "overallStatus" | "categories">;
  publication_blockers: string[];
  ready_for_label_design: boolean;
};

export interface PackagingLabelReadinessInput {
  form: Record<string, unknown>;
  saleType: SaleType;
  packagingAuthority: PackagingTaxonomyAuthority | null;
  mediaAssets?: MediaAsset[];
}

function positiveNum(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function hasShadowPackagingOnly(form: Record<string, unknown>): boolean {
  const hasCode = hasText(form.packaging_code as string | null | undefined);
  if (hasCode) return false;
  return PACKAGING_TYPE_SHADOW_FIELDS.some((field) =>
    hasText(form[field] as string | null | undefined),
  );
}

/**
 * Canonical packaging type — taxonomy `packaging_code` wins; free-text pack fields alone fail closed.
 */
export function evaluatePackagingTypeAuthority(
  form: Record<string, unknown>,
  saleType: SaleType,
  packagingAuthority: PackagingTaxonomyAuthority | null,
): PackagingTypeAuthorityResult {
  const req = getSaleTypeRequirements(saleType);
  const publicationBlockers: string[] = [];
  const warnings: string[] = [];
  const packagingCode = hasText(form.packaging_code as string | null | undefined)
    ? normalizePackagingCode(form.packaging_code)
    : null;

  if (!req.requiresPackaging) {
    return {
      state: "not_required",
      canonicalField: "packaging_code",
      packagingCode,
      shadowOnly: false,
      publicationBlockers,
      warnings,
    };
  }

  if (!packagingCode) {
    if (hasShadowPackagingOnly(form)) {
      publicationBlockers.push(
        "Packaging type requires taxonomy packaging_code — free-text pack_size/primary_pack_type alone is insufficient",
      );
      return {
        state: "shadow_only",
        canonicalField: "packaging_code",
        packagingCode: null,
        shadowOnly: true,
        publicationBlockers,
        warnings,
      };
    }
    publicationBlockers.push("Packaging code missing — select an active packaging type");
    return {
      state: "missing",
      canonicalField: "packaging_code",
      packagingCode: null,
      shadowOnly: false,
      publicationBlockers,
      warnings,
    };
  }

  if (
    !evaluatePackagingReadiness({
      packagingCode,
      sku: form.sku,
      packagingAuthority,
    })
  ) {
    if (!packagingAuthority) {
      publicationBlockers.push("Packaging taxonomy not loaded — cannot confirm packaging type");
    } else if (!packagingAuthority.activeCodes.has(packagingCode)) {
      publicationBlockers.push(`Packaging code "${packagingCode}" is not an active taxonomy code`);
    } else {
      publicationBlockers.push("Packaging code disagrees with SKU packaging segment");
    }
    return {
      state: "invalid",
      canonicalField: "packaging_code",
      packagingCode,
      shadowOnly: false,
      publicationBlockers,
      warnings,
    };
  }

  if (hasShadowPackagingOnly(form)) {
    warnings.push("Shadow pack fields present without replacing canonical packaging_code");
  }

  return {
    state: "complete",
    canonicalField: "packaging_code",
    packagingCode,
    shadowOnly: false,
    publicationBlockers,
    warnings,
  };
}

function evaluateHierarchyLabelLevel(
  level: HierarchyLabelLevel,
  form: Record<string, unknown>,
  saleType: SaleType,
): HierarchyLabelLevelResult {
  const req = getSaleTypeRequirements(saleType);
  const hierarchy = buildCanonicalPackagingHierarchy(form);
  const publicationBlockers: string[] = [];

  const sellableNode = hierarchy.nodes.find((n) => n.level === "sellable_pack");
  const caseNode = hierarchy.nodes.find((n) => n.level === "case_carton");
  const masterNode = hierarchy.nodes.find((n) => n.level === "master_carton");

  if (level === "sellable_pack") {
    if (!req.customerFacing) {
      return {
        level,
        label: "Sellable pack label",
        state: "not_applicable",
        detail: "Not required for internal products",
        publicationBlockers: [],
      };
    }
    const hasQty =
      positiveNum(form.pcs_per_pack) != null ||
      positiveNum(form.qty_per_pack) != null ||
      (hasText(form.pack_size as string | null | undefined) && hasNumericInput(form.net_weight_g));
    const hasType =
      hasText(form.primary_pack_type as string | null | undefined) ||
      hasText(form.packaging_code as string | null | undefined) ||
      hasText(form.pack_size as string | null | undefined);
    if (!hasQty || !hasType) {
      if (!hasQty) publicationBlockers.push("Sellable pack quantity declaration missing");
      if (!hasType) publicationBlockers.push("Sellable pack type/form missing");
      return {
        level,
        label: "Sellable pack label",
        state: "missing",
        detail: "Pack label needs qty + type for print",
        publicationBlockers,
      };
    }
    if (!sellableNode?.present) {
      publicationBlockers.push("Sellable pack hierarchy node incomplete");
      return {
        level,
        label: "Sellable pack label",
        state: "warn",
        detail: "Partial pack declaration — verify hierarchy",
        publicationBlockers,
      };
    }
    return {
      level,
      label: "Sellable pack label",
      state: "pass",
      detail: "Sellable pack declaration present",
      publicationBlockers: [],
    };
  }

  if (level === "inner_carton") {
    const needsCarton =
      req.requiresMoqCartonLogic ||
      !!form.fixed_carton_required ||
      positiveNum(form.carton_qty) != null ||
      positiveNum(form.pcs_per_carton) != null;
    if (!needsCarton) {
      return {
        level,
        label: "Inner / case carton label",
        state: "not_applicable",
        detail: "Carton label not required for this sale type",
        publicationBlockers: [],
      };
    }
    const hasCarton =
      positiveNum(form.carton_qty) != null || positiveNum(form.pcs_per_carton) != null;
    if (!hasCarton) {
      publicationBlockers.push("Inner/case carton quantity missing for carton-based selling");
      return {
        level,
        label: "Inner / case carton label",
        state: "missing",
        detail: "Carton qty or pcs_per_carton required",
        publicationBlockers,
      };
    }
    if (!caseNode?.present) {
      publicationBlockers.push("Case/carton hierarchy node incomplete");
      return {
        level,
        label: "Inner / case carton label",
        state: "warn",
        detail: "Carton fields present but hierarchy validation incomplete",
        publicationBlockers,
      };
    }
    return {
      level,
      label: "Inner / case carton label",
      state: "pass",
      detail: "Case/carton declaration present",
      publicationBlockers: [],
    };
  }

  // master_carton
  const hasMaster = positiveNum(form.master_carton_qty) != null;
  if (!hasMaster) {
    return {
      level,
      label: "Master carton label",
      state: "not_applicable",
      detail: "Master carton not declared",
      publicationBlockers: [],
    };
  }
  if (!masterNode?.present) {
    publicationBlockers.push("Master carton quantity present but hierarchy node incomplete");
    return {
      level,
      label: "Master carton label",
      state: "warn",
      detail: "Verify master carton nesting",
      publicationBlockers,
    };
  }
  return {
    level,
    label: "Master carton label",
    state: "pass",
    detail: "Master carton declaration present",
    publicationBlockers: [],
  };
}

export function evaluateHierarchyLabelReadiness(
  form: Record<string, unknown>,
  saleType: SaleType,
): HierarchyLabelLevelResult[] {
  return (["sellable_pack", "inner_carton", "master_carton"] as HierarchyLabelLevel[]).map(
    (level) => evaluateHierarchyLabelLevel(level, form, saleType),
  );
}

const EXPORT_ARTWORK_SLOTS = ["label_front_image", "packaging_reference"] as const;
const RETAIL_ARTWORK_SLOTS = ["packaging_reference"] as const;

function approvedAssetTypes(assets: MediaAsset[]): string[] {
  return assets.filter((a) => a.url && a.status === "approved").map((a) => a.type);
}

/**
 * Artwork / label asset state — media slots only; Trace print pipeline is Point 95.
 */
export function evaluateArtworkLabelAssets(
  saleType: SaleType,
  mediaAssets: MediaAsset[] = [],
): ArtworkLabelAssetResult {
  const req = getSaleTypeRequirements(saleType);
  const publicationBlockers: string[] = [];

  if (!req.customerFacing) {
    return {
      state: "not_required",
      requiredSlots: [],
      presentApproved: [],
      publicationBlockers: [],
    };
  }

  const requiredSlots =
    saleType === "export"
      ? [...EXPORT_ARTWORK_SLOTS]
      : req.requiresExportFields
        ? [...EXPORT_ARTWORK_SLOTS]
        : [...RETAIL_ARTWORK_SLOTS];

  const presentApproved = approvedAssetTypes(mediaAssets);
  const missing = requiredSlots.filter((slot) => !presentApproved.includes(slot));

  if (requiredSlots.length === 0) {
    return { state: "not_required", requiredSlots, presentApproved, publicationBlockers };
  }

  if (missing.length === requiredSlots.length) {
    if (saleType === "export" || req.requiresExportFields) {
      publicationBlockers.push(
        "Export label artwork missing — front label / packaging reference required",
      );
    }
    return {
      state: "missing",
      requiredSlots,
      presentApproved,
      publicationBlockers,
    };
  }

  if (missing.length > 0) {
    publicationBlockers.push(`Label artwork incomplete — missing: ${missing.join(", ")}`);
    return {
      state: "partial",
      requiredSlots,
      presentApproved,
      publicationBlockers,
    };
  }

  return {
    state: "complete",
    requiredSlots,
    presentApproved,
    publicationBlockers,
  };
}

/**
 * Barcode / EAN linkage — `products.barcode_sku` is canonical; labels table print rows are Trace-owned.
 */
export function evaluateBarcodeLinkage(
  form: Record<string, unknown>,
  saleType: SaleType,
): BarcodeLinkageResult {
  const req = getSaleTypeRequirements(saleType);
  const publicationBlockers: string[] = [];
  const raw = hasText(form.barcode_sku as string | null | undefined)
    ? String(form.barcode_sku).trim()
    : null;

  if (!req.customerFacing) {
    return {
      state: "not_required",
      barcode: raw,
      format: null,
      publicationBlockers: [],
    };
  }

  if (!raw) {
    if (saleType === "export" || req.requiresExportFields) {
      publicationBlockers.push("Barcode/EAN missing — required for export label linkage");
    }
    return {
      state: "missing",
      barcode: null,
      format: null,
      publicationBlockers,
    };
  }

  const normalized = normalizeBarcodeInput(raw);
  if (!normalized.ok) {
    publicationBlockers.push(`Barcode/EAN invalid: ${normalized.reason}`);
    return {
      state: "invalid",
      barcode: raw,
      format: null,
      publicationBlockers,
    };
  }

  return {
    state: "complete",
    barcode: normalized.barcode,
    format: normalized.format,
    publicationBlockers: [],
  };
}

export function evaluatePackagingLabelReadiness(input: PackagingLabelReadinessInput): {
  packagingType: PackagingTypeAuthorityResult;
  hierarchyLabels: HierarchyLabelLevelResult[];
  legalLabel: LabelReadinessResult;
  artwork: ArtworkLabelAssetResult;
  barcode: BarcodeLinkageResult;
  publicationBlockers: string[];
  readyForLabelDesign: boolean;
  snapshot: Point37PackagingLabelReadinessSnapshot;
} {
  const packagingType = evaluatePackagingTypeAuthority(
    input.form,
    input.saleType,
    input.packagingAuthority,
  );
  const hierarchyLabels = evaluateHierarchyLabelReadiness(input.form, input.saleType);
  const legalLabel = computeLabelReadiness({
    product_name: input.form.product_name as string | null | undefined,
    category: input.form.category as string | null | undefined,
    shelf_life_days: input.form.shelf_life_days as number | string | null | undefined,
    storage_instructions: input.form.storage_instructions as string | null | undefined,
    pack_size: input.form.pack_size as string | null | undefined,
    net_weight_g: input.form.net_weight_g as number | string | null | undefined,
    pcs_per_pack: input.form.pcs_per_pack as number | string | null | undefined,
  });
  const artwork = evaluateArtworkLabelAssets(input.saleType, input.mediaAssets ?? []);
  const barcode = evaluateBarcodeLinkage(input.form, input.saleType);

  const legalGaps = getLabelDataGaps();
  const notPersisted = legalGaps.filter((g) => g.severity === "not_persisted").map((g) => g.key);
  const noColumn = legalGaps.filter((g) => g.severity === "no_column").map((g) => g.key);

  const publicationBlockers = Array.from(
    new Set([
      ...packagingType.publicationBlockers,
      ...hierarchyLabels.flatMap((h) => h.publicationBlockers),
      ...artwork.publicationBlockers,
      ...barcode.publicationBlockers,
      // Legal gaps always block honest "ready for label design" — fail-closed.
      ...notPersisted.map((key) => `Legal label field not persisted: ${key}`),
      ...noColumn.map((key) => `Legal label field has no column: ${key}`),
    ]),
  );

  const hierarchyPass = hierarchyLabels.every(
    (h) => h.state === "pass" || h.state === "not_applicable",
  );
  const scoredLegalPass = legalLabel.categories.every((c) => c.state === "pass");
  const readyForLabelDesign =
    packagingType.state === "complete" &&
    hierarchyPass &&
    scoredLegalPass &&
    artwork.state === "complete" &&
    (barcode.state === "complete" || barcode.state === "not_required") &&
    publicationBlockers.length === 0;

  const snapshot: Point37PackagingLabelReadinessSnapshot = {
    schema: "point37_v1",
    packaging_type: {
      state: packagingType.state,
      canonical_field: "packaging_code",
      packaging_code: packagingType.packagingCode,
      shadow_only: packagingType.shadowOnly,
      publication_blockers: packagingType.publicationBlockers,
    },
    hierarchy_labels: hierarchyLabels.map((h) => ({
      level: h.level,
      state: h.state,
      detail: h.detail,
      publication_blockers: h.publicationBlockers,
    })),
    legal_label_gaps: {
      not_persisted: notPersisted,
      no_column: noColumn,
      core_dependencies: POINT_37_CORE_DEPENDENCIES.fssaiLicence,
    },
    artwork: {
      state: artwork.state,
      required_slots: artwork.requiredSlots,
      present_approved: artwork.presentApproved,
      publication_blockers: artwork.publicationBlockers,
    },
    barcode: {
      state: barcode.state,
      barcode: barcode.barcode,
      format: barcode.format,
      publication_blockers: barcode.publicationBlockers,
    },
    label_readiness: {
      overallStatus: legalLabel.overallStatus,
      categories: legalLabel.categories,
    },
    publication_blockers: publicationBlockers,
    ready_for_label_design: readyForLabelDesign,
  };

  return {
    packagingType,
    hierarchyLabels,
    legalLabel,
    artwork,
    barcode,
    publicationBlockers,
    readyForLabelDesign,
    snapshot,
  };
}
