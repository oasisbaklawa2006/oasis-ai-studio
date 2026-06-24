# Phase 2D/2E — Architecture Report

## Investigation summary

| Area | Finding |
|------|---------|
| Legacy `sales_order_drafts` | Exists in DB — **not used** by Phase 2D/2E |
| `catalogue_*_drafts` | PIM governance only — **unsafe to reuse** for WhatsApp orders |
| `draft_orders` (blueprint) | Planned in `PRODUCT_INTELLIGENCE_TO_WHATSAPP_BLUEPRINT.md` — not migrated |
| Phase 2C ingest | **Complete** — `whatsapp_inbound_messages` + `ingest_whatsapp_inbound_message` |
| Edge functions | `test-integration`, `generate-product-attributes` only — **no webhook** |
| Operator confirm | localStorage audit only — **no draft creation** |

## Architecture decision

**New minimal `whatsapp_sales_order_drafts` table** (Studio Supabase) — does not alter legacy `sales_order_drafts`, catalogue drafts, or touch `sales_orders` / inventory / finance.

**Webhook:** Internal adapter (`processWebhookPayload`) is the canonical ingest path with Phase 2A resolver. Edge function skeleton stores via service-role RPC; full resolver in edge deferred (documented).

## Flow

```
Webhook payload (meta_whatsapp | test)
        │
        ▼
normalizeWebhookPayload + validate
        │
        ▼
ingestInboundMessage() → Phase 2A resolve → ingest_whatsapp_inbound_message RPC
        │
        ▼
Operator Inbox (live feed)
        │
        ▼
Operator Confirm (governance check)
        │
        ▼
create_whatsapp_sales_order_draft_from_operator RPC → whatsapp_sales_order_drafts (UNDER_REVIEW / AI_DRAFT)
        │
        ▼
whatsapp_operator_decisions audit row
```

## Governance

| Band | Preselect | Draft on Confirm |
|------|-----------|------------------|
| HIGH | Yes | Yes (operator must confirm) |
| MEDIUM | No | Yes (operator review + confirm) |
| LOW | No | **No** unless operator selected alternative |

## Exclusions (preserved)

- No final Sales Order
- No stock reservation / deduction
- No invoice / finance
- No outbound WhatsApp reply
- No dispatch / ERP
- No catalogue / Product Truth changes

## Next boundary (Phase 2F+)

- Meta signature verification in production edge
- Shared resolver bundle in Deno edge
- Draft review UI / promote to confirmed order
- Quantity parsing from utterance
