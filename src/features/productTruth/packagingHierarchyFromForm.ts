import type { PackagingHierarchy } from "./types";

function positiveNum(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Build packaging hierarchy from product form / DB row — no misleading defaults. */
export function packagingHierarchyFromForm(form: Record<string, unknown>): PackagingHierarchy {
  const gramsPerPiece = positiveNum(form.approximate_piece_weight_g);
  const piecesPerKg =
    positiveNum(form.pieces_per_kg) ??
    (gramsPerPiece ? Number((1000 / gramsPerPiece).toFixed(4)) : null);

  const pcsPerPack = positiveNum(form.pcs_per_pack);
  const pcsPerCarton = positiveNum(form.pcs_per_carton);
  const cartonQty = positiveNum(form.carton_qty);
  const masterCartonQty = positiveNum(form.master_carton_qty);

  let packsPerCarton: number | null = null;
  if (pcsPerPack && pcsPerCarton) {
    packsPerCarton = Number((pcsPerCarton / pcsPerPack).toFixed(4));
  } else if (cartonQty) {
    packsPerCarton = cartonQty;
  }

  let kgPerTray: number | null = null;
  const avgTrayG = positiveNum(form.avg_qty_per_tray_g);
  if (avgTrayG) {
    kgPerTray = avgTrayG / 1000;
  } else {
    const qtyPerCartonKg = positiveNum(form.qty_per_carton_kg);
    if (qtyPerCartonKg && cartonQty) {
      kgPerTray = qtyPerCartonKg / cartonQty;
    }
  }

  const masterCartonUom = String(form.master_carton_uom ?? "").toLowerCase();
  const traysPerMasterCarton =
    masterCartonQty &&
    (!masterCartonUom || masterCartonUom.includes("tray") || masterCartonUom === "pcs")
      ? masterCartonQty
      : masterCartonQty;

  return {
    gramsPerPiece,
    piecesPerKg,
    kgPerTray,
    traysPerMasterCarton,
    packsPerCarton,
    pcsPerPack,
    allowPartialPack: false,
    allowPartialCarton: false,
    roundingRule: "nearest",
    tolerancePercent: 0,
  };
}
