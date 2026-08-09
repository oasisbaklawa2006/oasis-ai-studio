# Point 27 — AI Studio Execution & Reconciliation Programme (Checkpoint)

## Programme status

- Point: 27
- Title: Forensic reconciliation, architecture closure and production completion
- Status: IN PROGRESS (execution programme, not audit-only — see owner mandate below)
- Predecessor: Point 26 (delta stability verification, merged PR #116)
- This document is a live checkpoint. Update it in place as work proceeds so continuation is
  deterministic across sessions.

## Owner mandate (verbatim intent)

Point 27 is the execution and reconciliation programme, not another audit-only checkpoint.
Resolve known highest-risk overlaps first (Sales Order/WhatsApp draft authority vs Central/Core,
Operator Inbox ownership, Product Master/editorial duplication vs Central, DB/RPC authority vs
Core), trim before building, preserve useful AI extraction/intelligence by feeding it into the
canonical Central/Core workflow rather than maintaining competing operational authority, then
proceed through the remaining phases of the original mandate. Implement every unambiguous fix
autonomously; only stop for genuine business-policy decisions that cannot be safely derived from
established App-Verse contracts. Do not touch production.

## Immutable starting baseline (verified this session)

| Repo | Branch | HEAD SHA | Dirty tree | Open PRs at start |
| --- | --- | --- | --- | --- |
| oasis-ai-studio | main | `570dbb11d3dbabeb587d50578cf8036d2b2f275f` | clean | not yet enumerated via API (shallow clone; verify via GitHub before merge) |
| oasis-baklawa-central | main | `dcdd6ca8836c40aa78de301781f4c758b536ede9` | clean | not yet enumerated |
| oasis-supabase-core | main | `6f7e59874f3a40f52de96c6ad02fee5fd26f5050` | clean | not yet enumerated |

Clones are shallow (`--depth 1`); only current `main` tip was inspected, not full history.

## Finding 1 — WhatsApp Operator Inbox / `whatsapp_sales_order_drafts` (AI Studio)

**Area:** Phase 6 (Sales-Order authority) / Phase 5 (cross-repo duplication)

**Evidence:**
- AI Studio owns `src/features/operatorInbox/*` (route `/operator-inbox` registered in `App.tsx`),
  calling Core RPC `create_whatsapp_sales_order_draft_from_operator` (governed, `SECURITY DEFINER`,
  defined in `oasis-supabase-core` migrations, not defined inside AI Studio — no bypass of Core
  authority).
- This RPC writes to Core table `public.whatsapp_sales_order_drafts`, whose own DB comment reads:
  *"Phase 2E reviewable WhatsApp sales order drafts from operator confirm. **Not a final sales
  order.**"*
- Central independently owns a materially different, more complete governed pipeline:
  `src/lib/wa-sales-order-draft/*` → Core RPCs `create_sales_order_draft_atomic`,
  `submit_sales_order_draft_for_review_atomic`, `approve_sales_order_draft_for_so_atomic`,
  `reject_sales_order_draft_atomic` → Core table `public.sales_order_drafts` (packet-based,
  extraction-versioned, actor-audited, feeds real Sales Orders).
- These are **two distinct tables with two distinct schemas** in Core, not one duplicated table —
  Core did not collapse them. Nothing in Central or Core promotes a confirmed
  `whatsapp_sales_order_drafts` row into Central's `sales_order_drafts` pipeline. AI Studio's
  operator confirmations are a dead end: real, persisted, audited — but never become a Sales Order.
- The upstream feed (`whatsapp-studio-inbox-bridge`, which populates `whatsapp_inbound_messages`
  that Operator Inbox reads) is explicitly disabled per `BACKEND_OWNERSHIP.md`:
  `BRIDGE_ENABLED=false retained for safety`. So this entire surface is currently dormant with
  live traffic — the finding is architectural, not an active incident.
- The UI is honestly labeled, not fake/mock: `OperatorInboxPanel.tsx` states *"Confirm creates a
  reviewable sales order draft only — no final order, stock, finance, or outbound replies."*
  Classification is **PARTIAL / BACKEND-BLOCKED (dormant)**, not MOCK or BROKEN.
- Separately, Central's own legacy `supabase/functions/whatsapp-webhook/index.ts` writes directly
  to `orders`/`order_items` — a third, older, pre-governance WhatsApp order path. This is inside
  Central's own remit, already flagged as frozen legacy in AI Studio's `BACKEND_OWNERSHIP.md`
  ("legacy whatsapp-webhook untouched"), and is **out of AI Studio's ownership scope** — noted here
  for the cross-repo matrix but not actioned by AI Studio.

**Disposition — requires an owner decision (flagged, not unilaterally resolved):**
This is a genuine product-authority question, not something safely inferable from code: does the
business still want AI Studio's WhatsApp-utterance→SKU resolution step (Operator Inbox) as a feed
into Central's governed Sales Order Draft pipeline (CONSUME CORE CONTRACT — wire a promotion path
from `whatsapp_sales_order_drafts` into `sales_order_drafts`), or has Central's newer
extraction/readiness pipeline fully superseded it (RETIRE — remove the route and the now-redundant
Core table/RPC pair)? The code today does exactly and only what it honestly claims; nothing
unsafe or fake is currently deployed. **No autonomous deletion or rewiring performed pending this
call** — recorded as the first genuine owner decision under the mandate's own exception clause.

