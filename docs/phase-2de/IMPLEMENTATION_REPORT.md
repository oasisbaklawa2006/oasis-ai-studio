# Phase 2D/2E — Implementation Report

## Architecture decision

**New `sales_order_drafts` table** — no existing Sprint 9 or sales order draft system in repo. Catalogue `*_drafts` tables were **not** reused.

## SQL migration required

**Yes** — apply after Phase 2C migration:

`supabase/migrations/20260623200000_sales_order_drafts_phase2de.sql`

Creates:
- `sales_order_drafts` — reviewable draft only (UNIQUE per `source_message_id`)
- `whatsapp_operator_decisions` — durable reject/alternative audit
- `create_sales_order_draft_from_operator` RPC
- `record_whatsapp_operator_decision` RPC

## Files changed

| Area | Files |
|------|-------|
| Migration | `supabase/migrations/20260623200000_sales_order_drafts_phase2de.sql` |
| Webhook | `webhook/processWebhookPayload.ts`, `normalizeWebhookPayload.ts`, `types.ts` |
| Edge skeleton | `supabase/functions/whatsapp-webhook/index.ts` |
| Drafts | `createSalesOrderDraft.ts`, `draftGovernance.ts` |
| Inbox | `OperatorInboxPanel.tsx` (confirm/alternative → draft) |
| Tests | `phase2deWebhookAndDraft.test.ts` (15 tests) |
| Types | `types.extensions.ts` |
| Docs | `docs/phase-2de/ARCHITECTURE_REPORT.md`, this file |

**Frozen modules consumed read-only:** Phase 2A resolver, Phase 2B governance/card/state, Phase 2C ingest RPC.

## Part A — Webhook

- Internal adapter: `processWebhookPayload` → validate → Phase 2A resolve → `ingest_whatsapp_inbound_message`
- Edge skeleton: Meta verify GET + POST ingest via service role (`resolver_status: pending` until shared edge resolver)
- No outbound reply

## Part B — Inbox

- Live DB feed (Phase 2C)
- `isCompleteResolution` — re-resolve if stored JSON incomplete
- Draft created on Confirm (HIGH/MEDIUM) or Select alternative (LOW path)

## Part C — Sales order draft

Draft fields: source, source_message_id, sender_phone, customer_name, message_body, resolved SKU/product, confidence_band, operator_decision, status (`AI_DRAFT` / `UNDER_REVIEW`).

## Exclusions preserved

No final sales order, stock, finance, invoice, dispatch, outbound WhatsApp, catalogue changes.

## Tests

```
npm test        → 281 passed (46 files)
npm run typecheck → PASS
npm run build   → PASS
```

Phase 2D/2E tests: 15 new + Phase 2A/2B/2C regression green.

## Production smoke (after migration apply)

1. Apply `20260623200000_sales_order_drafts_phase2de.sql` in Supabase
2. Webhook simulate: `processWebhookPayload({ provider: 'test', ..., message_body: '6 pc midya' })`
3. Open `/admin/operator-inbox` → confirm → verify `sales_order_drafts` row

## GO / NO-GO

**GO** for Phase 2D/2E after second migration is applied to production Supabase.
