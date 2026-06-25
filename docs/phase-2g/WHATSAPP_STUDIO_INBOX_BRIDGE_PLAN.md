# Phase 2G — WhatsApp Studio Inbox Bridge (Plan Only)

**Status:** Design / pre-implementation  
**Date:** 2026-06-25  
**Supabase project:** `tcxvcatsqqertcnycuop` (oasis-baklawa)  
**Studio UI:** `/admin/operator-inbox`

## Problem

Phase 2F certified the Studio draft-only ingest path (`whatsapp-studio-inbox-webhook` → `ingest_whatsapp_inbound_message` → `whatsapp_inbound_messages`). Production Meta callbacks still POST to legacy **`whatsapp-webhook` v99** (ERP/B2B pipeline). That handler writes to ERP tables (including `whatsapp_messages`) but **does not** populate `whatsapp_inbound_messages`.

Operators using the Studio inbox therefore see test/seed traffic only, not live ERP WhatsApp volume.

## Constraints (non-negotiable)

| Constraint | Rationale |
|------------|-----------|
| **Do not modify or deploy `whatsapp-webhook`** | Preserves live ERP/B2B pipeline (orders, outbound WA, PI, shadow clients) |
| **No Meta callback URL changes** | ERP webhook remains the Meta subscription target |
| **No ERP schema or handler changes** | Bridge is Studio-owned; ERP is read-only source |
| **No writes to ERP tables** | Studio path stays draft-only; no order/stock/finance side effects |
| **Reuse existing ingest RPC** | `ingest_whatsapp_inbound_message` is idempotent and already powers inbox + realtime |

