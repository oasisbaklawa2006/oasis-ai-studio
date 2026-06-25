# Phase 2G — Implementation Report

**Date:** 2026-06-25  
**Branch:** `cursor/whatsapp-studio-inbox-bridge-f0bc`  
**Supabase project:** `tcxvcatsqqertcnycuop`

## Summary

Implemented Studio-owned ERP→inbox bridge per approved plan (PR #61). The bridge polls `whatsapp_messages` (read-only), maps rows using the live schema audit, resolves at edge, and ingests via existing `ingest_whatsapp_inbound_message` RPC.

## Artifacts added

| Artifact | Path |
|----------|------|
| Edge function (new slug) | `supabase/functions/whatsapp-studio-inbox-bridge/index.ts` |
| Shared bridge mapping | `supabase/functions/_shared/erpInboxBridge/*` |
| Vitest adapters | `src/features/operatorInbox/bridge/*` |
| Tests | `src/features/operatorInbox/phase2gErpInboxBridge.test.ts` |
| Migration | `supabase/migrations/20260625140000_whatsapp_studio_inbox_bridge_state.sql` |
| Schema audit | `docs/phase-2g/ERP_WHATSAPP_MESSAGES_SCHEMA.md` |

## Not changed

- `supabase/functions/whatsapp-webhook/**` — untouched
- Meta callback URLs — no changes
- ERP write surfaces — bridge SELECT-only on `whatsapp_messages`

## Confirmed live mapping

| ERP | Studio |
|-----|--------|
| `whatsapp_contacts.phone_number` | `_sender_phone` (+ prefix) |
| `whatsapp_contacts.customer_name` | `_sender_name` |
| `content` | `_message_body` |
| `provider_message_id` | `_provider_message_id` |
| `message_timestamp` | `_received_at` |
| `direction = 'inbound'` | inbound-only filter |

## Ops follow-up (post-merge)

1. Apply migration on `tcxvcatsqqertcnycuop`
2. Deploy **new slug only:** `whatsapp-studio-inbox-bridge`
3. Set secrets: `BRIDGE_CRON_SECRET`, `BRIDGE_ENABLED=false` (fail-closed default)
4. Dry-run: `POST {"dry_run": true, "limit": 5}`
5. Enable `BRIDGE_ENABLED=true` + cron when owner approves

## Tests

`npm run test` — includes `phase2gErpInboxBridge.test.ts` (mapping, ingest, idempotency, governance).
