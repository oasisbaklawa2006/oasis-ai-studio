import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, ExternalLink } from "lucide-react";
import {
  evaluateAllPilotSkus,
  type PilotReadinessReport,
  type PilotSkuReadiness,
} from "@/features/productAuthority/pilotReadiness";
import { MEDIA_BUCKET_OWNER_ACTION } from "@/features/productAuthority/mediaReadiness";

function statusBadge(status: string) {
  const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pass: "default",
    partial: "secondary",
    fail: "destructive",
    unknown: "outline",
  };
  return (
    <Badge variant={map[status] ?? "outline"} className="capitalize">
      {status}
    </Badge>
  );
}

function InfraRow({ label, status, message }: { label: string; status: string; message: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm border-b py-2 last:border-0">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-2 text-right">
        {statusBadge(status)}
        <span className="text-xs text-muted-foreground max-w-md">{message}</span>
      </div>
    </div>
  );
}

function PilotSkuCard({ row }: { row: PilotSkuReadiness }) {
  const checks: Array<[string, string]> = [
    ["Structured SKU", row.structuredSku],
    ["Schema save", row.schemaSave],
    ["HSN/GST", row.hsnGst],
    ["Packaging", row.packaging],
    ["Hero image", row.heroImage],
    ["Square image", row.squareImage],
    ["Alias types", row.aliasTermTypes],
    ["Resolver", row.resolverCollisions],
    ["Approval RPC", row.approvalRpc],
    ["Approval ready", row.approvalReady],
  ];

  return (
    <div className="card-elevated p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-display text-lg">{row.label}</div>
          <div className="font-mono text-sm text-muted-foreground">{row.sku}</div>
        </div>
        <Badge variant={row.ready ? "default" : "destructive"}>
          {row.ready ? "Ready" : "Blocked"}
        </Badge>
      </div>

      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div>HSN: {row.hsnCode ?? "—"} · GST: {row.gstRate ?? "—"}</div>
        <div>
          g/pc: {row.gramsPerPiece ?? "—"} · pcs/kg: {row.piecesPerKg ?? "—"}
        </div>
        <div>
          Aliases: {row.aliasCount} (WA {row.whatsappAliasCount} · search {row.searchAliasCount})
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-2 text-sm">
        {checks.map(([label, status]) => (
          <div key={label} className="flex items-center justify-between gap-2 rounded border px-2 py-1">
            <span className="text-muted-foreground">{label}</span>
            {statusBadge(status)}
          </div>
        ))}
      </div>

      {row.resolverNotes.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Resolver: {row.resolverNotes.join(" · ")}
        </div>
      )}

      {row.blockedReasons.length > 0 && (
        <ul className="text-xs text-destructive list-disc pl-4 space-y-0.5">
          {row.blockedReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {row.productId && (
        <Button variant="outline" size="sm" asChild>
          <Link to={`/products/${row.productId}`}>
            Open product <ExternalLink className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      )}
    </div>
  );
}

const PilotReadinessDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PilotReadinessReport | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await evaluateAllPilotSkus();
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pilot readiness");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <PageHeader
        title="5-SKU Pilot Readiness"
        subtitle="Live infra probes + per-SKU authority dimensions"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/testing/pilot-aliases">Alias term review</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/testing">Testing hub</Link>
            </Button>
            <Button variant="secondary" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Refresh</span>
            </Button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {report && (
        <>
          <div className="mb-4 rounded-lg border p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-2xl font-display">{report.summary.percent}% pilot gate</span>
              <span className="text-muted-foreground">
                ({report.summary.ready}/{report.summary.total} SKUs fully ready)
              </span>
              <span className="text-muted-foreground">
                · {report.summary.dimensionPercent}% dimensions ({report.summary.dimensionsPassing}/
                {report.summary.dimensionsTotal})
              </span>
            </div>
            {report.infra.projectRef && (
              <div className="text-xs text-muted-foreground">
                Probed {new Date(report.infra.probedAt).toLocaleString()} · project {report.infra.projectRef}
              </div>
            )}
          </div>

          <div className="mb-6 rounded-lg border p-4">
            <h3 className="font-display text-lg mb-2">Infrastructure</h3>
            <InfraRow
              label="product-media bucket"
              status={report.bucket.status === "available" ? "pass" : report.bucket.status === "missing" ? "fail" : "partial"}
              message={report.bucket.message}
            />
            <InfraRow
              label="generate_oasis_sku"
              status={report.infra.generateOasisSku.status}
              message={report.infra.generateOasisSku.message}
            />
            <InfraRow
              label="search_products_with_aliases"
              status={report.infra.searchProductsWithAliases.status}
              message={report.infra.searchProductsWithAliases.message}
            />
            <InfraRow
              label="approve_catalogue_product_draft"
              status={report.infra.approveProductDraftRpc.status}
              message={report.infra.approveProductDraftRpc.message}
            />
            <InfraRow
              label="reject_catalogue_product_draft"
              status={report.infra.rejectProductDraftRpc.status}
              message={report.infra.rejectProductDraftRpc.message}
            />
            {report.bucket.status !== "available" && (
              <p className="text-xs text-muted-foreground mt-2">{MEDIA_BUCKET_OWNER_ACTION}</p>
            )}
          </div>
        </>
      )}

      {loading && !report && (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading pilot SKU checks…
        </div>
      )}

      {report && (
        <div className="grid lg:grid-cols-2 gap-4">
          {report.skus.map((row) => (
            <PilotSkuCard key={row.sku} row={row} />
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Reports:{" "}
        <code>docs/AI_STUDIO_5SKU_PILOT_COMPLETION_REPORT.md</code> ·{" "}
        <code>data/pilot/ai_studio_5sku_readiness_matrix.csv</code>
      </p>
    </>
  );
};

export default PilotReadinessDashboard;
