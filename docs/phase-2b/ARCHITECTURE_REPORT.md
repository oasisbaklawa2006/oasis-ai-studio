# Phase 2B — Architecture Report

## Investigation summary

**Finding:** There is no live WhatsApp Operator Inbox in this repository today. Inbound WhatsApp webhooks, conversation persistence, and operator chat UI are not implemented. The closest existing surfaces are:

| Surface | Path | Role |
|---------|------|------|
| Phase 2A Resolver Preview | `/admin/resolver-preview` | Sandbox for utterance → product resolution |
| Approval Inbox | `/approvals` | Alias draft governance (not customer chat) |
| Blueprint doc | `docs/PRODUCT_INTELLIGENCE_TO_WHATSAPP_BLUEPRINT.md` | Planned future architecture only |

**Decision:** Phase 2B is delivered as a **preview operator inbox** at `/admin/operator-inbox` using simulated inbound WhatsApp messages and the frozen Phase 2A runtime resolver. This establishes the message-rendering + suggestion-card pattern without modifying catalogue architecture or order flows.

## Message rendering flow

```
InboundWhatsAppMessage (fixture or future webhook payload)
        │
        ▼
InboundMessageBubble          ← customer label, timestamp, message body
        │
        ▼
resolveInboundMessage()       ← wraps loadRuntimeCatalog + resolveProductUtterance
        │
        ▼
ProductSuggestionCard         ← product name, SKU, band, action, reason, alternatives
        │
        ▼
Operator actions              ← confirm / reject / select alternative
        │
        ▼
suggestionAudit (localStorage) ← lightweight audit only; no orders
```

## Module layout

```
src/features/operatorInbox/
  types.ts                    — message, operator state, audit types
  resolveInboundMessage.ts    — thin wrapper over Phase 2A resolver
  suggestionGovernance.ts     — HIGH/MEDIUM/LOW display rules
  operatorSuggestionState.ts  — confirm / reject / selectAlternative
  suggestionAudit.ts          — localStorage audit log
  fixtures/sampleMessages.ts  — preview inbound messages
  components/InboundMessageBubble.tsx
  OperatorInboxPanel.tsx      — per-message resolver + card
  phase2bOperatorInbox.test.ts

src/features/productIntelligence/components/
  ProductSuggestionCard.tsx   — shared suggestion card UI

src/pages/OperatorInbox.tsx   — page wrapper
```

## Governance rules (enforced)

| Band | Display action | Primary suggestion | Preselect | Auto-confirm |
|------|----------------|-------------------|-----------|--------------|
| HIGH | Suggested | Yes | Yes (SKU) | **Never** — operator must Confirm |
| MEDIUM | Review | Yes | No | Never |
| LOW | Ask clarification | No | No | Never |

## Explicit non-goals (Phase 2B)

- No Sales Order creation
- No inventory reservation or stock updates
- No automatic WhatsApp replies
- No catalogue schema or resolver logic changes

## Future integration point

When a real WhatsApp inbox exists, replace `SAMPLE_INBOUND_MESSAGES` with live message feed and mount `ProductSuggestionCard` beneath each inbound customer bubble using the same `resolveInboundMessage` + `operatorSuggestionState` + `suggestionAudit` stack.
