// Point 27, Finding 1 (re-evaluated): this feature writes to Core's `whatsapp_sales_order_drafts`
// table, which never gets promoted into anything final. Central independently owns a materially
// more complete, canonical Sales Order Draft pipeline (`src/lib/wa-sales-order-draft/*` in
// oasis-baklawa-central -> `sales_order_drafts`, packet-based, extraction-versioned,
// actor-audited, feeds real Sales Orders). Under the App-Verse ownership model - Central + Core
// own operational/commercial authority, AI Studio owns intelligence/extraction/recommendation -
// this module is superseded, competing operational authority, not a peer pipeline: no promotion
// path from `whatsapp_sales_order_drafts` into Central's `sales_order_drafts` should be built.
// The upstream ingestion bridge is deliberately disabled (`BRIDGE_ENABLED=false`, "retained for
// safety" per BACKEND_OWNERSHIP.md) and must stay that way pending an operator decision, not a
// code change. This module is kept in place (not deleted) because it is real, honestly-labeled,
// previously-deliberately-preserved engineering work, and its WhatsApp-utterance-to-SKU
// resolution logic may be worth salvaging into a future Central-facing contract - but whether to
// delete it outright is a scale/reversibility call for the owner, not something this session
// infers. Do not wire this module's drafts anywhere, and do not re-enable the bridge.
export { default as OperatorInboxPanel } from "./OperatorInboxPanel";
export { resolveInboundMessage } from "./resolveInboundMessage";
export { ingestInboundMessage, createInMemoryIngestStore } from "./ingestInboundMessage";
export { fetchInboundMessages, resolveInboxFeed } from "./fetchInboundMessages";
export { processWebhookPayload } from "./webhook/processWebhookPayload";
export { normalizeWebhookPayload } from "./webhook/normalizeWebhookPayload";
export {
  createSalesOrderDraftFromOperator,
  recordOperatorDecision,
  createInMemoryDraftStore,
} from "./createSalesOrderDraft";
export { canCreateSalesOrderDraft, isCompleteResolution } from "./draftGovernance";
export { validateWhatsAppInboundInput, isWhatsAppTableUnavailable } from "./validateWhatsAppInbound";
export {
  seedPhase2cTestMessagesInMemory,
  seedPhase2cTestMessagesToDatabase,
  isPhase2cTestSeedEnabled,
  PHASE2C_TEST_SEED_MESSAGES,
} from "./seedPhase2cTestMessages";
export { appendSuggestionAudit, getSuggestionAuditLog, clearSuggestionAuditLog } from "./suggestionAudit";
export {
  confirmSuggestion,
  initialOperatorState,
  rejectSuggestion,
  selectAlternative,
} from "./operatorSuggestionState";
export {
  canPreselectTopMatch,
  displayActionForBand,
  showPrimarySuggestion,
} from "./suggestionGovernance";
export { SAMPLE_INBOUND_MESSAGES } from "./fixtures/sampleMessages";
export type {
  InboundWhatsAppMessage,
  OperatorSuggestionState,
  SuggestionAuditEvent,
} from "./types";
export type {
  WhatsAppInboundInput,
  WhatsAppInboundMessageRow,
  InboxFeedMode,
  InboxFeedResult,
} from "./whatsappInboundTypes";
