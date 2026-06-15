import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import {
  PRODUCT_LANGUAGE_TERM_TYPES,
  TERM_TYPE_LABELS,
  TERM_TYPE_UI_NOTICE,
} from "@/features/productLanguage/terms";
import { fetchProductLanguageSnapshot } from "@/features/productIntelligence/fetchLanguageTerms";
import { capabilityReadinessScore } from "@/features/productIntelligence/productLanguageReadiness";
import type { ProductLanguageReadinessResult } from "@/features/productIntelligence/types";

type Props = {
  productId: string;
  productName: string;
  onOpenAliasManager?: () => void;
  refreshKey?: number;
};

export function ProductLanguageTermsPanel({
  productId,
  productName,
  onOpenAliasManager,
  refreshKey = 0,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [readiness, setReadiness] = useState<ProductLanguageReadinessResult | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [gaps, setGaps] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const snap = await fetchProductLanguageSnapshot(productId, productName);
        if (cancelled) return;
        setReadiness(snap.readiness);
        setCounts(snap.counts);
        setGaps(snap.readiness.gaps);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, productName, refreshKey]);

  const capability = readiness
    ? capabilityReadinessScore(readiness, {
        productTruthWired: true,
        snapshotWired: true,
        searchWired: true,
      })
    : null;

  const whatsappCount = counts.whatsapp_keyword ?? 0;
  const totalAliases = counts.total_aliases ?? 0;

  return (
    <div className="space-y-4">
      <div className="card-elevated p-4 space-y-3">
        <div>
          <h4 className="font-medium">Product language terms</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Seven-class Oasis language model — official name plus six editable term types for search and channels.
          </p>
        </div>

        <div className="rounded-md border bg-muted/20 p-3">
          <div className="text-xs text-muted-foreground">Official Name</div>
          <div className="text-sm font-medium">{productName.trim() || "—"}</div>
        </div>

        <p className="text-xs text-warning border border-warning/30 bg-warning/5 rounded-md px-2 py-1.5">
          Language discoverability is informational only — it does <strong>not</strong> block catalogue
          publish or Central Sync until <code className="text-[10px]">product_language_terms</code> is
          deployed. Term types in localStorage are not durable across devices.
        </p>

        {loading ? (
          <p className="text-xs text-muted-foreground">Loading language inventory…</p>
        ) : readiness ? (
          <div className="rounded-md border p-3 space-y-2 bg-muted/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Language discoverability readiness
                </div>
                <p className="text-sm">
                  {readiness.score}/{readiness.maxScore} dimensions · {readiness.percent}%
                </p>
              </div>
              {readiness.readyForDiscoverability ? (
                <span className="badge-soft bg-success/10 text-success flex items-center gap-1 text-xs px-2 py-1 rounded-full">
                  <CheckCircle2 className="h-3 w-3" /> Baseline complete
                </span>
              ) : (
                <span className="badge-soft bg-warning/10 text-warning flex items-center gap-1 text-xs px-2 py-1 rounded-full">
                  <AlertTriangle className="h-3 w-3" /> Gaps remain
                </span>
              )}
            </div>
            <Progress value={readiness.percent} className="h-2" />
            <p className="text-[11px] text-muted-foreground">{readiness.nextAction}</p>
            {capability && (
              <p className="text-[11px] text-muted-foreground">
                Product Intelligence capability layer: {capability.score}/{capability.maxScore} ({capability.label.replace(/_/g, " ")})
              </p>
            )}
          </div>
        ) : null}

        <div className="rounded-md border border-muted bg-muted/10 p-3 flex gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-medium text-foreground">WhatsApp keywords — approval workflow not active</p>
            <p className="text-muted-foreground">
              WhatsApp term matching is informational until the durable approval workflow is deployed.
              {whatsappCount > 0
                ? ` ${whatsappCount} keyword${whatsappCount === 1 ? "" : "s"} in local inventory.`
                : " No WhatsApp keywords in inventory yet."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {PRODUCT_LANGUAGE_TERM_TYPES.map((t) => (
            <Badge key={t} variant="outline" className="text-[10px]">
              {TERM_TYPE_LABELS[t]}
              {(counts[t] ?? 0) > 0 ? ` · ${counts[t]}` : ""}
            </Badge>
          ))}
        </div>

        {!loading && (
          <p className="text-[11px] text-muted-foreground">
            {totalAliases} alias row{totalAliases === 1 ? "" : "s"} from product_aliases
            {totalAliases === 0 ? " — add terms via Manage language terms" : ""}.
          </p>
        )}

        {gaps.length > 0 && !loading && (
          <div className="rounded-md border p-3 bg-muted/20 space-y-1">
            <div className="text-xs font-medium">Missing discoverability coverage</div>
            <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5">
              {gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        )}

        {onOpenAliasManager && (
          <Button type="button" variant="outline" size="sm" onClick={onOpenAliasManager}>
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Manage language terms
          </Button>
        )}
      </div>
    </div>
  );
}
