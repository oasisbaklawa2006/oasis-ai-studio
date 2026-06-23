import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  loadRuntimeCatalog,
  resolveProductUtterance,
  type ProductUtteranceResolution,
} from "@/features/productIntelligence/runtime";
import { Search } from "lucide-react";

const BAND_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  HIGH: "default",
  MEDIUM: "secondary",
  LOW: "destructive",
};

const ACTION_LABEL: Record<string, string> = {
  auto_suggest: "Auto-suggest",
  operator_review: "Operator review",
  ask_clarification: "Ask clarification",
};

export default function ResolverPreview() {
  const [utterance, setUtterance] = useState("pista bulbul");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProductUtteranceResolution | null>(null);

  const runResolve = async () => {
    setLoading(true);
    setError(null);
    try {
      const catalog = await loadRuntimeCatalog();
      const res = resolveProductUtterance(utterance, catalog);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Resolver Preview"
        subtitle="Phase 2A identify-only sandbox — read-only, no writes, no WhatsApp send/receive."
      />

      <div className="card-elevated p-6 space-y-4">
        <label className="text-sm font-medium" htmlFor="utterance-input">
          Customer utterance
        </label>
        <Textarea
          id="utterance-input"
          value={utterance}
          onChange={(e) => setUtterance(e.target.value)}
          rows={3}
          placeholder='e.g. "6 pc midya", "kaju tart", "frozen kunafa"'
        />
        <Button onClick={runResolve} disabled={loading || !utterance.trim()}>
          <Search className="h-4 w-4 mr-2" />
          {loading ? "Resolving…" : "Resolve"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {result && (
        <div className="card-elevated p-6 space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Badge variant={BAND_VARIANT[result.confidence_band] ?? "outline"}>
              {result.confidence_band}
            </Badge>
            <Badge variant="outline">{ACTION_LABEL[result.action] ?? result.action}</Badge>
            <span className="text-sm text-muted-foreground">
              Confidence {(result.confidence * 100).toFixed(1)}%
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wide">Top match</div>
              <div className="font-medium">{result.resolved_name ?? "—"}</div>
              <div className="font-mono text-xs">{result.resolved_sku ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wide">Normalized</div>
              <div>{result.normalized_text || "—"}</div>
              {result.pack_count != null && (
                <div className="text-xs text-muted-foreground">Pack qty hint: {result.pack_count}</div>
              )}
            </div>
          </div>

          <div>
            <div className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Reason</div>
            <p className="text-sm">{result.reason}</p>
          </div>

          <div>
            <div className="text-muted-foreground text-xs uppercase tracking-wide mb-2">
              Alternatives ({result.alternatives.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">SKU</th>
                    <th className="py-2 pr-4">Product</th>
                    <th className="py-2 pr-4">Matched term</th>
                    <th className="py-2 pr-4">Source</th>
                    <th className="py-2">Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {result.alternatives.map((alt) => (
                    <tr key={`${alt.sku}-${alt.matched_term}`} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-mono text-xs">{alt.sku}</td>
                      <td className="py-2 pr-4">{alt.product_name}</td>
                      <td className="py-2 pr-4">{alt.matched_term}</td>
                      <td className="py-2 pr-4">{alt.match_source}</td>
                      <td className="py-2">{(alt.confidence * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Preview only — catalogue pilot v1.0 upstream data is read-only. No orders, webhooks, or
            writes.
          </p>
        </div>
      )}
    </div>
  );
}
