import { AlertTriangle, CheckCircle2, CircleX, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  type BuyerBackendReadiness,
  buildBuyerReadinessCards,
  normalizeBuyerBackendReadiness,
  type ReadinessStatus,
} from "@/features/buyerReadiness/model";
import type { OwnerDataQueueItem } from "@/features/buyerReadiness/ownerDataQueue";
import { loadOwnerDataCompletionQueue } from "@/features/buyerReadiness/ownerDataQueueLoader";
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
    return "Core readiness contract is not deployed yet. Release the governed Core readiness migration before treating this page as a production readiness signal.";
  }
  if (text.includes("permission") || error.code === "42501") {
    return "This readiness view requires an Owner/Admin or catalogue-reviewer authority.";
  }
  return error.message;
};

const inr = (value: number | null) =>
  value === null
    ? "Not set"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(value);

const BuyerBackendReadinessPage = () => {
  const [row, setRow] = useState<BuyerBackendReadiness | null>(null);
  const [ownerQueue, setOwnerQueue] = useState<OwnerDataQueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setQueueLoading(true);
    setError(null);
    setQueueError(null);

    const readinessTask = (async () => {
      try {
        const callRpc = supabase.rpc as unknown as ReadinessRpc;
        const { data, error: rpcError } = await callRpc("connect_staff_readiness_v1");

        if (rpcError) {
          setRow(null);
          setError(dependencyMessage(rpcError));
          return;
        }

        const candidate = Array.isArray(data) ? data[0] : data;
        const normalized = normalizeBuyerBackendReadiness(candidate);
        if (!normalized) {
          setRow(null);
          setError("Core returned an incomplete Buyer readiness payload. Treat readiness as blocked.");
          return;
        }

        setRow(normalized);
      } catch (loadError) {
        setRow(null);
        setError(
          loadError instanceof Error
            ? `Buyer readiness request failed: ${loadError.message}`
            : "Buyer readiness request failed. Retry when the connection is available.",
        );
      } finally {
        setLoading(false);
      }
    })();

    const queueTask = (async () => {
      try {
        setOwnerQueue(await loadOwnerDataCompletionQueue());
      } catch (loadError) {
        setOwnerQueue([]);
        setQueueError(
          loadError instanceof Error
            ? loadError.message
            : "Owner-data completion queue could not be loaded.",
        );
      } finally {
        setQueueLoading(false);
      }
    })();

    await Promise.all([readinessTask, queueTask]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = row ? buildBuyerReadinessCards(row) : [];

  const actions = row
    ? [
        row.published_product_count === 0
          ? "Publish at least one Buyer product through the governed catalogue publication gate."
          : null,
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
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={loading || queueLoading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading || queueLoading ? "animate-spin" : ""}`}
            />
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
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {card.detail}
                  </p>
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
                This page is read-only. It never receives Connect token material, product
                cost/margin data or customer PII.
              </p>
            </div>

            <div className="card-elevated p-6">
              <h2 className="font-display text-xl">Activation actions</h2>
              {actions.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  The represented backend lanes are fully populated according to the current Core
                  readiness contract.
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

      <section className="mt-8 card-elevated p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Owner data completion queue</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Exact product facts that still need an owner/catalogue decision before the Buyer
              private-label or packaging surfaces can be fully populated.
            </p>
          </div>
          <span className="rounded-full border bg-secondary px-3 py-1 text-xs font-medium">
            Read-only · {ownerQueue.length} action item{ownerQueue.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          Stored legacy price and MOQ values are shown only as confirmation context. They are never
          treated as governed Buyer commercial facts and are not copied into approved pricing by
          this page.
        </div>

        {queueLoading ? (
          <p className="mt-5 text-sm text-muted-foreground">Loading owner-data gaps…</p>
        ) : queueError ? (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="font-medium">Owner-data queue unavailable</div>
            <p className="mt-1">{queueError}</p>
            <p className="mt-1">
              Aggregate Core readiness above remains authoritative. Retry this supporting read when
              Studio data access is available.
            </p>
          </div>
        ) : ownerQueue.length === 0 ? (
          <p className="mt-5 text-sm text-muted-foreground">
            No active private-label or packaging product currently needs an owner-data decision.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {ownerQueue.map((item) => (
              <article key={`${item.lane}:${item.productId}`} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      {item.lane === "private_label" ? "Private label" : "Packaging & decoration"}
                    </div>
                    <h3 className="mt-1 font-medium text-primary">{item.productName}</h3>
                    <div className="mt-1 text-xs text-muted-foreground">{item.sku}</div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/products/${item.productId}`}>Open governed product editor</Link>
                  </Button>
                </div>

                <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <Fact label="Publication" value={item.published ? "Published" : "Not ready"} />
                  <Fact label="Media" value={item.mediaApproved ? "Approved" : "Not approved"} />
                  <Fact label="Governed B2B price" value={inr(item.governedB2bPrice)} />
                  <Fact
                    label="Lead time"
                    value={item.leadTimeDays ? `${item.leadTimeDays} days` : "Not set"}
                  />
                  {item.lane === "private_label" ? (
                    <>
                      <Fact label="Private-label selling price" value={inr(item.privateLabelPrice)} />
                      <Fact
                        label="Private-label MOQ"
                        value={
                          item.privateLabelMoq === null
                            ? "Not set"
                            : `${item.privateLabelMoq} ${item.privateLabelMoqUom ?? ""}`.trim()
                        }
                      />
                    </>
                  ) : (
                    <>
                      <Fact label="Legacy B2B value · confirm only" value={inr(item.legacyB2bPrice)} />
                      <Fact
                        label="Legacy MOQ · confirm only"
                        value={
                          item.legacyMoq === null
                            ? "Not set"
                            : `${item.legacyMoq} ${item.uom ?? ""}`.trim()
                        }
                      />
                    </>
                  )}
                </div>

                <div className="mt-4">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Owner decisions required
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {item.missing.map((missing) => (
                      <li key={missing} className="flex gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <span>{missing}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
};

const Fact = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg bg-secondary/50 p-3">
    <div className="text-muted-foreground">{label}</div>
    <div className="mt-1 font-medium text-foreground">{value}</div>
  </div>
);

export default BuyerBackendReadinessPage;
