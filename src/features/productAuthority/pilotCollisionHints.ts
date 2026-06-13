import type { PilotSkuCode } from "./skuGuard";

/** Static collision hygiene notes from Batch 001 language wave reports (read-only). */
export const PILOT_COLLISION_HINTS: Record<
  PilotSkuCode,
  { status: "pass" | "partial" | "fail"; notes: string[] }
> = {
  "OAS-AS-BKL-0024": {
    status: "pass",
    notes: ["Phase 1 anchor — no open cross-SKU collision in Wave 2B scan"],
  },
  "OAS-AS-BKL-0020": {
    status: "pass",
    notes: ["Phase 1 anchor — tart/cashew vocabulary scoped to SKU"],
  },
  "OAS-AS-BKL-0001": {
    status: "partial",
    notes: [
      'Bare "kitta" search term flagged HIGH collision risk in language preview',
      "6 case-variant dupes excluded pre-submit in Wave 2A",
    ],
  },
  "OAS-AS-BKL-0025": {
    status: "partial",
    notes: ["4 case-variant dupes excluded pre-submit in Wave 2A"],
  },
  "OAS-AS-BKL-0007": {
    status: "partial",
    notes: ["7 case-variant dupes excluded pre-submit in Wave 2A"],
  },
};
