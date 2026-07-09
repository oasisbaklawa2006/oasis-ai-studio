/**
 * Shared "Build Meter" presentation logic sitting on top of any readiness score
 * (e.g. computeCatalogueProductReadiness). Kept independent of any one screen's
 * readiness engine so Full Editor and Catalogue Product AI Studio can both use it.
 */

export const BUILD_METER_THRESHOLD = 70;

export type BuildMeterStatus = {
  score: number;
  meetsThreshold: boolean;
  headline: string;
  detail: string;
};

export function getBuildMeterStatus(score: number): BuildMeterStatus {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const meetsThreshold = clamped >= BUILD_METER_THRESHOLD;
  return {
    score: clamped,
    meetsThreshold,
    headline: meetsThreshold ? "Ready for catalogue draft" : "Needs more fields",
    detail: `${BUILD_METER_THRESHOLD}%+ approved for catalogue draft`,
  };
}

export type MissingFieldChip = {
  key: string;
  label: string;
  nextAction: string | null;
};

export type ReadinessCategoryLike = {
  key: string;
  label: string;
  state: "pass" | "warn" | "missing";
  nextAction: string | null;
};

/** Missing fields surface first, then warn fields, both in original order — capped for chip-row display. */
export function getMissingFieldChips(
  categories: ReadinessCategoryLike[],
  limit = 6,
): MissingFieldChip[] {
  const missing = categories.filter((c) => c.state === "missing");
  const warn = categories.filter((c) => c.state === "warn");
  return [...missing, ...warn]
    .slice(0, limit)
    .map((c) => ({ key: c.key, label: c.label, nextAction: c.nextAction }));
}
