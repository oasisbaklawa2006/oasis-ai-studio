import { catalogueReadiness, type Product } from "@/lib/readiness";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const ReadinessBadge = ({ product, compact = false }: { product: Product; compact?: boolean }) => {
  const r = catalogueReadiness(product);
  const tone = r.ready ? "bg-success/10 text-success" : (r.missing.length ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning");
  const Icon = r.ready ? CheckCircle2 : AlertCircle;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button onClick={(e) => e.preventDefault()} className={`badge-soft ${tone}`}>
          <Icon className="h-3 w-3" />
          {r.ready ? "Ready" : compact ? `${r.missing.length} missing` : `Fix ${r.missing.length}`}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 text-sm">
        <div className="font-medium mb-2">Catalogue readiness</div>
        {r.missing.length === 0 && r.warnings.length === 0 && (
          <div className="text-xs text-muted-foreground">All checks pass.</div>
        )}
        {r.missing.length > 0 && (
          <>
            <div className="text-xs uppercase tracking-wider text-destructive mb-1">Missing</div>
            <ul className="text-xs space-y-0.5 mb-2">{r.missing.map((m) => <li key={m}>• {m}</li>)}</ul>
          </>
        )}
        {r.warnings.length > 0 && (
          <>
            <div className="text-xs uppercase tracking-wider text-warning mb-1">Warnings</div>
            <ul className="text-xs space-y-0.5">{r.warnings.map((m) => <li key={m}>• {m}</li>)}</ul>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};