## Target flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ERP (read-only)                                                         │
│   whatsapp_messages  ←── legacy whatsapp-webhook v99 (unchanged)        │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ SELECT new inbound rows (cursor / poll)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Studio-owned edge function (NEW)                                        │
│   whatsapp-studio-inbox-bridge                                          │
│     1. mapErpRowToInboundInput()                                        │
│     2. resolveInboundAtEdge()  [reuse _shared bundle]                   │
│     3. admin.rpc("ingest_whatsapp_inbound_message", …)                  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Studio (existing — no schema change required for MVP)                   │
│   whatsapp_inbound_messages                                             │
│     → Supabase Realtime (operator-inbox-phase2f)                        │
│     → Operator Inbox UI → draft confirm path (Phase 2D–2F)              │
└─────────────────────────────────────────────────────────────────────────┘
```

Parallel paths coexist intentionally:

| Path | Trigger | Writes ERP | Writes Studio inbox |
|------|---------|------------|---------------------|
| Legacy `whatsapp-webhook` v99 | Meta POST | Yes | No |
| `whatsapp-studio-inbox-webhook` | Meta POST (optional future) | No | Yes |
| **`whatsapp-studio-inbox-bridge`** (new) | Cron / manual invoke | **No** | Yes |

---

## Architecture

### Components

| Component | Owner | Location (proposed) | Responsibility |
|-----------|-------|---------------------|----------------|
| ERP `whatsapp_messages` | ERP | External table (same DB or cross-ref TBD) | Source of truth for live inbound WA traffic |
| `whatsapp-studio-inbox-bridge` | Studio | `supabase/functions/whatsapp-studio-inbox-bridge/index.ts` | Poll/read ERP rows, resolve, ingest |
| `mapErpWhatsAppMessage` | Studio | `src/features/operatorInbox/bridge/mapErpWhatsAppMessage.ts` | Pure field mapping + validation (Vitest-testable) |
| `processErpInboundRow` | Studio | `src/features/operatorInbox/bridge/processErpInboundRow.ts` | Mirror of `processWebhookPayload` for ERP rows |
| `whatsapp_studio_inbox_bridge_state` | Studio | New migration | Cursor, run metadata, dead-letter audit |
| `ingest_whatsapp_inbound_message` | Studio (existing) | `20260623140000_whatsapp_inbound_messages_phase2c.sql` | Idempotent insert into inbox |
| `resolveInboundAtEdge` | Studio (existing) | `supabase/functions/_shared/resolveInboundAtEdge.ts` | Catalog load + Phase 2A resolver at edge |

### ERP row assumptions (confirm before implementation)

`whatsapp_messages` is **not defined in this repo**. Owner must supply a schema audit. Proposed mapping (adjust after audit):

| ERP column (assumed) | Studio `ingest_whatsapp_inbound_message` arg | Notes |
|----------------------|-----------------------------------------------|-------|
| `wamid` / `message_id` / `provider_message_id` | `_provider_message_id` | **Idempotency key** — prefer Meta `wamid` if present |
| `from_phone` / `sender` / `phone` | `_sender_phone` | Required; normalize E.164 |
| `sender_name` / `profile_name` | `_sender_name` | Optional |
| `body` / `text` / `message` | `_message_body` | Required; skip row if empty |
| `message_type` | `_message_type` | Default `text`; map `interactive`/`button` if ERP stores them |
| `created_at` / `received_at` | `_received_at` | Preserve ERP timestamp |
| Full ERP row JSON | `_raw_payload` | Include `{ bridge_source: "erp_whatsapp_messages", erp_row_id, … }` |

**Inbound-only filter:** Bridge must ingest **customer → business** messages only. Skip outbound, status, template, and system rows (exact column TBD from ERP audit, e.g. `direction = 'inbound'`).

### Read strategy

**Recommended: cursor polling via Supabase cron → edge function**

1. `pg_cron` (or Supabase Dashboard cron) invokes `whatsapp-studio-inbox-bridge` every **30–60s**.
2. Bridge reads `whatsapp_studio_inbox_bridge_state.last_erp_cursor` (timestamptz + optional UUID).
3. `SELECT … FROM whatsapp_messages WHERE received_at > cursor AND direction = 'inbound' ORDER BY received_at ASC LIMIT 100`.
4. For each row: map → resolve → RPC ingest.
5. Advance cursor to max `received_at` of successfully processed batch.
6. Persist run summary (`rows_read`, `rows_ingested`, `rows_skipped`, `rows_failed`).

**Why polling (not ERP triggers/webhooks):** Zero ERP changes. Same pattern as other read-only Central preview bridges in this repo.

**Cross-database option:** If ERP lives on a different Supabase project, bridge uses a **read-only** `ERP_SUPABASE_URL` + `ERP_SUPABASE_READ_KEY` (custom role: `SELECT` on `whatsapp_messages` only). No FDW migration on ERP.

### Resolver behavior

Match `whatsapp-studio-inbox-webhook` behavior:

1. `resolveInboundAtEdge(admin, message_body)` using Studio service-role client (catalog from Studio `products` / `product_aliases`).
2. Pass `resolver_status` + `resolver_result_json` into ingest RPC.
3. On resolver failure: ingest with `resolver_status: 'failed'` (same as edge webhook catch path).

Do **not** re-ingest with `pending` unless resolver is intentionally skipped — inbox UI already handles `resolved`/`failed`; `pending` is legacy fallback.

### Idempotency and ordering

| Concern | Mitigation |
|---------|------------|
| Duplicate bridge runs | `provider_message_id` unique on `whatsapp_inbound_messages`; RPC returns existing row |
| ERP row without wamid | Fallback id: `erp:{whatsapp_messages.id}` |
| Out-of-order timestamps | Process `ORDER BY received_at ASC`; cursor = max processed timestamp |
| Partial batch failure | Cursor advances only for rows ingested or confirmed duplicate; failed rows logged to `bridge_run_errors` JSONB |
| Bridge + studio webhook double-ingest | Same `provider_message_id` → single inbox row |

### Security

| Surface | Control |
|---------|---------|
| Bridge HTTP invoke | `Authorization: Bearer <BRIDGE_CRON_SECRET>` or Supabase cron internal JWT |
| ERP connection | Read-only DB role; no INSERT/UPDATE/DELETE grants |
| Studio ingest | Service role on **Studio** project only |
| Manual replay endpoint | Optional `?dry_run=true`; requires same secret |

### Observability

- Structured JSON logs per run: `{ run_id, cursor_before, cursor_after, ingested, duplicates, skipped, errors }`
- `whatsapp_studio_inbox_bridge_state.last_run_at`, `last_error`
- Optional: row in `integration_settings` health probe (extend `test-integration` later — out of MVP scope)

### Explicit non-goals

- Meta subscription or signature verification (bridge does not receive Meta callbacks)
- Outbound WhatsApp replies
- Order creation, stock, finance, dispatch, invoices
- Writes to `whatsapp_messages` or any ERP table
- Replacing or patching `whatsapp-webhook` v99

---

## Proposed PR (implementation)

**Branch:** `cursor/whatsapp-studio-inbox-bridge-301d`  
**Base:** `main`  
**Title:** `feat(whatsapp): add Studio-owned ERP→inbox bridge (Phase 2G)`

### Files to add

```
supabase/functions/whatsapp-studio-inbox-bridge/index.ts
supabase/migrations/20260625140000_whatsapp_studio_inbox_bridge_state.sql
src/features/operatorInbox/bridge/mapErpWhatsAppMessage.ts
src/features/operatorInbox/bridge/processErpInboundRow.ts
src/features/operatorInbox/bridge/types.ts
src/features/operatorInbox/bridge/fixtures/sampleErpWhatsAppRows.ts
src/features/operatorInbox/phase2gErpInboxBridge.test.ts
docs/phase-2g/WHATSAPP_STUDIO_INBOX_BRIDGE_PLAN.md  (this document)
docs/phase-2g/IMPLEMENTATION_REPORT.md               (post-merge)
```

### Files that must NOT change

```
supabase/functions/whatsapp-webhook/**   ← frozen ERP-adjacent slug in repo; do not deploy
```

### PR description template

```markdown
## Summary

Adds `whatsapp-studio-inbox-bridge`, a Studio-owned poller that reads ERP
`whatsapp_messages` (read-only) and ingests into `whatsapp_inbound_messages`
via the existing `ingest_whatsapp_inbound_message` RPC.

Closes the Phase 2F gap: live ERP WhatsApp traffic visible in Operator Inbox
without modifying legacy `whatsapp-webhook` v99 or Meta callback URLs.

## Governance

- [x] No changes to `whatsapp-webhook`
- [x] No ERP migrations or writes
- [x] No Meta callback changes
- [x] Reuses Phase 2A edge resolver + Phase 2C ingest RPC
- [x] Draft-only path preserved (no orders/stock/finance)

## Ops follow-up (separate from merge)

- [ ] Confirm ERP `whatsapp_messages` column map with owner
- [ ] Set bridge secrets on Supabase
- [ ] Deploy edge function to new slug only
- [ ] Enable cron schedule
- [ ] Smoke: ERP row → inbox row → realtime UI
```

### Acceptance criteria

1. One ERP inbound row → one `whatsapp_inbound_messages` row with `resolver_result_json`.
2. Re-running bridge on same ERP row → duplicate ingest (same `id`, no second row).
3. `fetch` never calls `graph.facebook.com`.
4. No SQL `INSERT`/`UPDATE`/`DELETE` against ERP tables (enforced by read-only credentials + code review).
5. Operator Inbox realtime refreshes without UI changes.

---

## Tests

### Unit tests (`phase2gErpInboxBridge.test.ts`)

Follow patterns from `phase2deWebhookAndDraft.test.ts` and `phase2cWhatsAppIngestion.test.ts`.

| Test case | Assertion |
|-----------|-----------|
| `mapErpWhatsAppMessage` happy path | All ingest args populated; `raw_payload.bridge_source = 'erp_whatsapp_messages'` |
| Missing `sender_phone` | Row skipped with reason; no RPC call |
| Empty `message_body` | Row skipped |
| Outbound ERP row (`direction: outbound`) | Skipped |
| Unknown `message_type` (image/audio) | Skipped or `ignored: true` (match webhook adapter rules) |
| `processErpInboundRow` valid row | `resolver_status: resolved` for known catalog utterance |
| Duplicate `provider_message_id` | `duplicate: true`, single store row |
| Resolver throws | Ingest with `resolver_status: failed` |
| Governance: no outbound API | `vi.spyOn(globalThis, 'fetch')` — no `graph.facebook.com` |
| Governance: no ERP writes | Mock ERP client — only `.from('whatsapp_messages').select()` allowed |

### In-memory dependencies

Reuse `createInMemoryIngestStore()` from `ingestInboundMessage.ts`. Add `createMockErpReader(rows, cursor)` returning paginated ERP fixtures from `sampleErpWhatsAppRows.ts`.

### Edge function smoke (manual / staging)

```bash
curl -X POST \
  -H "Authorization: Bearer $BRIDGE_CRON_SECRET" \
  -H "Content-Type: application/json" \
  "https://tcxvcatsqqertcnycuop.supabase.co/functions/v1/whatsapp-studio-inbox-bridge" \
  -d '{"dry_run": true, "limit": 5}'
```

Expected: `{ ok: true, dry_run: true, rows_read: N, preview: [...] }` with no DB writes.

### CI

Existing `release-quality-gate.yml` runs `npm run test` — new Vitest file runs automatically. No Deno test runner in CI today; edge logic delegates mapping to shared TS modules tested under Vitest.

### Production verification SQL (post-deploy)

```sql
-- Latest bridge state
SELECT * FROM public.whatsapp_studio_inbox_bridge_state LIMIT 1;

-- Inbox rows sourced from bridge
SELECT id, provider_message_id, sender_phone, message_body, received_at,
       raw_payload->>'bridge_source' AS bridge_source
FROM public.whatsapp_inbound_messages
WHERE raw_payload->>'bridge_source' = 'erp_whatsapp_messages'
ORDER BY received_at DESC
LIMIT 10;
```

---

## Migration

**File:** `supabase/migrations/20260625140000_whatsapp_studio_inbox_bridge_state.sql`

Studio-only. No changes to `whatsapp_inbound_messages`, `ingest_whatsapp_inbound_message`, or ERP objects.

```sql
-- Phase 2G: bridge cursor + run audit (Studio-owned, read/write via service role only)

CREATE TABLE IF NOT EXISTS public.whatsapp_studio_inbox_bridge_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- singleton
  last_erp_cursor TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  last_erp_row_id TEXT,                               -- optional tie-breaker UUID
  last_run_at TIMESTAMPTZ,
  last_run_rows_read INT NOT NULL DEFAULT 0,
  last_run_rows_ingested INT NOT NULL DEFAULT 0,
  last_run_rows_duplicate INT NOT NULL DEFAULT 0,
  last_run_rows_skipped INT NOT NULL DEFAULT 0,
  last_run_rows_failed INT NOT NULL DEFAULT 0,
  last_error TEXT,
  last_run_errors JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.whatsapp_studio_inbox_bridge_state IS
  'Phase 2G ERP→Studio inbox bridge cursor. Service role only; no operator UI.';

ALTER TABLE public.whatsapp_studio_inbox_bridge_state ENABLE ROW LEVEL SECURITY;
-- No policies: authenticated users cannot read/write; service role bypasses RLS.

INSERT INTO public.whatsapp_studio_inbox_bridge_state (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
```

### Optional follow-up migration (not MVP)

- `bridge_backfill_mode` flag column for one-time historical import with capped `LIMIT`
- Index on `whatsapp_inbound_messages ((raw_payload->>'bridge_source'))` if analytics needed

### Rollback

```sql
DROP TABLE IF EXISTS public.whatsapp_studio_inbox_bridge_state;
```

Inbox rows already ingested remain valid; bridge stop = no new ERP→Studio sync.

---

## Deployment plan

### Phase 0 — Prerequisites (owner)

1. **Schema audit:** Export `whatsapp_messages` columns, inbound filter rule, and ~5 sample inbound rows.
2. **Confirm DB topology:** Same project (`tcxvcatsqqertcnycuop`) vs separate ERP ref.
3. **Create read-only role** (if separate): `GRANT SELECT ON whatsapp_messages TO studio_bridge_reader`.

### Phase 1 — Staging / dry-run

| Step | Command / action |
|------|------------------|
| 1. Merge implementation PR | CI green |
| 2. Apply migration | `supabase db push --project-ref tcxvcatsqqertcnycuop` |
| 3. Set secrets | See table below |
| 4. Deploy **new slug only** | `supabase functions deploy whatsapp-studio-inbox-bridge --project-ref tcxvcatsqqertcnycuop` |
| 5. Dry-run invoke | `{"dry_run": true, "limit": 10}` |
| 6. Validate mapping | Owner reviews dry-run preview JSON |

### Phase 2 — Limited live poll

| Step | Action |
|------|--------|
| 1. Set `BRIDGE_ENABLED=true` | Fail-closed default: `false` |
| 2. Cron schedule | Every 60s → `POST /functions/v1/whatsapp-studio-inbox-bridge` |
| 3. `BRIDGE_BATCH_LIMIT=50` | Cap per run |
| 4. Monitor 24h | `last_run_rows_failed = 0`, inbox UI shows live senders |
| 5. Spot-check idempotency | Re-run manual invoke; duplicates increment, ingested does not |

### Phase 3 — Backfill (optional)

One-time invoke with `{"backfill": true, "cursor_override": "2026-06-01T00:00:00Z", "limit": 500}` during low traffic. Monitor ingest RPC load.

### Secrets

| Secret | Required | Purpose |
|--------|----------|---------|
| `SUPABASE_URL` | Auto | Studio project |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto | Ingest RPC + bridge state |
| `BRIDGE_CRON_SECRET` | Yes | Authenticate cron/manual invoke |
| `BRIDGE_ENABLED` | Yes | `"true"` to poll; absent/false = 503 fail-closed |
| `ERP_SUPABASE_URL` | If cross-project | Read-only ERP endpoint |
| `ERP_SUPABASE_READ_KEY` | If cross-project | Read-only key |
| `ERP_WHATSAPP_MESSAGES_TABLE` | Optional | Default `whatsapp_messages` |

**Do not set** `WHATSAPP_APP_SECRET` or `WHATSAPP_WEBHOOK_VERIFY_TOKEN` on this function — it is not a Meta webhook.

### Deploy commands

```bash
# Migration
supabase db push --project-ref tcxvcatsqqertcnycuop

# Edge (NEW slug — never whatsapp-webhook)
supabase functions deploy whatsapp-studio-inbox-bridge --project-ref tcxvcatsqqertcnycuop

# Secrets
supabase secrets set \
  BRIDGE_CRON_SECRET="<generate>" \
  BRIDGE_ENABLED="false" \
  --project-ref tcxvcatsqqertcnycuop
```

### Cron registration (Supabase Dashboard)

- **Function:** `whatsapp-studio-inbox-bridge`
- **Schedule:** `* * * * *` (every minute) or `*/2 * * * *` (every 2 min)
- **HTTP headers:** `Authorization: Bearer <BRIDGE_CRON_SECRET>`
- **Body:** `{}`

### Verification checklist

| # | Check | Pass criteria |
|---|-------|---------------|
| 1 | Legacy webhook untouched | `whatsapp-webhook` v99 revision unchanged |
| 2 | Meta callback unchanged | ERP URL still registered in Meta dashboard |
| 3 | Bridge deployed | New slug ACTIVE |
| 4 | `BRIDGE_ENABLED=false` default | Invoke returns 503 / disabled message |
| 5 | Dry-run | No inbox rows created |
| 6 | Live poll | New ERP inbound → inbox row &lt; 2 min latency |
| 7 | Realtime | Operator Inbox updates without refresh |
| 8 | Idempotency | Duplicate ERP id → one inbox row |
| 9 | Governance | No `orders` / stock mutations from bridge path |
| 10 | ERP read-only | DB audit shows SELECT only from bridge role |

### Rollback procedure

1. Disable cron job.
2. `supabase secrets set BRIDGE_ENABLED=false`.
3. Bridge stops; inbox retains already-ingested rows.
4. Legacy ERP pipeline unaffected.

---

## Relationship to existing artifacts

| Artifact | Role after Phase 2G |
|----------|---------------------|
| `whatsapp-webhook` v99 (prod) | Unchanged ERP handler |
| `whatsapp-studio-inbox-webhook` v1 | Optional direct Meta path; not required when bridge is live |
| `ingest_whatsapp_inbound_message` | Shared write surface for webhook + bridge |
| `processWebhookPayload` | Webhook adapter; bridge mirrors via `processErpInboundRow` |
| Operator Inbox UI | Unchanged; consumes `whatsapp_inbound_messages` |

## Open questions for owner (block implementation until answered)

1. Exact `whatsapp_messages` schema and inbound filter column?
2. Same Supabase project as Studio or separate ERP ref?
3. Preferred poll interval and backfill window?
4. Should non-text ERP messages (image caption-only, location) be bridged or skipped?

---

## GO / NO-GO for implementation PR

| Gate | Status |
|------|--------|
| Architecture bounded | **GO** |
| No `whatsapp-webhook` touch | **GO** |
| ERP schema confirmed | **PENDING OWNER** |
| Read-only ERP credentials | **PENDING OPS** |
| Migration reviewed | **GO** (Studio-only singleton table) |

**Recommendation:** Merge this plan, then open implementation PR after ERP schema audit is attached to `docs/phase-2g/ERP_WHATSAPP_MESSAGES_SCHEMA.md`.
