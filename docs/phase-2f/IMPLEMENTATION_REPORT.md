# Phase 2F — Implementation Report

## SQL migration required

**Yes** — apply on production Supabase after merge:

`supabase/migrations/20260624160000_whatsapp_phase2f_quantity_realtime.sql`

Changes:
- `create_whatsapp_sales_order_draft_from_operator` gains `_quantity NUMERIC DEFAULT 1`
- Adds `whatsapp_inbound_messages`, `whatsapp_sales_order_drafts`, `whatsapp_operator_decisions` to `supabase_realtime` publication

## Edge function deploy required

```bash
supabase functions deploy whatsapp-webhook --project-ref tcxvcatsqqertcnycuop
```

Set secrets: `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`. Optional dev: `ALLOW_TEST_WEBHOOK=true`.

## Files changed

| Area | Files |
|------|-------|
| Quantity | `parseOrderQuantity.ts`, `types.ts`, `resolveProductUtterance.ts` |
| Draft RPC wiring | `createSalesOrderDraft.ts`, `types.extensions.ts` |
| Edge webhook | `whatsapp-webhook/index.ts`, `_shared/metaSignature.ts`, `_shared/catalogLoader.ts`, `_shared/resolveInboundAtEdge.ts`, `_shared/runtime/*` |
| Inbox UI | `OperatorInboxPanel.tsx`, `useOperatorInboxRealtime.ts`, `fetchDraftVisibility.ts`, `components/DraftVisibilityPanel.tsx` |
| Migration | `20260624160000_whatsapp_phase2f_quantity_realtime.sql` |
| Tests | `phase2fWebhookRealtimeDrafts.test.ts`, `phase2fMetaSignature.test.ts` |
| Docs | `docs/phase-2f/ARCHITECTURE_REPORT.md`, this file |

## Tests

```
npm test
npm run typecheck
npm run build
```

## Production deployment readiness

**Ready after:**
1. PR merge to `main`
2. Vercel production deploy (Studio UI)
3. Supabase migration apply
4. Edge function deploy + Meta webhook URL + secrets

**Blocker if skipped:** Meta POST without migration still works for ingest; draft quantity stays `1` until RPC migration applied. Realtime refresh requires publication migration.
