# Phase 2C — Implementation Report

## Summary

Phase 2C adds read-only live WhatsApp inbound message capture with Phase 2A resolver integration at ingest time, and upgrades the Operator Inbox to load live messages when the database table is available.

## SQL migration required

**Yes** — `supabase/migrations/20260623140000_whatsapp_inbound_messages_phase2c.sql`

Creates:
- `whatsapp_inbound_messages` table
- RLS: team SELECT only
- `ingest_whatsapp_inbound_message` RPC (SECURITY DEFINER, idempotent on `provider_message_id`)

Apply via Supabase migration before live ingestion works in production.

## Files changed

| File | Purpose |
|------|---------|
| `supabase/migrations/20260623140000_whatsapp_inbound_messages_phase2c.sql` | Table + RPC |
| `src/features/operatorInbox/validateWhatsAppInbound.ts` | Input validation |
| `src/features/operatorInbox/ingestInboundMessage.ts` | Ingest adapter |
| `src/features/operatorInbox/fetchInboundMessages.ts` | Live/sample inbox feed |
| `src/features/operatorInbox/mapInboundMessage.ts` | Row ↔ UI mapping |
| `src/features/operatorInbox/whatsappInboundTypes.ts` | Phase 2C types |
| `src/features/operatorInbox/seedPhase2cTestMessages.ts` | Dev/test seeder |
| `src/features/operatorInbox/OperatorInboxPanel.tsx` | Live feed + banner |
| `src/features/operatorInbox/types.ts` | Extended message type |
| `src/features/operatorInbox/fixtures/sampleMessages.ts` | `source: sample` |
| `src/features/operatorInbox/index.ts` | Exports |
| `src/features/operatorInbox/phase2cWhatsAppIngestion.test.ts` | Phase 2C tests |
| `src/integrations/supabase/types.extensions.ts` | Table + RPC types |
| `docs/phase-2c/ARCHITECTURE_REPORT.md` | Architecture |
| `docs/phase-2c/IMPLEMENTATION_REPORT.md` | This report |

**Frozen modules not modified:** Phase 2A resolver runtime, ProductSuggestionCard, suggestionGovernance, operatorSuggestionState logic.

## Ingestion flow

```
validateWhatsAppInboundInput()
  → resolveInboundMessage() [Phase 2A]
  → ingest_whatsapp_inbound_message RPC
  → row with resolver_result_json
```

No outbound WhatsApp, orders, stock, or finance calls.

## Operator inbox behavior

| Condition | Banner | Messages |
|-----------|--------|----------|
| Table missing / error | "Live ingestion unavailable — showing sample preview" | Phase 2B fixtures |
| Table exists, empty | "Live messages enabled — no inbound messages yet" | Empty list |
| Table exists, rows | "Live messages enabled" | DB rows with stored resolver |

Dev-only **Seed test messages** button (when `import.meta.env.DEV` or `VITE_ENABLE_PHASE2C_TEST_SEED=true`).

## Tests added

`phase2cWhatsAppIngestion.test.ts` — 11 tests covering:
1. Inbound validation
2. Insert stores `resolver_result_json` (no order)
3. Duplicate `provider_message_id` idempotency
4. Sample fallback when table unavailable
5. Live feed when table available
6. LOW never auto-confirms
7. Confirm/reject/alternative — no orders
8. No outbound WhatsApp API calls
9. Test seeder inserts 5 safe messages

## Exclusions (enforced)

- No Sales Order / draft creation
- No inventory or stock changes
- No finance entries
- No outbound WhatsApp replies
- No ERP integration
- No catalogue architecture changes

## Next phase boundary

- Meta webhook edge function (service role ingest)
- Durable operator decision table
- Realtime inbox updates

## GO / NO-GO

**GO** for Phase 2C read-only ingestion (pending migration apply in target Supabase project).
