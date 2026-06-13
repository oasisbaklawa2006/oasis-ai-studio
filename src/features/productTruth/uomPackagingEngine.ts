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
export function convertOrderedQtyToBaseQty(
  qty: number,
  uom: string,
  hierarchy: PackagingHierarchy,
): number | null {
  const normalized = normalizeUom(uom);
  if (!normalized || !Number.isFinite(qty)) return null;

  const piecesPerKg =
    hierarchy.piecesPerKg ??
    (hierarchy.gramsPerPiece ? 1000 / hierarchy.gramsPerPiece : null);

  switch (normalized) {
    case "kg":
      return qty;
    case "grams":
      return qty / 1000;
    case "pcs":
      if (!piecesPerKg) return null;
      return qty / piecesPerKg;
    case "tray": {
      const kgPerTray = hierarchy.kgPerTray;
      if (kgPerTray == null || kgPerTray <= 0) return null;
      return qty * kgPerTray;
    }
    case "carton":
    case "pack":
    case "box": {
      const traysPerCarton = hierarchy.packsPerCarton ?? hierarchy.traysPerMasterCarton;
      const kgPerTray = hierarchy.kgPerTray;
      if (traysPerCarton == null || kgPerTray == null) return null;
      return qty * traysPerCarton * kgPerTray;
    }
    case "master_carton": {
      const traysPerMc = hierarchy.traysPerMasterCarton;
      const kgPerTray = hierarchy.kgPerTray;
      if (traysPerMc == null || kgPerTray == null) return null;
      return qty * traysPerMc * kgPerTray;
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
  if (!normalized) return null;
  const piecesPerKg =
    hierarchy.piecesPerKg ??
    (hierarchy.gramsPerPiece ? 1000 / hierarchy.gramsPerPiece : null);

  switch (normalized) {
    case "kg":
      return baseKg;
    case "grams":
      return baseKg * 1000;
    case "pcs":
      return piecesPerKg ? baseKg * piecesPerKg : null;
    case "tray": {
      const kgPerTray = hierarchy.kgPerTray;
      if (kgPerTray == null || kgPerTray <= 0) return null;
      return baseKg / kgPerTray;
    }
    case "master_carton": {
      const traysPerMc = hierarchy.traysPerMasterCarton;
      const kgPerTray = hierarchy.kgPerTray;
      if (traysPerMc == null || kgPerTray == null) return null;
      return baseKg / (traysPerMc * kgPerTray);
    }
    default:
      return null;
  }
}

export function calculateReadyGoodsPickQty(
  orderQty: number,
  orderUom: string,
  hierarchy: PackagingHierarchy,
): number | null {
  const base = convertOrderedQtyToBaseQty(orderQty, orderUom, hierarchy);
  if (base == null) return null;
  return applyRoundingRule(base, hierarchy.roundingRule ?? "nearest");
}

export function calculateProductionDemandQty(
  pickKg: number,
  hierarchy: PackagingHierarchy,
  yieldFactor = 1,
): number | null {
  if (!Number.isFinite(pickKg)) return null;
  return applyRoundingRule(pickKg * yieldFactor, hierarchy.roundingRule ?? "ceil");
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

export function validateConversionRuleChain(
  hierarchy: PackagingHierarchy,
): { valid: boolean; messages: string[] } {
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
  return `${qty} ${uom} ≈ ${base} kg` + (trays != null ? ` ≈ ${applyRoundingRule(trays, "nearest", 2)} tray(s)` : "") + (pcs != null ? ` (${applyRoundingRule(pcs, "nearest", 0)} pcs)` : "");
}
