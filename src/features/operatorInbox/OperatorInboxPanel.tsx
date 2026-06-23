import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ProductSuggestionCard } from "@/features/productIntelligence/components/ProductSuggestionCard";
import type { ProductUtteranceResolution, RuntimeAlternative } from "@/features/productIntelligence/runtime";
import { InboundMessageBubble } from "./components/InboundMessageBubble";
import { SAMPLE_INBOUND_MESSAGES } from "./fixtures/sampleMessages";
import {
  confirmSuggestion,
  initialOperatorState,
  rejectSuggestion,
  selectAlternative,
} from "./operatorSuggestionState";
import { resolveInboundMessage } from "./resolveInboundMessage";
import { appendSuggestionAudit } from "./suggestionAudit";
import type { InboundMessageView, InboundWhatsAppMessage, OperatorSuggestionState } from "./types";

type MessageRowProps = {
  message: InboundWhatsAppMessage;
};

function MessageRow({ message }: MessageRowProps) {
  const [resolution, setResolution] = useState<ProductUtteranceResolution | null>(null);
  const [resolverError, setResolverError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [operator, setOperator] = useState<OperatorSuggestionState>(initialOperatorState(null));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setResolverError(null);
      try {
        const res = await resolveInboundMessage(message.body);
        if (cancelled) return;
        setResolution(res);
        setOperator(initialOperatorState(res));
        if (!res) setResolverError("Resolver unavailable — message shown without suggestion.");
      } catch (e) {
        if (!cancelled) {
          setResolverError(e instanceof Error ? e.message : "Resolver failed");
          setResolution(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [message.body, message.id]);

  const audit = useCallback(
    (action: "confirm" | "reject" | "select_alternative", sku: string | null, name: string | null) => {
      appendSuggestionAudit({
        message_id: message.id,
        utterance: message.body,
        action,
        sku,
        product_name: name,
        confidence_band: resolution?.confidence_band ?? null,
      });
    },
    [message.body, message.id, resolution?.confidence_band],
  );

  const onConfirm = () => {
    const next = confirmSuggestion(operator, resolution);
    setOperator(next);
    audit("confirm", next.selected_sku, next.selected_product_name);
  };

  const onReject = () => {
    const next = rejectSuggestion(operator);
    setOperator(next);
    audit("reject", null, null);
  };

  const onSelectAlternative = (alt: RuntimeAlternative) => {
    const next = selectAlternative(operator, alt);
    setOperator(next);
    audit("select_alternative", alt.sku, alt.product_name);
  };

  return (
    <InboundMessageBubble message={message}>
      {loading && (
        <p className="text-xs text-muted-foreground mt-2">Resolving product…</p>
      )}
      {resolverError && !loading && (
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">{resolverError}</p>
      )}
      {resolution && !loading && (
        <ProductSuggestionCard
          resolution={resolution}
          operator={operator}
          onConfirm={onConfirm}
          onReject={onReject}
          onSelectAlternative={onSelectAlternative}
        />
      )}
    </InboundMessageBubble>
  );
}

export default function OperatorInboxPanel() {
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="WhatsApp Operator Inbox"
        subtitle="Phase 2B preview — read-only product suggestions. No orders, stock, or outbound replies."
      />
      <div className="card-elevated p-4 sm:p-5 space-y-5">
        {SAMPLE_INBOUND_MESSAGES.map((msg) => (
          <MessageRow key={msg.id} message={msg} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground max-w-3xl">
        Operator confirm/reject actions write lightweight audit entries to local storage only.
        Catalogue pilot v1.0 and Phase 2A resolver remain frozen upstream.
      </p>
    </div>
  );
}

export type { InboundMessageView };
