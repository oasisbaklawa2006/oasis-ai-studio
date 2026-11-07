import type { ConversionRule, PackagingHierarchy, RoundingRule, UomCode } from "./types";

const UOM_ALIASES: Record<string, UomCode> = {
  pc: "pcs",
  piece: "pcs",
  pieces: "pcs",
  g: "grams",
  gram: "grams",
  kilogram: "kg",
  master_carton: "master_carton",
  mastercarton: "master_carton",
};

export function normalizeUom(uom: string | null | undefined): UomCode | null {
  const key = String(uom ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (!key) return null;
  return (UOM_ALIASES[key] ?? (key as UomCode)) || null;
}

export function applyRoundingRule(
  value: number,
  rule: RoundingRule = "nearest",
  decimals = 4,
): number {
  if (!Number.isFinite(value)) return 0;
  let out: number;
  const factor = 10 ** decimals;
  switch (rule) {
    case "ceil":
      out = Math.ceil(value * factor) / factor;
      break;
    case "floor":
      out = Math.floor(value * factor) / factor;
      break;
    case "none":
      out = value;
      break;
    default:
      out = Math.round(value * factor) / factor;
  }
  return out;
}

export function validateConversionRule(rule: ConversionRule): { valid: boolean; message?: string } {
  if (!rule.fromUom || !rule.toUom) {
    return { valid: false, message: "fromUom and toUom are required" };
  }
  if (rule.fromUom === rule.toUom) {
    return { valid: false, message: "fromUom and toUom must differ" };
  }
  if (!Number.isFinite(rule.factor) || rule.factor <= 0) {
    return { valid: false, message: "factor must be a positive number" };
  }
  return { valid: true };
}

/** Convert ordered quantity to base kg using hierarchy (kg-centric base). */
/** Packaging conversion factors are operator-provided facts, never defaults. */
function positiveFinite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function finiteResult(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function positiveWholeCount(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function verifiedPiecesPerKg(hierarchy: PackagingHierarchy): number | null {
  const candidate =
    hierarchy.piecesPerKg ?? (hierarchy.gramsPerPiece ? 1000 / hierarchy.gramsPerPiece : null);
  return positiveFinite(candidate);
}

export function convertOrderedQtyToBaseQty(
  qty: number,
  uom: string,
  hierarchy: PackagingHierarchy,
): number | null {
  const normalized = normalizeUom(uom);
  if (!normalized || !Number.isFinite(qty)) return null;

  const piecesPerKg = verifiedPiecesPerKg(hierarchy);

  switch (normalized) {
    case "kg":
      return qty;
    case "grams":
      return qty / 1000;
    case "pcs":
      return piecesPerKg == null ? null : finiteResult(qty / piecesPerKg);
    case "tray": {
      const kgPerTray = positiveFinite(hierarchy.kgPerTray);
      return kgPerTray == null ? null : finiteResult(qty * kgPerTray);
    }
    case "carton":
    case "pack":
    case "box":
      // packsPerCarton describes carton membership, not kg per retail pack;
      // kgPerTray cannot be substituted for arbitrary boxes or retail packs.
      // These units need an explicitly typed mass/pack conversion in Core #486.
      return null;
    case "master_carton": {
      const traysPerMc = positiveWholeCount(hierarchy.traysPerMasterCarton);
      const kgPerTray = positiveFinite(hierarchy.kgPerTray);
      return traysPerMc == null || kgPerTray == null
        ? null
        : finiteResult(qty * traysPerMc * kgPerTray);
    }
    default:
      return null;
  }
}

export function convertBaseKgToUom(
  baseKg: number,
  targetUom: string,
  hierarchy: PackagingHierarchy,
): number | null {
  const normalized = normalizeUom(targetUom);
  if (!normalized || !Number.isFinite(baseKg)) return null;
  const piecesPerKg = verifiedPiecesPerKg(hierarchy);

  switch (normalized) {
    case "kg":
      return baseKg;
    case "grams":
      return finiteResult(baseKg * 1000);
    case "pcs":
      return piecesPerKg == null ? null : finiteResult(baseKg * piecesPerKg);
    case "tray": {
      const kgPerTray = positiveFinite(hierarchy.kgPerTray);
      return kgPerTray == null ? null : finiteResult(baseKg / kgPerTray);
    }
    case "master_carton": {
      const traysPerMc = positiveWholeCount(hierarchy.traysPerMasterCarton);
      const kgPerTray = positiveFinite(hierarchy.kgPerTray);
      return traysPerMc == null || kgPerTray == null
        ? null
        : finiteResult(baseKg / (traysPerMc * kgPerTray));
    }
    default:
      return null;
  }
}

export function calculateDispatchPackagingQty(
  baseKg: number,
  packUom: string,
  hierarchy: PackagingHierarchy,
): number | null {
  const qty = convertBaseKgToUom(baseKg, packUom, hierarchy);
  if (qty == null) return null;
  const rounded = applyRoundingRule(qty, hierarchy.roundingRule ?? "ceil");
  if (normalizeUom(packUom) === "master_carton" && !hierarchy.allowPartialCarton) {
    return Math.ceil(rounded);
  }
  if (
    (normalizeUom(packUom) === "pack" || normalizeUom(packUom) === "carton") &&
    !hierarchy.allowPartialPack
  ) {
    return Math.ceil(rounded);
  }
  return rounded;
}

export function validateConversionRuleChain(hierarchy: PackagingHierarchy): {
  valid: boolean;
  messages: string[];
} {
  const messages: string[] = [];
  if (!hierarchy.piecesPerKg && !hierarchy.gramsPerPiece) {
    messages.push("piecesPerKg or gramsPerPiece required for pcs ↔ kg");
  }
  if (hierarchy.kgPerTray != null && hierarchy.kgPerTray <= 0) {
    messages.push("kgPerTray must be positive");
  }
  if (hierarchy.traysPerMasterCarton != null && hierarchy.traysPerMasterCarton <= 0) {
    messages.push("traysPerMasterCarton must be positive");
  }
  const tolerance = hierarchy.tolerancePercent ?? 0;
  if (tolerance < 0 || tolerance > 50) {
    messages.push("tolerancePercent should be between 0 and 50");
  }
  return { valid: messages.length === 0, messages };
}

/** Example: 120 pcs with 40 pcs/kg => 3 kg => 3 trays @ 1kg/tray */
export function describeConversion(
  qty: number,
  uom: string,
  hierarchy: PackagingHierarchy,
): string {
  const base = convertOrderedQtyToBaseQty(qty, uom, hierarchy);
  if (base == null) return "Cannot convert";
  const trays = convertBaseKgToUom(base, "tray", hierarchy);
  const pcs = convertBaseKgToUom(base, "pcs", hierarchy);
  return (
    `${qty} ${uom} ≈ ${base} kg` +
    (trays != null ? ` ≈ ${applyRoundingRule(trays, "nearest", 2)} tray(s)` : "") +
    (pcs != null ? ` (${applyRoundingRule(pcs, "nearest", 0)} pcs)` : "")
  );
}
