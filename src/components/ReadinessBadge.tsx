import type { ProductReadinessResult } from "@/features/productTruth/productReadiness";
import { readinessSummaryLabel } from "@/features/productTruth/productListReadiness";
import { catalogueReadiness, type Product } from "@/lib/readiness";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const ReadinessBadge = ({
  product,
  readiness,
  compact = false,
}: {
  product: Product;
  readiness?: ProductReadinessResult | null;
  compact?: boolean;
}) => {
  const legacy = catalogueReadiness(product);
  const truth = readiness ?? null;
  const ready = truth ? truth.readyForCentralSync : legacy.ready;
  const label = truth ? readinessSummaryLabel(truth) : legacy.ready ? "Ready" : compact ? `${legacy.missing.length} missing` : `Fix ${legacy.missing.length}`;
  const tone = ready
    ? "bg-success/10 text-success"
    : truth?.blockers.length || legacy.missing.length
      ? "bg-destructive/10 text-destructive"
      : "bg-warning/10 text-warning";
  const Icon = ready ? CheckCircle2 : AlertCircle;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button onClick={(e) => e.preventDefault()} className={`badge-soft ${tone}`}>
          <Icon className="h-3 w-3" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 text-sm">
        <div className="font-medium mb-2">
          {truth ? "Product Truth readiness" : "Catalogue readiness"}
        </div>
        {truth ? (
          <>
            <p className="text-xs text-muted-foreground mb-2">
              Score {truth.score}/{truth.maxScore}
              {truth.readyForCentralSync ? " · ready for Central sync" : ""}
            </p>
            {truth.blockers.length > 0 && (
              <>
                <div className="text-xs uppercase tracking-wider text-destructive mb-1">Blockers</div>
                <ul className="text-xs space-y-0.5 mb-2">
                  {truth.blockers.map((m) => (
                    <li key={m}>• {m}</li>
                  ))}
                </ul>
              </>
            )}
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Dimensions</div>
            <ul className="text-xs space-y-0.5">
              {truth.dimensions.map((d) => (
                <li key={d.dimension}>
                  • {d.dimension.replace(/_/g, " ")}: {d.badge.replace(/_/g, " ")}
                  {d.note ? ` — ${d.note}` : ""}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            {legacy.missing.length === 0 && legacy.warnings.length === 0 && (
              <div className="text-xs text-muted-foreground">All checks pass.</div>
            )}
            {legacy.missing.length > 0 && (
              <>
                <div className="text-xs uppercase tracking-wider text-destructive mb-1">Missing</div>
                <ul className="text-xs space-y-0.5 mb-2">
                  {legacy.missing.map((m) => (
                    <li key={m}>• {m}</li>
                  ))}
                </ul>
              </>
            )}
            {legacy.warnings.length > 0 && (
              <>
                <div className="text-xs uppercase tracking-wider text-warning mb-1">Warnings</div>
                <ul className="text-xs space-y-0.5">
                  {legacy.warnings.map((m) => (
                    <li key={m}>• {m}</li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};
