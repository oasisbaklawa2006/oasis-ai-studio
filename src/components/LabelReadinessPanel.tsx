import type { LabelReadinessResult } from "@/features/productAuthority/labelReadiness";
import type { evaluatePackagingLabelReadiness } from "@/features/productAuthority/packagingLabelReadinessCanonical";
import { Badge } from "@/components/ui/badge";

const STATUS_BADGE_CLASS: Record<LabelReadinessResult["overallStatus"], string> = {
  Draft: "bg-muted text-muted-foreground border-border",
  "Needs review": "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-400/40",
  "Ready for label designer": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-400/40",
  Approved: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/40",
};

const CATEGORY_BADGE_CLASS: Record<string, string> = {
  pass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-400/40",
  warn: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-400/40",
  missing: "bg-destructive/10 text-destructive border-destructive/40",
  not_applicable: "bg-muted text-muted-foreground border-border",
};

type PackagingLabelReadinessResult = ReturnType<typeof evaluatePackagingLabelReadiness>;

interface LabelReadinessPanelProps {
  readiness: LabelReadinessResult;
  packagingLabelReadiness?: PackagingLabelReadinessResult;
}

/**
 * Read-only summary — this never writes to the product row. It exists to make explicit
 * what catalogue readiness doesn't: whether this product can honestly move to label
 * design / packaging print, which today it never fully can (see labelReadiness.ts).
 */
export function LabelReadinessPanel({
  readiness,
  packagingLabelReadiness,
}: LabelReadinessPanelProps) {
  const notPersisted = readiness.dataGaps.filter((g) => g.severity === "not_persisted");
  const noColumn = readiness.dataGaps.filter((g) => g.severity === "no_column");

  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-display text-lg">Label Readiness</h4>
        <Badge className={STATUS_BADGE_CLASS[readiness.overallStatus]}>{readiness.overallStatus}</Badge>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Separate from catalogue readiness — this answers "can this product move to label design / packaging
        print", not "can it appear in the catalogue". AI can format and calculate here; it does not certify
        compliance.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {readiness.categories.map((c) => (
          <Badge key={c.key} variant="outline" className={CATEGORY_BADGE_CLASS[c.state]} title={c.nextAction ?? c.detail}>
            {c.label}
          </Badge>
        ))}
      </div>

      {packagingLabelReadiness && (
        <div className="space-y-2 border-t pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              Packaging / label hierarchy (Point 37)
            </p>
            <Badge
              variant="outline"
              className={
                packagingLabelReadiness.readyForLabelDesign
                  ? CATEGORY_BADGE_CLASS.pass
                  : CATEGORY_BADGE_CLASS.missing
              }
            >
              {packagingLabelReadiness.readyForLabelDesign ? "Hierarchy ready" : "Blocked"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {packagingLabelReadiness.hierarchyLabels.map((h) => (
              <Badge
                key={h.level}
                variant="outline"
                className={CATEGORY_BADGE_CLASS[h.state] ?? CATEGORY_BADGE_CLASS.missing}
                title={h.detail}
              >
                {h.label}: {h.state.replace("_", " ")}
              </Badge>
            ))}
            <Badge
              variant="outline"
              className={CATEGORY_BADGE_CLASS[packagingLabelReadiness.packagingType.state === "complete" ? "pass" : "missing"]}
              title={`Canonical field: packaging_code`}
            >
              Packaging type: {packagingLabelReadiness.packagingType.state.replace("_", " ")}
            </Badge>
            <Badge
              variant="outline"
              className={
                CATEGORY_BADGE_CLASS[
                  packagingLabelReadiness.artwork.state === "complete"
                    ? "pass"
                    : packagingLabelReadiness.artwork.state === "not_required"
                      ? "not_applicable"
                      : "warn"
                ]
              }
            >
              Artwork: {packagingLabelReadiness.artwork.state.replace("_", " ")}
            </Badge>
            <Badge
              variant="outline"
              className={
                CATEGORY_BADGE_CLASS[
                  packagingLabelReadiness.barcode.state === "complete"
                    ? "pass"
                    : packagingLabelReadiness.barcode.state === "not_required"
                      ? "not_applicable"
                      : "missing"
                ]
              }
            >
              Barcode: {packagingLabelReadiness.barcode.state.replace("_", " ")}
            </Badge>
          </div>
          {packagingLabelReadiness.publicationBlockers.length > 0 && (
            <p className="text-[11px] text-destructive">
              Blockers: {packagingLabelReadiness.publicationBlockers.slice(0, 4).join(" · ")}
              {packagingLabelReadiness.publicationBlockers.length > 4 ? " …" : ""}
            </p>
          )}
        </div>
      )}

      {notPersisted.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">
            Entered here but not yet saved to this product
          </p>
          <div className="flex flex-wrap gap-1.5">
            {notPersisted.map((g) => (
              <Badge key={g.key} variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-400/40" title={g.note}>
                {g.label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {noColumn.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Needs a schema change to capture</p>
          <div className="flex flex-wrap gap-1.5">
            {noColumn.map((g) => (
              <Badge key={g.key} variant="outline" className="bg-muted text-muted-foreground border-border" title={g.note}>
                {g.label}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
