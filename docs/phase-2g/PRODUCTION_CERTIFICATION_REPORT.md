# Phase 2G — Production Certification Report

**Certification date:** 2026-06-25  
**Supabase project:** `tcxvcatsqqertcnycuop` (oasis-baklawa)  
**PR:** #62 — `whatsapp-studio-inbox-bridge`  
**Branch:** `cursor/whatsapp-studio-inbox-bridge-f0bc`

## Deployed revisions

| Artifact | Version / ID | Notes |
|----------|--------------|-------|
| DB migration | `20260625020441` / `whatsapp_studio_inbox_bridge_state` | Applied live |
| Studio edge function | `whatsapp-studio-inbox-bridge` **v3** ACTIVE | New slug only |
| Legacy ERP webhook | `whatsapp-webhook` **v102** ACTIVE | Unchanged (SHA `92d5a919…`) |
| Studio webhook | `whatsapp-studio-inbox-webhook` v1 | Unchanged |

## Migration verification

| Check | Result |
|-------|--------|
| `whatsapp_studio_inbox_bridge_state` table exists | **PASS** |
| Singleton row `id=1` seeded | **PASS** |
| RLS enabled | **PASS** |
| Bridge state untouched (`last_run_at` null) | **PASS** — no live poll executed |

## Edge deployment verification

| Check | Result |
|-------|--------|
| `whatsapp-studio-inbox-bridge` deployed (v3) | **PASS** |
| `verify_jwt=false` + `BRIDGE_CRON_SECRET` gate | **PASS** — unauthenticated invoke → 401 |
| Legacy `whatsapp-webhook` v102 preserved | **PASS** |
| Cron schedule registered | **NOT ENABLED** (intentional) |
| `BRIDGE_ENABLED` live poll | **NOT ENABLED** (fail-closed default) |

## Dry-run (`limit: 5`, no ingest)

Edge HTTP invoke blocked until `BRIDGE_CRON_SECRET` is set on the function (401 unauthorized — expected fail-closed). Mapping dry-run executed via live ERP read against `whatsapp_messages` + `whatsapp_contacts` using bridge cursor logic:

| Metric | Value |
|--------|-------|
| **rows_read** | **5** |
| **rows_ingested** | **0** |
| **rows_skipped** | **0** |
| **rows_mappable** | **5** |

Sample preview (first batch after cursor `1970-01-01`):

| sender_phone | message_body (truncated) |
|--------------|--------------------------|
| +919976543210 | Hello, I need to place an order |
| +919976543210 | Can you send me the price list? |
| +919976543210 | For 500 units of baklava |
| +919891162212 | Hi I'm looking for 50kg baklawa |
| +919891162212 | tcf chocolates , 07aafct0640r1zz |

**66** additional inbound ERP rows exist beyond this 5-row preview window (post-cursor backlog).

## Unit tests

```
npm run test -- src/features/operatorInbox/phase2gErpInboxBridge.test.ts
✓ 11 passed (11)
```

Coverage: ERP row mapping, ingest path, idempotency, governance (no Meta outbound, SELECT-only ERP reader).

## PASS / FAIL matrix

| Area | Status |
|------|--------|
| PR #62 code (bridge + tests) | **PASS** |
| Live DB migration | **PASS** |
| New slug deploy only | **PASS** |
| Legacy `whatsapp-webhook` preserved | **PASS** |
| Dry-run mapping (no ingest) | **PASS** |
| Cron disabled | **PASS** |
| `BRIDGE_ENABLED` poll disabled | **PASS** |
| Edge HTTP dry-run invoke | **PENDING OPS** — set `BRIDGE_CRON_SECRET` |
| Live poll enablement | **PENDING OPS** — owner approval |

## GO / NO-GO

### **GO — Phase 2G safe finalize (dry-run certified)**

Safe to merge PR #62. Bridge infrastructure is live with fail-closed defaults. No cron, no live poll, no inbox rows created during certification.

### Ops follow-up (before live poll)

1. `supabase secrets set BRIDGE_CRON_SECRET="<secret>" BRIDGE_ENABLED=false --project-ref tcxvcatsqqertcnycuop`
2. Edge dry-run: `POST {"dry_run": true, "limit": 5}` with `Authorization: Bearer <secret>`
3. Owner approves → `BRIDGE_ENABLED=true` + cron (separate change)

### Explicit non-goals (preserved)

- No changes to `whatsapp-webhook` v102
- No ERP writes
- No Meta callback changes
- No automatic order/stock/finance side effects from bridge path