## Finding 2 — Pricing / MOQ rule editing is owned solely by AI Studio (should be Central)

**Area:** Phase 0 (hard boundary violation) / Phase 5 (cross-repo duplication) / Phase 7

**Evidence:**
- `src/components/ChannelPricingRules.tsx` and `src/components/ChannelMoqRules.tsx` (both mounted
  live on `src/pages/ProductEdit.tsx`, a reachable authenticated route) perform **direct,
  ungoverned client-side** `insert` / `update` / `delete` / `upsert` calls against
  `product_pricing_rules` and `product_moq_rules` — no RPC, no server-side governance layer.
- Per the hard architectural boundary (Section 0 of the owner mandate), "pricing operations where
  commercially governed" and "MOQ/carton operational rules" are explicitly **Central's** domain.
  AI Studio "must not create a second independent operational authority" for them.
- `oasis-baklawa-central` has **zero** references to `product_pricing_rules` or
  `product_moq_rules` anywhere in `src/` — Central does not currently own or even read this data.
  AI Studio is not duplicating Central's authority here; it is the **sole and only** owner of a
  domain the target architecture assigns to Central (classification: **WRONG REPOSITORY**, not
  duplicated authority).

**Disposition — requires an owner decision (flagged, not unilaterally resolved):**
This is live, reachable, direct-write commercial pricing/MOQ functionality. Moving it is a
high-blast-radius, cross-repo change to real commercial rule authority with no visible Central
equivalent to migrate into — before touching it I need to know: (a) is AI Studio currently the
business's only working tool for setting channel pricing/MOQ today (i.e. would disabling it stop
real operational work with nothing to replace it), and (b) should the destination be a new
Central admin surface consuming the same `product_pricing_rules`/`product_moq_rules` tables, or
should these tables move under Core-governed RPCs first (matching the sales-order-draft pattern)
before Central gets write access? Executing a cross-repo authority transfer for live pricing rules
without that answer risks breaking active commercial operations — exactly the "pricing authority"
class of decision the mandate itself reserves for the owner (Phase 15: "Do not invent... pricing
authority... where no approved contract exists"). No deletion, move, or disabling performed.

## Verified-safe facts established (no rebuild needed)

- No direct client-side bypass of Core authority found in the Operator Inbox path — it is RPC-only.
- `AI Studio` repository governance docs (`BACKEND_OWNERSHIP.md`, `README.md`) already assert and
  enforce: no Supabase migrations/functions deployed from this repo, Central Supabase is canonical,
  no Lovable Cloud runtime.

## Next steps in this programme (in order, per owner mandate)

1. Product Master field-by-field audit + duplication check vs Central AdminProducts (Phase 3 / 7).
2. Full AI Studio route/capability inventory with reachability + persistence tracing (Phase 2).
3. AI engine capability audit — provider, validation, human-approval gating (Phase 4).
4. Core DB/RPC/RLS authority audit for AI Studio's remaining Supabase mutations (Phase 8).
5. Publishing state machine verification (Phase 9), asset pipeline (Phase 10), security (Phase 12).
6. Testing/CI execution and gap-filling (Phase 13), then implementation PRs (Phase 15/16).

## Safety

- No production data mutation performed.
- No Supabase migration or Edge Function deployed from this session.
- No service-role credential use.
- No destructive git operations performed.
