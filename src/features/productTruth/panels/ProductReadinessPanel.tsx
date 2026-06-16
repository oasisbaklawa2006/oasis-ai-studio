import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { ProductReadinessResult } from "../productReadiness";
import type { ReadinessBadge } from "../types";
import {
  dimensionReadinessLabel,
  isTestingMediaGovernance,
} from "@/features/mediaReadiness/mediaGovernanceDisplay";
import { AlertTriangle, CheckCircle2, Lock } from "lucide-react";

const badgeTone = (b: ReadinessBadge) => {
  switch (b) {
    case "approved":
    case "published":
    case "locked":
      return "bg-success/10 text-success border-success/20";
    case "pending_approval":
      return "bg-warning/10 text-warning border-warning/20";
    case "rejected":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "legacy_incomplete":
      return "bg-muted text-muted-foreground";
    case "ai_generated":
      return "bg-accent-soft text-accent-foreground";
    default:
      return "bg-muted/60 text-foreground";
  }
};

export function ProductReadinessPanel({ readiness }: { readiness: ProductReadinessResult }) {
  const pct = Math.round((readiness.score / readiness.maxScore) * 100);

  return (
    <div className="card-elevated p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-medium">Product readiness</h4>
          <p className="text-xs text-muted-foreground">
            Score {readiness.score}/{readiness.maxScore} · {readiness.isLegacy ? "Legacy / incomplete" : "Active record"}
          </p>
        </div>
        {readiness.readyForCentralSync ? (
          <span className="badge-soft bg-success/10 text-success flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Ready for Central sync
          </span>
        ) : (
          <span className="badge-soft bg-warning/10 text-warning flex items-center gap-1">
            <Lock className="h-3 w-3" /> Central sync blocked
          </span>
        )}
      </div>

      <Progress value={pct} className="h-2" />

      <div className="flex flex-wrap gap-1">
        {readiness.badges.map((b) => (
          <Badge key={b} variant="outline" className={badgeTone(b)}>
            {b.replace(/_/g, " ")}
          </Badge>
        ))}
      </div>

      <div className="rounded-md border p-3 bg-muted/20">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Next action</div>
        <p className="text-sm">{readiness.nextAction}</p>
      </div>

      {readiness.blockers.length > 0 && (
        <div>
          <div className="text-xs font-medium text-destructive flex items-center gap-1 mb-1">
            <AlertTriangle className="h-3 w-3" /> Blockers
          </div>
          <ul className="text-sm space-y-0.5 list-disc pl-4">
            {readiness.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-2">
        {readiness.dimensions.map((d) => (
          <div key={d.dimension} className="rounded border p-2 text-xs">
            <div className="font-medium">{d.dimension.replace(/_/g, " ")}</div>
            <Badge variant="outline" className={`mt-1 ${badgeTone(d.badge)}`}>
              {dimensionReadinessLabel(readiness, d.dimension)}
            </Badge>
            {d.note && !(isTestingMediaGovernance() && d.dimension === "media_status") && (
              <p className="text-muted-foreground mt-1">{d.note}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
