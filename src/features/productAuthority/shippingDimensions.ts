/**
 * Point 35 — deterministic dimensions / volume helpers.
 * Never fabricates CBM when required inputs are absent.
 */

function positiveNum(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function hasTextValue(v: unknown): boolean {
  return v != null && String(v).trim().length > 0;
}

/** Human-readable L×W×H text from cm inputs (e.g. "L 22 cm × W 18 cm × H 6 cm"). */
export function formatDimensionsCmText(
  lengthCm: unknown,
  widthCm: unknown,
  heightCm: unknown,
): string | null {
  const l = positiveNum(lengthCm);
  const w = positiveNum(widthCm);
  const h = positiveNum(heightCm);
  if (!l && !w && !h) return null;
  return [l ? `L ${l} cm` : null, w ? `W ${w} cm` : null, h ? `H ${h} cm` : null]
    .filter(Boolean)
    .join(" × ");
}

/**
 * CBM (m³) from cm dimensions: (L × W × H) / 1_000_000.
 * Returns null when any dimension is missing or non-positive.
 */
export function deriveCbmFromCm(
  lengthCm: unknown,
  widthCm: unknown,
  heightCm: unknown,
): number | null {
  const l = positiveNum(lengthCm);
  const w = positiveNum(widthCm);
  const h = positiveNum(heightCm);
  if (l == null || w == null || h == null) return null;
  const cbm = (l * w * h) / 1_000_000;
  return Number.isFinite(cbm) ? Number(cbm.toFixed(6)) : null;
}

/** Product-pack dimensions only — never falls back to carton dimensions. */
export function resolveProductDimensionsCmText(form: Record<string, unknown>): string | null {
  if (hasTextValue(form.product_dimensions_cm)) return String(form.product_dimensions_cm);
  if (hasTextValue(form.dimensions)) return String(form.dimensions);
  return formatDimensionsCmText(form.dimension_l_cm, form.dimension_w_cm, form.dimension_h_cm);
}

/** @deprecated Use resolveProductDimensionsCmText — carton dimensions are persisted separately. */
export function resolveDimensionsCmText(form: Record<string, unknown>): string | null {
  return resolveProductDimensionsCmText(form);
}
