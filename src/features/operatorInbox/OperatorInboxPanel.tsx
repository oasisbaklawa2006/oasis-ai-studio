import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ProductSuggestionCard } from "@/features/productIntelligence/components/ProductSuggestionCard";
import type { ProductUtteranceResolution, RuntimeAlternative } from "@/features/productIntelligence/runtime";
import { DraftVisibilityPanel } from "./components/DraftVisibilityPanel";
import { InboundMessageBubble } from "./components/InboundMessageBubble";
import {
  createSalesOrderDraftFromOperator,
  recordOperatorDecision,
} from "./createSalesOrderDraft";
import { isRenderableStoredResolution } from "./draftGovernance";
import { fetchDraftVisibility, type WhatsAppDraftRow } from "./fetchDraftVisibility";
import { fetchInboundMessages } from "./fetchInboundMessages";
import {
  confirmSuggestion,
  hydrateOperatorStateFromDraft,
  initialOperatorState,
  mergeOperatorStateOnResolution,
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
import { useOperatorInboxRealtime } from "./useOperatorInboxRealtime";
import type { InboxFeedMode } from "./whatsappInboundTypes";

type MessageRowProps = {
  message: InboundWhatsAppMessage;
  existingDraft: WhatsAppDraftRow | null;
  onDraftCreated?: () => void;
};

function MessageRow({ message, existingDraft, onDraftCreated }: MessageRowProps) {
  const renderFromDb = isRenderableStoredResolution(message.stored_resolution)
    ? message.stored_resolution
    : null;
  const [resolution, setResolution] = useState<ProductUtteranceResolution | null>(renderFromDb);
  const [resolverError, setResolverError] = useState<string | null>(
    message.resolver_status === "failed"
      ? "Resolver failed at ingest — message shown without suggestion."
      : null,
  );
  const [loading, setLoading] = useState(
    !renderFromDb && message.resolver_status !== "failed",
  );
  const [operator, setOperator] = useState<OperatorSuggestionState>(() =>
    existingDraft
      ? hydrateOperatorStateFromDraft(existingDraft)
      : initialOperatorState(renderFromDb),
  );
  const [draftId, setDraftId] = useState<string | null>(existingDraft?.id ?? null);
  const [draftStatus, setDraftStatus] = useState<string | null>(existingDraft?.status ?? null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (message.resolver_status === "failed") {
      setResolution(null);
      setOperator(initialOperatorState(null));
      setResolverError("Resolver failed at ingest — message shown without suggestion.");
      setLoading(false);
      return;
    }

    const stored = isRenderableStoredResolution(message.stored_resolution)
      ? message.stored_resolution
      : null;

    if (stored) {
      setResolution(stored);
      setOperator((prev) => mergeOperatorStateOnResolution(prev, stored, existingDraft));
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
        if (res) {
          setResolution(res);
          setOperator((prev) => mergeOperatorStateOnResolution(prev, res, existingDraft));
        } else {
          setResolution(null);
          setResolverError("Resolver unavailable — message shown without suggestion.");
        }
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
  }, [message.body, message.id, message.resolver_status, message.stored_resolution, existingDraft?.id]);

  useEffect(() => {
    if (!existingDraft) return;
    setOperator(hydrateOperatorStateFromDraft(existingDraft));
    setDraftId(existingDraft.id);
    setDraftStatus(existingDraft.status);
    setDraftError(null);
  }, [existingDraft?.id, existingDraft?.resolved_sku, existingDraft?.status, existingDraft?.created_at]);

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
    if (next.decision !== "confirmed" || !next.selected_sku) return;

    audit("confirm", next.selected_sku, next.selected_product_name);
    setDraftError(null);
    setConfirming(true);

    void (async () => {
      try {
        if (message.source !== "live" || !resolution) {
          setOperator(next);
          return;
        }
        const result = await createSalesOrderDraftFromOperator({
          source_message_id: message.id,
          resolution,
          operator: next,
        });
        if (!result?.draft) {
          setDraftError("Confirm failed — draft was not created. Selection kept.");
          return;
        }
        setOperator(next);
        setDraftId(result.draft.id);
        setDraftStatus(result.draft.status);
        onDraftCreated?.();
      } catch (e) {
        setDraftError(e instanceof Error ? e.message : "Confirm failed — selection kept.");
      } finally {
        setConfirming(false);
      }
    })();
  };

  const onReject = () => {
    const next = rejectSuggestion(operator);
    setOperator(next);
    audit("reject", null, null);
    if (message.source === "live") {
      void recordOperatorDecision({
        source_message_id: message.id,
        action: "reject",
        sku: null,
        product_name: null,
        confidence_band: resolution?.confidence_band ?? null,
      }).catch(() => undefined);
    }
  };

  const onSelectAlternative = (alt: RuntimeAlternative) => {
    if (operator.decision !== "pending" || confirming) return;
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
          disabled={confirming}
          draftStatus={draftStatus}
        />
      )}
      {confirming && (
        <p className="text-xs text-muted-foreground mt-2">Confirming selection…</p>
      )}
      {draftId && (
        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-2">
          Sales order draft created: {draftId}
        </p>
      )}
      {draftError && (
        <p className="text-xs text-destructive mt-2">{draftError}</p>
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
  const [drafts, setDrafts] = useState<Awaited<ReturnType<typeof fetchDraftVisibility>>["drafts"]>([]);
  const [decisions, setDecisions] = useState<Awaited<ReturnType<typeof fetchDraftVisibility>>["decisions"]>([]);
  const [draftVisibilityError, setDraftVisibilityError] = useState<string | null>(null);
  const [loadingDraftVisibility, setLoadingDraftVisibility] = useState(true);

  const loadFeed = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoadingFeed(true);
    try {
      const feed = await fetchInboundMessages();
      setMessages(feed.messages);
      setBanner(feed.banner);
      setMode(feed.mode);
    } finally {
      if (!options?.silent) setLoadingFeed(false);
    }
  }, []);

  const loadDraftVisibility = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoadingDraftVisibility(true);
    try {
      const result = await fetchDraftVisibility();
      setDrafts(result.drafts);
      setDecisions(result.decisions);
      setDraftVisibilityError(result.error);
    } finally {
      if (!options?.silent) setLoadingDraftVisibility(false);
    }
  }, []);

  const refreshAll = useCallback(async (options?: { silent?: boolean }) => {
    await Promise.all([loadFeed(options), loadDraftVisibility(options)]);
  }, [loadDraftVisibility, loadFeed]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useOperatorInboxRealtime({
    enabled: mode === "live",
    onRefresh: () => {
      void refreshAll({ silent: true });
    },
  });

  const onSeedTestMessages = async () => {
    setSeeding(true);
    try {
      await seedPhase2cTestMessagesToDatabase();
      await refreshAll();
    } finally {
      setSeeding(false);
    }
  };

  const inboxReady = !loadingFeed && !loadingDraftVisibility;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="WhatsApp Operator Inbox"
        subtitle="Phase 2F — Meta webhook ingest, realtime inbox, quantity-aware drafts, and read-only draft visibility."
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
        {!inboxReady && !loadingFeed && loadingDraftVisibility && (
          <p className="text-sm text-muted-foreground">Loading draft state…</p>
        )}
        {inboxReady && messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No inbound messages yet. Use the dev seeder or webhook ingest adapter.
          </p>
        )}
        {inboxReady &&
          messages.map((msg) => (
            <MessageRow
              key={msg.id}
              message={msg}
              existingDraft={drafts.find((draft) => draft.source_message_id === msg.id) ?? null}
              onDraftCreated={() => void loadDraftVisibility({ silent: true })}
            />
          ))}
      </div>

      <DraftVisibilityPanel
        drafts={drafts}
        decisions={decisions}
        loading={loadingDraftVisibility}
        error={draftVisibilityError}
      />
      <p className="text-xs text-muted-foreground max-w-3xl">
        Confirm creates a reviewable sales order draft only — no final order, stock, finance, or outbound replies.
        Reject writes an operator audit record when live ingestion is enabled.
      </p>
    </div>
  );
}

export type { InboundMessageView };
