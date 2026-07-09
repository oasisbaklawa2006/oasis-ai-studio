import type { LabelReadinessResult } from "@/features/productAuthority/labelReadiness";
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
};

interface LabelReadinessPanelProps {
  readiness: LabelReadinessResult;
}

/**
 * Read-only summary — this never writes to the product row. It exists to make explicit
 * what catalogue readiness doesn't: whether this product can honestly move to label
 * design / packaging print, which today it never fully can (see labelReadiness.ts).
 */
export function LabelReadinessPanel({ readiness }: LabelReadinessPanelProps) {
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
