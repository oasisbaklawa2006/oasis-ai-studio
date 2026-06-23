import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ProductSuggestionCard } from "@/features/productIntelligence/components/ProductSuggestionCard";
import type { ProductUtteranceResolution, RuntimeAlternative } from "@/features/productIntelligence/runtime";
import { InboundMessageBubble } from "./components/InboundMessageBubble";
import { fetchInboundMessages } from "./fetchInboundMessages";
import {
  confirmSuggestion,
  initialOperatorState,
  rejectSuggestion,
  selectAlternative,
} from "./operatorSuggestionState";
import { resolveInboundMessage } from "./resolveInboundMessage";
import { appendSuggestionAudit } from "./suggestionAudit";
import {
  isPhase2cTestSeedEnabled,
  seedPhase2cTestMessagesToDatabase,
} from "./seedPhase2cTestMessages";
import type { InboundMessageView, InboundWhatsAppMessage, OperatorSuggestionState } from "./types";
import type { InboxFeedMode } from "./whatsappInboundTypes";

type MessageRowProps = {
  message: InboundWhatsAppMessage;
};

function MessageRow({ message }: MessageRowProps) {
  const [resolution, setResolution] = useState<ProductUtteranceResolution | null>(
    message.stored_resolution ?? null,
  );
  const [resolverError, setResolverError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!message.stored_resolution);
  const [operator, setOperator] = useState<OperatorSuggestionState>(
    initialOperatorState(message.stored_resolution ?? null),
  );

  useEffect(() => {
    if (message.stored_resolution) {
      setResolution(message.stored_resolution);
      setOperator(initialOperatorState(message.stored_resolution));
      setResolverError(null);
      setLoading(false);
      return;
    }

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
  }, [message.body, message.id, message.stored_resolution]);

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
  const [messages, setMessages] = useState<InboundWhatsAppMessage[]>([]);
  const [banner, setBanner] = useState("Loading messages…");
  const [mode, setMode] = useState<InboxFeedMode>("sample_fallback");
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const loadFeed = useCallback(async () => {
    setLoadingFeed(true);
    try {
      const feed = await fetchInboundMessages();
      setMessages(feed.messages);
      setBanner(feed.banner);
      setMode(feed.mode);
    } finally {
      setLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const onSeedTestMessages = async () => {
    setSeeding(true);
    try {
      await seedPhase2cTestMessagesToDatabase();
      await loadFeed();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="WhatsApp Operator Inbox"
        subtitle="Phase 2C — read-only live ingestion + product suggestions. No orders, stock, or outbound replies."
        actions={
          isPhase2cTestSeedEnabled() ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={seeding || loadingFeed}
              onClick={() => void onSeedTestMessages()}
            >
              {seeding ? "Seeding…" : "Seed test messages"}
            </Button>
          ) : undefined
        }
      />

      <div
        className={`rounded-lg border px-3 py-2 text-xs ${
          mode === "live"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
            : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
        }`}
        data-testid="inbox-feed-banner"
      >
        {banner}
      </div>

      <div className="card-elevated p-4 sm:p-5 space-y-5">
        {loadingFeed && (
          <p className="text-sm text-muted-foreground">Loading inbox…</p>
        )}
        {!loadingFeed && messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No inbound messages yet. Use the dev seeder or ingest via the Phase 2C adapter.
          </p>
        )}
        {!loadingFeed &&
          messages.map((msg) => <MessageRow key={msg.id} message={msg} />)}
      </div>
      <p className="text-xs text-muted-foreground max-w-3xl">
        Operator confirm/reject actions write lightweight audit entries to local storage only.
        Inbound messages are stored read-only in `whatsapp_inbound_messages` when the table is available.
      </p>
    </div>
  );
}

export type { InboundMessageView };
