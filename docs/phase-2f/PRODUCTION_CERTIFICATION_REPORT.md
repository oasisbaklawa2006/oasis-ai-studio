# Phase 2F — Production Certification Report

**Certification date:** 2026-06-24  
**Supabase project:** `tcxvcatsqqertcnycuop` (oasis-baklawa)  
**Studio production URL:** https://oasis-ai-studio.vercel.app/admin/operator-inbox

## Deployed revisions

| Artifact | SHA / version | Notes |
|----------|---------------|-------|
| Git merge commit | `b38cd92` | PR #59 merged to `main` |
| Feature commit | `ee6a122` | Phase 2F implementation |
| Vercel production bundle | `index-Hxrlorpg.js` | Deploy `2026-06-24T16:58:47Z` |
| DB migration | `20260624165827` / `whatsapp_phase2f_quantity_realtime` | Applied live |
| Studio edge function | `whatsapp-studio-inbox-webhook` v1 | Safe slug — does **not** replace legacy ERP webhook |

## Production architecture verification

### Studio path (Phase 2F — certified)

```
Meta / test POST → whatsapp-studio-inbox-webhook (edge, draft-only)
        → resolveProductUtterance + order_quantity
        → ingest_whatsapp_inbound_message
        → whatsapp_inbound_messages (resolver_result_json)
        → Supabase Realtime → Operator Inbox UI
        → operator confirm → create_whatsapp_sales_order_draft_from_operator(_quantity)
        → whatsapp_sales_order_drafts + whatsapp_operator_decisions
```

### Legacy path (unchanged — intentional)

The existing slug **`whatsapp-webhook` v99** remains the live ERP/B2B pipeline (orders, outbound WhatsApp, PI, shadow clients).  
**Phase 2F code was NOT deployed to this slug** — overwriting it would have been a production-breaking change.

## Migration verification

| Check | Result |
|-------|--------|
| `_quantity` on `create_whatsapp_sales_order_draft_from_operator` | **PASS** — `numeric DEFAULT 1` |
| Old 6-arg RPC dropped | **PASS** |
| `supabase_realtime` includes `whatsapp_inbound_messages` | **PASS** |
| `supabase_realtime` includes `whatsapp_sales_order_drafts` | **PASS** |
| `supabase_realtime` includes `whatsapp_operator_decisions` | **PASS** |

## Edge deployment verification

| Check | Result |
|-------|--------|
| `whatsapp-studio-inbox-webhook` deployed | **PASS** — v1 ACTIVE |
| URL reachable | **PASS** — `https://tcxvcatsqqertcnycuop.supabase.co/functions/v1/whatsapp-studio-inbox-webhook` |
| Test provider gated (`ALLOW_TEST_WEBHOOK`) | **PASS** — returns 403 when disabled (fail-closed) |
| Legacy `whatsapp-webhook` v99 preserved | **PASS** — ERP pipeline untouched |

## End-to-end production smoke (live DB)

Simulated: webhook ingest → `resolver_result_json.order_quantity=6` → operator confirm → draft qty 6

| Step | Result |
|------|--------|
| Ingest `6 pc midya` | **PASS** — `smoke-phase2f-closeout-001` |
| `resolver_status=resolved` | **PASS** |
| `stored_order_quantity=6` | **PASS** |
| Draft `quantity=6`, `status=AI_DRAFT` | **PASS** |
| Operator decision `confirm` | **PASS** |
| No `orders` table mutation | **PASS** |
| No stock/finance/dispatch side effects | **PASS** (governance preserved) |

## Studio UI verification (production bundle)

| String in `index-Hxrlorpg.js` | Present |
|-------------------------------|---------|
| `create_whatsapp_sales_order_draft_from_operator` | Yes |
| `order_quantity` | Yes |
| `operator-inbox-phase2f` (realtime channel) | Yes |
| `draft-visibility` / `Draft visibility` | Yes |
| `whatsapp_sales_order_drafts` | Yes |

## PASS / FAIL matrix

| Area | Status |
|------|--------|
| PR #59 merged | **PASS** |
| Live DB migration | **PASS** |
| Realtime publication | **PASS** |
| Quantity RPC + persistence | **PASS** |
| Vercel production deploy | **PASS** |
| Studio edge function (safe slug) | **PASS** |
| Legacy ERP webhook preserved | **PASS** |
| E2E SQL smoke (ingest → draft → qty) | **PASS** |
| Meta URL cutover to Studio webhook | **PENDING OPS** — not required for Studio certification |
| `ALLOW_TEST_WEBHOOK` / `WHATSAPP_APP_SECRET` on studio edge | **PENDING OPS** — configure for live Meta POST |

## GO / NO-GO

### **GO — Phase 2F Studio implementation FROZEN**

Phase 2F is certified for the **WhatsApp-to-draft Studio workflow** on production Supabase + Vercel.

### Ops follow-up (not blocking freeze)

1. Set edge secrets on `whatsapp-studio-inbox-webhook`: `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
2. Register Meta callback URL to studio slug (parallel to legacy ERP webhook until cutover plan approved)
3. Optional: `ALLOW_TEST_WEBHOOK=true` in non-prod only

### Explicit non-goals (preserved)

No final sales orders, stock, finance, dispatch, invoices, ERP auto-writes, or outbound WhatsApp from the Studio draft path.

## Remaining gap after Phase 2F

**Phase 2G — Draft review & promotion governance** (human-approved path from `whatsapp_sales_order_drafts` toward final orders, with explicit guards and no automatic stock/finance side effects).
