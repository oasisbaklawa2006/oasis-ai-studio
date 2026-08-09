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

## Finding 2 — Pricing / MOQ: AI Studio could self-approve, bypassing Central (RESOLVED)

**Area:** Phase 0 (hard boundary) / Phase 5 (cross-repo duplication) / Phase 7 / Phase 15 (implementation)

**Corrected evidence** (the initial pass under-read the code; this supersedes the original
Finding 2 text): `ChannelPricingRules.tsx` / `ChannelMoqRules.tsx` actually ran **two** write
paths gated by role:
- A `"draft"` path (catalogue contributors) that already routed through
  `submitCatalogueDraft` → `catalogue_pricing_drafts` / `catalogue_moq_drafts` → AI Studio's own
  `ApprovalInbox.tsx`, which called real, governed, `SECURITY DEFINER` Core RPCs
  (`approve_catalogue_pricing_draft`, `approve_catalogue_moq_draft`, revoked from `public`/`anon`
  in `oasis-supabase-core/supabase/migrations/20260727122338_harden_privileged_rpc_execution.sql`).
  This part was never a raw-table bypass.
- A `"direct"` path (roles `owner`/`admin`/`product_manager`, or `canWriteMasterDirectly()`) that
  wrote straight to `product_pricing_rules` / `product_moq_rules` via `supabase.from(...).update/
  insert/delete/upsert`, including **self-approve** (`approve()`/`archive()` in
  `ChannelPricingRules.tsx` set `approval_status: "approved"` directly, no Core RPC, no Central
  involvement at all). This is the actual boundary violation: AI Studio could act as final
  commercial authority for pricing/MOQ, contradicting Section 0 ("Central owns pricing operations
  where commercially governed" / "MOQ/carton operational rules"). `seedChannelAuthority.ts`
  (`seedMoqRowForChannel`) had the same direct-upsert pattern, used from 3 more panels.
- `oasis-baklawa-central` already had a **generic, extensible governed catalogue-approval module**
  (`src/lib/catalogue-approval/*` + `src/pages/admin/ApprovalInbox.tsx`) supporting `tag`/`alias`
  drafts against the exact same Core RPC pattern — it just hadn't been extended to `pricing`/`moq`
  yet, even though the Core RPCs for them already existed and were already revoked from
  `public`/`anon`. This was the correct, minimal extension point (reuse, not reinvention).

**Owner decision received:** pricing/MOQ/commercial channel-rule operational authority belongs to
Central + Core. AI Studio may calculate/recommend/draft, but must never be final authority and
must never write the authoritative tables directly.

**Implemented this session:**
- `oasis-ai-studio`: removed the `"direct"` write mode entirely from `ChannelPricingRules.tsx` and
  `ChannelMoqRules.tsx` (type is now `"draft" | "readonly"` only, for every role) — deleted
  `persistPatch`, `approve`, `archive`, and all direct `insert`/`update`/`delete`/`upsert` calls.
  All roles now always propose via the existing catalogue-draft path. `seedChannelAuthority.ts`
  (`seedMoqRowForChannel`) now submits a governed MOQ draft instead of upserting
  `product_moq_rules` directly, fixing the same class of bypass for its 3 call sites (the pricing
  seed button, `PreviewCalculatorPanel.tsx`, `ChannelRulesPanel.tsx`). AI Studio's
  `ApprovalInbox.tsx` no longer exposes Approve/Reject for `pricing`/`moq` drafts (shown read-only
  with an "awaiting Central approval" note) — those two draft types are now Central-only actions.
- `oasis-baklawa-central`: extended the existing `catalogue-approval` module and admin
  `ApprovalInbox.tsx` with `pricing`/`moq` kinds, reusing the same Core RPCs AI Studio's own
  approval inbox used to call (`approve_catalogue_pricing_draft`, `reject_catalogue_pricing_draft`,
  `approve_catalogue_moq_draft`, `reject_catalogue_moq_draft`) — zero new Core migration required,
  the governed RPC layer already existed and was already locked down server-side. Added
  `catalogue_pricing_drafts`/`catalogue_moq_drafts` table types and the 4 RPC signatures to
  Central's generated `types.ts` (hand-added from the Core migration's `CREATE TABLE`/`REVOKE`
  statements; a real `generate_typescript_types` regen against the live project should replace
  this by hand-edit at the next opportunity — flagged as residual, not a correctness risk since
  the shapes were verified column-for-column against Core's schema).
- `oasis-supabase-core`: added migration `20260809200000_lockdown_pricing_moq_direct_writes.sql`
  — revokes `INSERT`/`UPDATE`/`DELETE` on `product_pricing_rules`/`product_moq_rules` from
  `anon`/`authenticated` (both previously had them via a leftover blanket `GRANT ALL`, predating
  the catalogue-draft governance layer). `SELECT` for `authenticated` is untouched (the live
  customer-checkout RPC `customer_order_draft_v1` reads `product_pricing_rules`), `service_role`
  keeps full access, and the governed approval RPCs are unaffected since they run with elevated
  definer privileges independent of caller grants. This closes the app-layer fix's server-side gap
  so the restriction is enforced by Core itself, not only by AI Studio's UI no longer calling it.
  PR: `oasis-supabase-core#60`.

**Verification — all confirmed green by real CI, not just local checks:**
`oasis-ai-studio` PR #118 — typecheck, Reviewdog ESLint, Biome, `check:boundaries`, CodeQL, Trivy,
Semgrep all pass (16/16 checks). `oasis-baklawa-central` PR #344 — typecheck, lint,
`check:boundaries`, 19/19 catalogue-approval tests (6 new) all pass. `oasis-supabase-core` PR #60 —
`check-migration-governance.sh`, `check-canonical-authority.sh`, and (critically) the real
clean-replay + pgTAP job (`migration-ci.yml`) all pass — this job spins up a genuine local Postgres,
replays every migration from zero including the new one, and runs the new pgTAP contract test
against it. The first version of the migration only revoked INSERT/UPDATE/DELETE; the real pgTAP
run caught that the original grant also included TRUNCATE/REFERENCES/TRIGGER, which a static
read-through missed — fixed by revoking ALL and re-granting SELECT explicitly, then reverified
green. **Finding 2 status: technically closed, all three PRs green, pending normal human review and
merge** (not merged by this session — no PR was merged autonomously).

**Residual / not yet done (tracked, not silently dropped):**
- Central's hand-added `types.ts` entries should be replaced by a real generated-types regen
  against the live schema at the next safe opportunity.
- No component-level UI test exists for `ApprovalInbox.tsx` in either repo (pre-existing gap, not
  introduced by this change) — logic-level coverage was added instead where the module already had
  a test harness.

## Finding 3 — Central independently generates SKUs, duplicating AI Studio's Product Master authority

**Area:** Phase 3 (Product Master audit) / Phase 0 (hard boundary) / Phase 7 (Central duplication)

**Evidence:**
- `oasis-baklawa-central/src/pages/admin/AdminProducts.tsx` is a full, independent product
  create/edit editor (2297 lines) performing **direct** `supabase.from("products").insert([payload])`
  / `.update(payload)` — no draft submission, no Core RPC, no AI Studio involvement at all. It
  edits identity, name, category, description, HSN, GST, pricing, BOM, tags, media — effectively
  the entire Product Master surface the hard architecture boundary assigns to AI Studio ("Product
  Master authoring", "product descriptions", "categorisation/taxonomy", editorial fields).
- It also **auto-generates its own SKU** client-side on create: `` `OAS-${prefix}-${net_weight_grams}` ``
  (`prefix` = first 3 letters of the product name), editable before save, checked only for
  uniqueness against Central's own product list. This is completely independent of AI Studio's
  governed SKU system (`generate_oasis_sku` Core RPC, `isStructuredOasisSku`/`isDraftSku` guards in
  `skuGuard.ts` that block `ApprovalInbox.tsx` from approving a product with a non-structured or
  `DRAFT-*` SKU). Two uncoordinated SKU-minting schemes exist for the same `products.sku` column,
  format drift and collision risk that only Central's own uniqueness check partially bounds.
- AI Studio's own product-creation path (`saveFastCreateProduct.ts`, `catalogue_product_drafts` →
  `approve_catalogue_product_draft`) is the governed one and already blocks unstructured/draft SKUs
  at approval time — but that governance is entirely bypassable by simply using Central's editor
  instead, since Central writes `products` directly with no cross-check against AI Studio's
  authority at all.

**Disposition — requires an owner decision (flagged, not unilaterally resolved):**
This is a larger, higher-risk version of the same pattern as Finding 2, but the correct fix is not
inferable safely: `AdminProducts.tsx` is a mature, 2297-line, apparently-live operational tool
(BOM, variants, tags, pricing all wired through it) that Central staff may depend on today for
real work, including for product classes AI Studio may not fully support yet (e.g.
`third_party_goods_store` / packaging materials referenced elsewhere in Central). Migrating
product CREATE/UPDATE authority out of Central without confirming (a) whether AI Studio's
governed product-creation path is actually adopted and complete enough to be the sole replacement,
and (b) what happens to Central's BOM/variant/tag workflows that are wired directly to
`AdminProducts.tsx`'s local state, is a genuine "would this break real operational work with
nothing to replace it" question — the same class of decision the mandate reserves for the owner
(Phase 15). No code changed for this finding. Recorded here rather than attempted blind, per the
instruction to defer only genuinely non-inferable business-authority decisions while continuing
everything else.

**What would need answering to close this:** should `AdminProducts.tsx` become read-only /
link-out to AI Studio for identity+editorial fields (consuming AI Studio's published Product
Master) while keeping true operational fields (availability, operational merchandising) editable
in Central per the target architecture — and if so, is AI Studio's product-creation path currently
complete enough to be that source of truth for every product class Central creates today?

## Verified-safe facts established (no rebuild needed)

- No direct client-side bypass of Core authority found in the Operator Inbox path — it is RPC-only.
- `AI Studio` repository governance docs (`BACKEND_OWNERSHIP.md`, `README.md`) already assert and
  enforce: no Supabase migrations/functions deployed from this repo, Central Supabase is canonical,
  no Lovable Cloud runtime.

## Next steps in this programme (in order, per owner mandate)

1. Central Product Master duplication (Finding 3) — blocked on the owner decision recorded above.
2. Full AI Studio route/capability inventory with reachability + persistence tracing (Phase 2) —
   in progress; first pass found and fixed two broken relative imports in the Operator Inbox
   (`bridge/fixtures/sampleErpWhatsAppRows.ts`, `components/DraftVisibilityPanel.tsx`) that
   `knip`/`tsc` flagged as unresolved modules on a route that is actually wired and reachable.
3. AI engine capability audit — provider, validation, human-approval gating (Phase 4).
4. Core DB/RPC/RLS authority audit for AI Studio's remaining Supabase mutations (Phase 8).
5. WhatsApp Operator Inbox disposition (Finding 1) — still blocked on the owner decision recorded
   above (retire vs. wire into Central's `sales_order_drafts` pipeline).
6. Publishing state machine verification (Phase 9), asset pipeline (Phase 10), security (Phase 12).
7. Testing/CI execution and gap-filling (Phase 13), then remaining implementation PRs (Phase 16).
8. Regenerate Central's `types.ts` from the live schema to replace the hand-added pricing/moq
   draft-table and RPC type entries added in Finding 2.

## Findings status summary

| # | Finding | Status |
| --- | --- | --- |
| 1 | Operator Inbox / `whatsapp_sales_order_drafts` dormant dead-end | Owner decision requested, not yet resolved |
| 2 | Pricing/MOQ self-approval bypass (AI Studio "direct" mode) | **Resolved this session** — see above (3 PRs green, pending merge) |
| 3 | Central (`AdminProducts.tsx`) independently generates SKUs, duplicates AI Studio's Product Master authority | Owner decision requested, not yet resolved |

## Safety

- No production data mutation performed.
- No Supabase migration or Edge Function deployed from this session.
- No service-role credential use.
- No destructive git operations performed.
