import type { WhatsAppDraftRow, WhatsAppOperatorDecisionRow } from "./fetchDraftVisibility";

type DraftVisibilityPanelProps = {
  drafts: WhatsAppDraftRow[];
  decisions: WhatsAppOperatorDecisionRow[];
  loading: boolean;
  error: string | null;
};

export function DraftVisibilityPanel({ drafts, decisions, loading, error }: DraftVisibilityPanelProps) {
  return (
    <div className="card-elevated p-4 sm:p-5 space-y-4" data-testid="draft-visibility-panel">
      <div>
        <h2 className="text-sm font-semibold">Draft visibility</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Read-only view of whatsapp_sales_order_drafts and whatsapp_operator_decisions. No order promotion.
        </p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading drafts…</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {!loading && !error && drafts.length === 0 && (
        <p className="text-sm text-muted-foreground">No WhatsApp sales order drafts yet.</p>
      )}

      {!loading && drafts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Drafts</h3>
          <ul className="space-y-2">
            {drafts.map((draft) => (
              <li
                key={draft.id}
                className="rounded-md border px-3 py-2 text-xs space-y-1"
                data-testid={`draft-row-${draft.id}`}
              >
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <span className="font-medium">{draft.resolved_sku}</span>
                  <span className="text-muted-foreground">qty {draft.quantity}</span>
                  <span className="text-muted-foreground">{draft.status}</span>
                  <span className="text-muted-foreground">{draft.confidence_band}</span>
                </div>
                <p className="text-muted-foreground">{draft.message_body}</p>
                <p className="text-muted-foreground">
                  {draft.sender_phone}
                  {draft.customer_name ? ` · ${draft.customer_name}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && decisions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Operator decisions</h3>
          <ul className="space-y-2">
            {decisions.map((decision) => (
              <li
                key={decision.id}
                className="rounded-md border px-3 py-2 text-xs"
                data-testid={`decision-row-${decision.id}`}
              >
                <span className="font-medium">{decision.action}</span>
                {decision.sku ? ` · ${decision.sku}` : ""}
                {decision.product_name ? ` · ${decision.product_name}` : ""}
                {decision.confidence_band ? ` · ${decision.confidence_band}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
