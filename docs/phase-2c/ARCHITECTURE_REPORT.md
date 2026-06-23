# Phase 2C — Architecture Report

## Investigation summary

| Area | Finding |
|------|---------|
| WhatsApp message tables | **None** in `supabase/migrations/` |
| Operator inbox | Phase 2B preview at `/admin/operator-inbox` — fixture-driven |
| Webhooks | `test-integration` edge fn checks WA env vars only; no inbound handler |
| Resolver | Phase 2A frozen runtime (`resolveProductUtterance`, `loadRuntimeCatalog`) |
| Operator audit | Phase 2B `localStorage` only (`oasis_operator_suggestion_audit_v1`) |
| Auth/RLS | `is_team_member(auth.uid())` pattern used across catalogue tables |

**Conclusion:** SQL migration is **required**. No existing table safely supports live inbound capture.

## Proposed minimal schema

Table: `whatsapp_inbound_messages`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `provider_message_id` | text unique nullable | Idempotency key (future Meta `wamid`) |
| `sender_phone` | text not null | |
| `sender_name` | text nullable | |
| `message_body` | text not null | |
| `message_type` | text default `'text'` | |
| `received_at` | timestamptz | |
| `raw_payload` | jsonb nullable | Provider payload archive |
| `resolver_status` | text | `pending` \| `resolved` \| `failed` |
| `resolver_result_json` | jsonb nullable | Phase 2A `ProductUtteranceResolution` snapshot |
| `created_at` | timestamptz | |

RLS:
- **SELECT** — authenticated team members (`is_team_member`)
- **INSERT** — via `ingest_whatsapp_inbound_message` RPC (SECURITY DEFINER) or service role (future webhook)
- **No public write**

Operator decision persistence remains **localStorage** (Phase 2B). A separate `whatsapp_operator_decisions` table is deferred.

## Ingestion flow

```
Inbound payload (internal adapter / future webhook)
        │
        ▼
validateWhatsAppInboundInput()
        │
        ▼
resolveInboundMessage()          ← frozen Phase 2A runtime
        │
        ▼
ingest_whatsapp_inbound_message RPC
  (idempotent on provider_message_id)
        │
        ▼
whatsapp_inbound_messages row
```

**Strict exclusions enforced:** no order APIs, no stock writes, no outbound WhatsApp calls, no ERP hooks.

## Operator inbox flow (upgraded)

```
fetchInboundMessages()
        │
        ├─ table available + rows → LIVE mode
        └─ table missing/error → SAMPLE fallback + banner

MessageRow
        │
        ├─ stored resolver_result_json → ProductSuggestionCard (no re-resolve)
        └─ else → resolveInboundMessage() at render time
```

## Risk assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Accidental order creation | Low | No order modules imported; tests assert no `order_id` |
| Public message injection | Medium | RLS + RPC team gate; no anon INSERT |
| Duplicate webhook delivery | Medium | Unique `provider_message_id` + RPC idempotent return |
| Resolver drift vs Phase 2A | Low | Reuse `resolveInboundMessage` unchanged |
| Empty live table UX | Low | Banner shows "Live messages enabled"; dev seeder available |
| Migration not applied in env | Low | Inbox falls back to Phase 2B fixtures |

## Implementation plan

1. Apply migration `20260623140000_whatsapp_inbound_messages_phase2c.sql`
2. Add `ingestInboundMessage` adapter (validate → resolve → RPC)
3. Add `fetchInboundMessages` with live/sample fallback
4. Upgrade `OperatorInboxPanel` banner + live feed
5. Add dev-only `seedPhase2cTestMessages`
6. Tests for validation, idempotency, fallback, governance, no outbound API
7. Docs: this report + `IMPLEMENTATION_REPORT.md`

## Next phase boundary (Phase 2D+)

- Meta WhatsApp webhook edge function (service role ingest)
- Durable operator decision table
- Realtime inbox subscription
- Outbound reply / order draft creation (explicitly out of scope for 2C)
