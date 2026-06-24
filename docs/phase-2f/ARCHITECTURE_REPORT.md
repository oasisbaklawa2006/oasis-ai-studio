# Phase 2F — Architecture Report

## Goal

Close the WhatsApp-to-draft workflow in safe mode: production Meta webhook ingest with resolver at edge, realtime operator inbox, quantity-aware drafts, and read-only draft visibility — without orders, stock, finance, dispatch, invoices, ERP, or outbound WhatsApp.

## Starting point

- Production commit: `c7d9052`
- Bundle: `index-B1z9U3JM.js`
- Phase 2D/2E tables/RPCs already live on `tcxvcatsqqertcnycuop`

## Architecture

```
Meta WhatsApp POST
        │
        ▼
whatsapp-webhook edge (GET verify + X-Hub-Signature-256)
        │
        ▼
loadCatalogForEdge() + resolveProductUtterance()  [edge bundle]
        │
        ▼
ingest_whatsapp_inbound_message RPC → whatsapp_inbound_messages (resolver_result_json)
        │
        ▼
Supabase Realtime → /admin/operator-inbox refresh
        │
        ▼
Operator Confirm / Alternative (governance unchanged)
        │
        ▼
create_whatsapp_sales_order_draft_from_operator(_quantity) → whatsapp_sales_order_drafts
        │
        ▼
Draft visibility panel (drafts + whatsapp_operator_decisions, read-only)
```

## Key decisions

| Decision | Rationale |
|----------|-----------|
| Edge resolver bundle in `supabase/functions/_shared/runtime/` | Deno deploy boundary; mirrors Phase 2A runtime without `@/` imports |
| Bulk catalog loader in edge | Avoids N+1 alias fetches on every webhook |
| `extractOrderQuantity` separate from `pack_count` | Pack count disambiguates SKU; order quantity feeds draft line qty |
| Fail-closed Meta signature | Missing `WHATSAPP_APP_SECRET` → 503; invalid signature → 401 |
| Test provider gated by `ALLOW_TEST_WEBHOOK=true` | Prevents unsigned test payloads in production |
| Realtime publication migration | Enables inbox/draft panel auto-refresh without polling |

## Governance (unchanged)

| Band | Confirm → draft | Alternative → draft |
|------|-----------------|---------------------|
| HIGH | Yes (`AI_DRAFT`) | Yes |
| MEDIUM | Yes (`UNDER_REVIEW`) | Yes |
| LOW | No | Yes only |
| Reject | Audit only | |

## Exclusions preserved

No final sales orders, promotion, inventory, stock deduction, dispatch, finance, invoices, ERP, outbound WhatsApp, or automatic operator actions.

## Production env requirements

| Variable | Purpose |
|----------|---------|
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Meta GET challenge |
| `WHATSAPP_APP_SECRET` | `X-Hub-Signature-256` validation |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Edge ingest RPC |
| `ALLOW_TEST_WEBHOOK` | Optional `provider: test` harness (non-prod) |

## Remaining gap after Phase 2F

1. **Deploy edge function** to production Supabase (`supabase functions deploy whatsapp-webhook`) and register Meta callback URL
2. **Apply migration** `20260624160000_whatsapp_phase2f_quantity_realtime.sql` on live project
3. **Draft promotion / final order** — explicitly out of scope; requires separate phase with order-domain governance
4. **UOM-aware quantity** (kg/box vs piece) — parser uses simple numeric extraction only
5. **Outbound operator notifications** — not implemented (by design)

Phase 2F completes the **ingest → resolve → operator → draft** loop. The next bounded phase is **draft review & promotion governance** (still draft-only until explicit order-domain approval).
