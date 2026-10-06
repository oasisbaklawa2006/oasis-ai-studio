import { AlertTriangle, CheckCircle2, CircleX, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  buildBuyerReadinessCards,
  normalizeBuyerBackendReadiness,
  type BuyerBackendReadiness,
  type ReadinessStatus,
} from "@/features/buyerReadiness/model";
import { supabase } from "@/integrations/supabase/client";

type RpcError = { message: string; code?: string };
type RpcResult = { data: unknown; error: RpcError | null };
type ReadinessRpc = (fn: string) => PromiseLike<RpcResult>;

const statusMeta: Record<
  ReadinessStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  ready: {
    label: "Ready",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  partial: {
    label: "Partial",
    icon: AlertTriangle,
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  blocked: {
    label: "Blocked",
    icon: CircleX,
    className: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

const dependencyMessage = (error: RpcError) => {
  const text = error.message.toLowerCase();
  if (error.code === "PGRST202" || text.includes("could not find the function")) {
    return "Core readiness contract is not deployed yet. Merge and release Core PR #398 before treating this page as a production readiness signal.";
  }
  if (text.includes("permission") || error.code === "42501") {
    return "This readiness view requires an Owner/Admin or catalogue-reviewer authority.";
  }
  return error.message;
};

const BuyerBackendReadiness = () => {
  const [row, setRow] = useState<BuyerBackendReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const callRpc = supabase.rpc as unknown as ReadinessRpc;
    const { data, error: rpcError } = await callRpc("connect_staff_readiness_v1");

    if (rpcError) {
      setRow(null);
      setError(dependencyMessage(rpcError));
      setLoading(false);
      return;
    }

    const candidate = Array.isArray(data) ? data[0] : data;
    const normalized = normalizeBuyerBackendReadiness(candidate);
    if (!normalized) {
      setRow(null);
      setError("Core returned an incomplete Buyer readiness payload. Treat readiness as blocked.");
      setLoading(false);
      return;
    }

    setRow(normalized);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = row ? buildBuyerReadinessCards(row) : [];

  const actions = row
    ? [
        row.b2b_priced_published_product_count < row.published_product_count
          ? "Approve active B2B pricing for every published Buyer product that should be orderable."
          : null,
        row.published_private_label_count === 0
          ? "Enable and publish private-label eligible products in Product Master."
          : row.private_label_price_ready_count < row.published_private_label_count
            ? "Populate explicit customer-facing private-label prices for the enabled published SKUs."
            : null,
        row.published_packaging_count === 0
          ? "Complete catalogue readiness for packaging/decoration products before exposing them to Buyer."
          : row.packaging_price_ready_count < row.published_packaging_count
            ? "Approve governed B2B pricing for each published packaging offer."
            : null,
        row.active_connect_consumer_count === 0
          ? "Register the first production Oasis Connect consumer through the service-role administration flow."
          : null,
        row.active_connect_binding_count === 0
          ? "Bind the active Connect consumer to an approved production profile."
          : null,
        row.active_connect_token_count === 0
          ? "Issue the production Connect token through the service-role flow and store it only in the target channel secret store."
          : null,
      ].filter((item): item is string => Boolean(item))
    : [];

  return (
    <>
      <PageHeader
        title="Buyer Backend Readiness"
        subtitle="Live, governed readiness facts for the Buyer catalogue, commercial coverage, private label, packaging and Oasis Connect."
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {error && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-medium">Readiness unavailable</div>
          <p className="mt-1 leading-relaxed">{error}</p>
        </div>
      )}

      {loading && !row && (
        <div className="card-elevated p-6 text-sm text-muted-foreground">
          Loading governed Core readiness facts…
        </div>
      )}

      {row && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {cards.map((card) => {
              const meta = statusMeta[card.status];
              const Icon = meta.icon;
              return (
                <div key={card.key} className="card-elevated p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      {card.label}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium ${meta.className}`}
                    >
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-3 font-display text-3xl text-primary">{card.value}</div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{card.detail}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="card-elevated p-6">
              <h2 className="font-display text-xl">Current authority facts</h2>
              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Published products</dt>
                  <dd className="mt-1 font-medium">{row.published_product_count}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Approved B2B price rules</dt>
                  <dd className="mt-1 font-medium">{row.approved_b2b_price_rule_count}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Connect profiles</dt>
                  <dd className="mt-1 font-medium">{row.connect_profile_count}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Active Connect tokens</dt>
                  <dd className="mt-1 font-medium">{row.active_connect_token_count}</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                This page is read-only. It never receives Connect token material, product cost/margin data or customer PII.
              </p>
            </div>

            <div className="card-elevated p-6">
              <h2 className="font-display text-xl">Activation actions</h2>
              {actions.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  The represented backend lanes are fully populated according to the current Core readiness contract.
                </p>
              ) : (
                <ol className="mt-4 space-y-3 text-sm">
                  {actions.map((action, index) => (
                    <li key={action} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                        {index + 1}
                      </span>
                      <span className="leading-relaxed">{action}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default BuyerBackendReadiness;
