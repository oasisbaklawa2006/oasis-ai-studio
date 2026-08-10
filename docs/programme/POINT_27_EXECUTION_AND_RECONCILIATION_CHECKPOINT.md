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

**Disposition — re-evaluated and conceptually resolved against the canonical ownership model
(Central + Core own operational/commercial authority; AI Studio owns intelligence, extraction,
recommendation and editorial assistance):**

Under that model this is no longer a live "which pipeline should we build" question. Central's
`sales_order_drafts` pipeline (packet-based, extraction-versioned, actor-audited, feeds real Sales
Orders) is the canonical, more complete operational-authority implementation of exactly what
Operator Inbox does — it is not a peer to be merged with, it is the thing Operator Inbox would be
competing operational authority against if it were live. Two conclusions follow directly from the
model, with no further business input needed:
1. **No promotion path should be built** from `whatsapp_sales_order_drafts` into
   `sales_order_drafts`. Wiring one would mean AI Studio minting reviewable sales-order state in
   parallel with Central's own pipeline for the same real-world event — exactly the "competing
   operational authority" pattern the model says to retire, not extend.
2. **The upstream bridge (`BRIDGE_ENABLED=false`) must stay disabled by this session** — it was
   turned off "for safety" by a prior deliberate decision, and re-enabling a live WhatsApp
   order-intake feed is an operational-safety action, not a code-architecture inference; nothing
   here overrides that.

**What is still a genuine scale/reversibility call, not an authority question, and is left for the
owner:** whether to now delete the ~35-file Operator Inbox feature outright, or leave it in place,
dormant and clearly marked superseded, in case the WhatsApp-utterance→SKU *resolution logic itself*
(the intelligence/extraction layer, as distinct from the operational draft table it currently
writes to) is worth salvaging into a future Central-facing contract. This is real, working,
honestly-labeled, previously-deliberately-preserved (not deleted) engineering investment — a
same-session unilateral deletion of it is the kind of hard-to-walk-back scale decision the mandate
still reserves for a human, even though the architecture question it used to be entangled with is
now settled. No code deleted this session; see the module-level disposition note added instead.

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

**Recurrence found and fixed (Phase 8 follow-up, same session):** a second, independent instance of
the exact same self-approval bypass was found in `src/features/productAuthority/
syncChannelPricingFromForm.ts`, used by `ProductEdit.tsx` (not `ChannelPricingRules.tsx` — a
separate legacy compliance-tab pricing path), missed by the original sweep because it lives outside
the two components already audited. `syncChannelPricingFromForm()` upserted `product_pricing_rules`
directly with `approval_status: "approved"` on every product save by a "direct" writer, and a
companion `repairDirectMasterPricingRows()` silently force-approved any pricing rows still stuck in
`draft` status just from opening the product edit page (`loadChannelAuthority`) — no user action,
no Central involvement, on every page load for a privileged role. Both are now removed:
`syncChannelPricingFromForm` submits a governed `pricing` catalogue draft per channel (create or
update against the existing row, looked up via a `SELECT` — still permitted under the Core RLS
lockdown) instead of writing the table directly; `repairDirectMasterPricingRows` and its
`loadChannelAuthority` call site were deleted outright (there is no governed version of "silently
auto-approve stuck drafts"). This was likely already broken by the Core RLS lockdown migration
(`anon`/`authenticated` now have `SELECT`-only on `product_pricing_rules`), so this fix also restores
correct save behavior, not only governance. Covered by a new regression test
(`syncChannelPricingFromForm.test.ts`) asserting no direct table write and no
`approval_status: "approved"` literal. This is a strong signal Phase 8's broader "audit every
remaining Supabase mutation" pass should continue rather than being considered complete from the
first two components alone. A full-repo grep for direct `product_pricing_rules`/`product_moq_rules`
writes now returns zero matches. (Minor, non-blocking, found in the same pass: `draftTableMap.ts`'s
`pricing`/`moq` entries carry `targetTable: "pricing_slabs"` / `"moq_rules"` — display-metadata
labels that don't match the real target tables `product_pricing_rules` / `product_moq_rules`; this
doesn't affect approval correctness since Core's RPCs operate on the draft payload, not this label,
but is worth a follow-up rename for clarity.)

## Finding 3 — Central independently generates SKUs and AI-generated allergen data, duplicating AI Studio's Product Master authority

**Area:** Phase 3 (Product Master audit) / Phase 0 (hard boundary) / Phase 7 (Central duplication) / Phase 4 (AI engine — ungoverned AI write path)

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
- **Elevated-severity addition (Phase 3/4 cross-check, this session):** Central has its own AI
  compliance-attribute generator, `handleAiFullGenerate()` in `AdminProducts.tsx`, calling a
  *different* Edge Function (`generate-product-attributes`, not AI Studio's governed
  `catalogue-ai-copy`) that returns **allergen_warnings, ingredients, hsn_code, gst_percentage**
  directly into form state. The only safeguard before this AI output reaches the live `products`
  row is a client-side toast ("review before save") — no `human_review_required` contract check, no
  draft/status state machine, no server-side reviewer gate. Contrast with AI Studio's equivalent
  path (Phase 4 finding above): schema-validated response, mandatory `human_review_required: true`
  from the server, and compliance data is captured into a `catalogue_product_drafts` payload
  requiring `is_catalogue_reviewer()` approval before it reaches `products.allergen_warnings` /
  `products.ingredients`. **Central's path lets AI-generated allergen/ingredient data — a genuine
  food-safety/labeling concern — reach production with no server-side governance at all.** This is
  a materially more urgent instance of the same duplicate-authority root cause and should weigh
  heavily in the owner's disposition of this finding.

**Partial fix applied this session (safe, bounded, independent of the authority question below):**
`Oasis-Baklawa-Central` — added an `aiComplianceUnreviewed` gate: `handleSaveProduct()` now refuses
to save while AI-generated allergen/ingredient/HSN/GST data is unacknowledged; the operator must
either edit the affected field(s) or click an explicit "Mark as reviewed" control before saving.
This blocks unacknowledged AI output specifically in the Central UI path handled by
`AdminProducts.tsx`'s `handleSaveProduct()` — it is a client-side gate, not server-side/database
governance, so it does not close the gap globally: `products` still has no RPC or RLS layer that
enforces a reviewed state before allergen/ingredient/HSN/GST data lands, meaning any other permitted
client or a direct authenticated write against `products` bypasses it entirely. It reduces risk for
the one UI Central staff actually use for this today, without touching who owns product editing —
so it didn't need to wait on the larger disposition below — but should not be read as closing the
underlying food-safety governance gap. Verified: typecheck clean, 4/4 relevant tests pass (2 new),
check:boundaries pass. Committed to the same branch as Finding 2's Central fix (PR #344).

**Disposition — re-evaluated and conceptually resolved against the canonical ownership model
(Central + Core own operational/commercial authority; AI Studio owns intelligence, extraction,
recommendation and editorial assistance):**

The original framing of this finding ("wrong repo owns Product Master authority, should Central
defer to AI Studio") does not survive that model. Central + Core own operational/commercial
authority, which includes product CREATE/UPDATE for the products Central's own staff manage —
`AdminProducts.tsx` writing directly to `products` is Central exercising authority it legitimately
holds, not a boundary violation, and no read-only/link-out migration is warranted or being pursued.
**No code migration performed for authority itself — none is required.**

What the evidence in this finding actually identifies, independent of the authority question, are
two governance-quality gaps in how Central exercises that authority, both already addressed or
now scoped correctly under the model's "preserve useful AI capability by feeding governed
Central/Core contracts" instruction:
1. **AI-generated compliance data with no server-side review gate** — partially fixed this
   session (`aiComplianceUnreviewed` client-side gate in `handleSaveProduct()`). Full closure
   would mean Central's `generate-product-attributes` Edge Function adopting the same
   `human_review_required` contract AI Studio's governed `catalogue-ai-copy` function already
   uses, with server-side (not just client-side) enforcement — a real schema/Edge-Function change
   with its own rollout risk, not attempted this session; recorded as a follow-up, not re-opened
   as an authority question.
2. **Two independent SKU-minting schemes for the same `products.sku` column** — investigated this
   session for a safe fix (having Central call the same governed `generate_oasis_sku` Core RPC
   AI Studio uses). Rejected as unsafe to do quickly: that RPC requires a structured
   division/category/subcategory/packaging taxonomy input Central's form does not collect, and
   Central's own category taxonomy (`department`/`category`/`sub_category`) does not map 1:1 onto
   it — an incorrect auto-mapping would silently mint malformed SKUs, which is a worse outcome
   than the status quo. Separately, and more urgently: **`products.sku` has no `UNIQUE` constraint
   in the production schema at all** (verified against the canonical baseline migration — only
   `product_variants.sku`, `ols_products_cache.sku`, and `catalogue_product_mappings(source_app,
   sku)` are uniqueness-constrained; the base `products` table is not). Two uncoordinated minting
   schemes writing into an unconstrained column is a real latent data-integrity gap. Not fixed
   this session: adding the constraint requires confirming no duplicate SKUs already exist in
   production, which this session cannot check without production access — a blind
   `ADD CONSTRAINT UNIQUE` migration could fail to apply, or silently be blocked, if such
   duplicates exist. **Recommended next action for someone with production read access:** run
   `SELECT sku, count(*) FROM products GROUP BY sku HAVING count(*) > 1`, resolve any hits, then
   add the unique constraint in a Core migration.

## Phase 2 — AI Studio route inventory (structural pass)

Every route in `src/App.tsx` (29 total, verified by direct read, not assumption). This is the
structural layer (route → component → reachability); full read/mutation/audit/error/empty-state
tracing per route per the original mandate template is not yet done for all 19 "wired" routes and
remains open Phase-2 work — the classifications below are grounded in what this session directly
verified (marked ✓) versus what is inferred from the route being wired to a real, non-placeholder
component and not yet deep-traced (marked •).

| Route | Component | Class | Notes |
| --- | --- | --- | --- |
| `/auth` | `Auth` | • WIRED | not traced this session |
| `/c/:slug` | `CapabilityUnavailable` | DEFERRED | honest fail-closed placeholder |
| `/` | `Dashboard` | • WIRED | not traced |
| `/products` | `Products` | • WIRED | not traced |
| `/products/new/fast` | `FastCreateProduct` | • WIRED | feeds `catalogue_product_drafts`, not traced end-to-end |
| `/products/:id` | `ProductEdit` | ✓ PARTIAL/CONFIRMED | hosts `ChannelPricingRules`/`ChannelMoqRules` (Finding 2, now governed-draft-only, verified this session) |
| `/media` | `Media` | • WIRED | not traced |
| `/tags` | `CapabilityUnavailable` | DEFERRED | honest fail-closed placeholder |
| `/catalogues` | `CapabilityUnavailable` | DEFERRED | honest fail-closed placeholder |
| `/admin/catalogue-builder` | `CapabilityUnavailable` | DEFERRED | placeholder notes "builder implementation retained" — likely intentionally paused, not abandoned |
| `/admin/catalogue-product-studio` | `CatalogueProductStudio` | • WIRED | not traced |
| `/catalogues/:id` | `CapabilityUnavailable` | DEFERRED | honest fail-closed placeholder |
| `/catalogues/:id/proposal` | `CapabilityUnavailable` | DEFERRED | honest fail-closed placeholder |
| `/hampers` | `CapabilityUnavailable` | DEFERRED | honest fail-closed placeholder |
| `/ingredients` | `CapabilityUnavailable` | DEFERRED | honest fail-closed placeholder |
| `/labels` | `CapabilityUnavailable` | DEFERRED | honest fail-closed placeholder |
| `/label-queue` | `CapabilityUnavailable` | DEFERRED | honest fail-closed placeholder |
| `/ai-studio` | `AIStudio` | • WIRED | not traced |
| `/testing` | `Testing` | • WIRED | not traced |
| `/testing/pilot-readiness` | `PilotReadinessDashboard` | • WIRED | not traced |
| `/testing/pilot-aliases` | `PilotAliasReview` | • WIRED | not traced |
| `/settings` | `Settings` | • WIRED | not traced |
| `/audit-log` | `CapabilityUnavailable` | DEFERRED | honest fail-closed placeholder |
| `/approvals` | `ApprovalInbox` | ✓ CONFIRMED | rewritten and verified this session (Finding 2); pricing/moq now read-only, RPC-governed |
| `/data-correction` | `DataCorrection` | • WIRED | not traced |
| `/admin/resolver-preview` | `ResolverPreview` | • WIRED | not traced |
| `/admin/operator-inbox` | `OperatorInbox` | ✓ PARTIAL/BACKEND-BLOCKED | Finding 1 — real, honest, but architecturally dormant (upstream bridge disabled) |
| `/admin/import/category-1` | `Category1ImportStaging` | • WIRED | not traced |
| `*` | `NotFound` | ✓ WIRED | trivial |

**Result: 11 of 29 routes (38%) are honest `CapabilityUnavailable` placeholders — the app already
does fail-closed disabling correctly at the routing layer for incomplete capabilities.** The 12
now-deleted orphaned page files (see commit `e540cf9`) were the dead implementations these
placeholders superseded. 18 routes are wired to real, non-placeholder components. Three of those
18 were directly inspected this session — `/approvals` is confirmed end-to-end, `/products/:id` is
partial (only its pricing/MOQ panels were traced, for Finding 2), and `/admin/operator-inbox` is
partial/backend-blocked (Finding 1) — so "verified end-to-end" only actually applies to one of the
three. The remaining 15 wired routes still need deeper read/mutation/audit/error/empty-state
tracing in a follow-up pass — noted here as the honest state rather than claimed complete.

## Phase 4 — AI engine capability audit (first capability: catalogue copy generation)

**Capability:** `generateCatalogueContentDraft` (`catalogueAiGateway.ts`) — AI-assisted catalogue
copy (title, short/long description, B2B/export/WhatsApp copy, Hindi description, storage/shelf-life
copy) for the Catalogue Product AI Studio.

**Verified — CONFIRMED, well-governed:**
- Calls only a dedicated `catalogue-ai-copy` Edge Function; the gateway explicitly refuses to fall
  back to the legacy general-purpose `oasis-ai-chat` endpoint.
- Feature-flagged off unless `VITE_CATALOGUE_AI_ENABLED === "true"`; requires an authenticated
  session (bearer token) to call.
- Structured-only prompt: explicitly instructs the model never to invent price, ingredients,
  allergens, nutrition, tax/HSN/GST, or compliance claims — those stay human-owned fields this
  studio never lets AI set.
- Response is schema-validated (`validateAiCatalogueContent`) before use — every expected key must
  be a non-empty string or the whole response is rejected with a truthful reason; malformed/partial
  AI output is never displayed as if genuine.
- Server response must explicitly carry `human_review_required: true` or the client rejects it.
- Persistence never touches `products` directly: content lives in `catalogue_ai_studio_drafts` (own
  status state machine `DRAFT → UNDER_REVIEW → APPROVED`) plus a
  `catalogue_ai_studio_draft_audit_log` table, verified by reading `catalogueDraftRepository.ts`
  (whose own header comment states this explicitly).
- Every network/parse/validation failure path returns `{ ok: false, reason }` — the function never
  throws and never leaves the caller displaying corrupted state as real content.

This is the correct pattern per the mandate ("AI-generated content must not silently become
approved product truth") and can serve as the reference implementation when auditing AI Studio's
other AI-assisted capabilities (product intelligence/utterance resolution, media generation) in a
follow-up pass — not yet done this session.

## Phase 3 — Product Master field/authority audit

**Reviewed:** `productSchemaAdapter.ts`, `liveProductsSchema.ts`,
`docs/AI_STUDIO_SCHEMA_WRITE_CONTRACT.md`.

**Verified — CONFIRMED, well-governed:** AI Studio already maintains an explicit field-authority
allowlist contract (`PRODUCTS_INSERT_ALLOWLIST`, `LIVE_PRODUCTS_EXCLUDED_COLUMNS`,
`CENTRAL_COMPAT_PRODUCT_COLUMNS`), documented and kept in sync with the live schema. No undocumented
or silently-expanding write surface found on the AI Studio side of the Product Master. The
Central-side counterpart to this finding is Finding 3 (independent SKU/AI-compliance generation),
still owner-blocked as recorded above; a scoped, non-authority-changing safety fix (an explicit
human-review gate on Central's AI-generated allergen/ingredient/HSN/GST data before save) was
implemented this session in `Oasis-Baklawa-Central/src/pages/admin/AdminProducts.tsx` — see Finding 3.

## Phase 12 — Security spot-check: product media upload path

**Reviewed:** `ProductMediaUploader.tsx`, `mediaDraftBoundary.ts`, and the `product-media` storage
bucket configuration across all three repositories.

**Findings and fixes (this session):**
- `sanitizeMediaFileName` already strips path-traversal/unsafe characters from uploaded file names
  before building storage paths — **no path-traversal issue found.**
- The `product-media` bucket's 50MB size cap and image/video/PDF MIME allowlist were declared only
  in Core's `supabase/seed.sql`, which Supabase applies to local/preview environments, not to the
  already-live production bucket — a real gap between intended and (possibly) actual production
  enforcement, since no migration codified it. **Fixed:** Core migration
  `20260809210000_enforce_product_media_bucket_limits.sql` UPDATEs the bucket row directly (no-op if
  the bucket doesn't exist yet, so it's safe for a from-scratch local reset too), with a pgTAP
  contract test asserting the exact size/MIME configuration.
- Neither `ProductMediaUploader.tsx` (AI Studio) nor Central's admin upload flow did any client-side
  file-type/size validation before upload — relied entirely on server-side enforcement, so a bad
  file only failed after the upload attempt. **Fixed (AI Studio):** added `validateMediaFile()` in
  `mediaDraftBoundary.ts`, mirroring the server bucket config exactly, wired into every
  `ProductMediaUploader.tsx` and `uploadFastCreateHero.ts` upload entry point, scoped per input
  type (image-only slots reject video/PDF and vice versa), with unit tests. **Fixed (Central):**
  `product-images` (the bucket Central's `AdminProducts.tsx handleImageUpload` writes to) had *no*
  server-side size/MIME enforcement at all — Core migration
  `20260809211500_enforce_product_images_bucket_limits.sql` added a 10MB/image-only allowlist, and
  Central's `handleImageUpload` gained the matching client-side check.

## Verified-safe facts established (no rebuild needed)

- No direct client-side bypass of Core authority found in the Operator Inbox path — it is RPC-only.
- `AI Studio` repository governance docs (`BACKEND_OWNERSHIP.md`, `README.md`) already assert and
  enforce: no Supabase migrations/functions deployed from this repo, Central Supabase is canonical,
  no Lovable Cloud runtime.

## Next steps in this programme (in order, per owner mandate)

1. Central Product Master authority question (Finding 3) — **resolved this session**: Central
   legitimately owns this, no migration pursued. Residual governance follow-ups (not
   authority-blocked): server-side `human_review_required` gate for Central's AI-compliance
   generation (client-side gate already shipped), and a `products.sku` uniqueness audit +
   constraint (needs production read access first — see Finding 3).
2. WhatsApp Operator Inbox disposition (Finding 1) — **resolved this session**: no promotion path
   to Central's `sales_order_drafts` should be built, bridge stays disabled, module kept in place
   with a disposition note. Only remaining owner call: delete the dormant module outright vs. keep
   it as potential future intelligence-layer salvage — a scale/reversibility decision, not an
   architecture one.
3. Full AI Studio route/capability inventory with reachability + persistence tracing (Phase 2) —
   in progress; first pass found and fixed two broken relative imports in the Operator Inbox
   (`bridge/fixtures/sampleErpWhatsAppRows.ts`, `components/DraftVisibilityPanel.tsx`) that
   `knip`/`tsc` flagged as unresolved modules on a route that is actually wired and reachable.
   15 of 29 routes still need full read/mutation/error/empty-state tracing.
4. AI engine capability audit — catalogue copy generation confirmed well-governed (Phase 4); product
   intelligence/utterance resolution and media generation capabilities not yet audited.
5. Core DB/RPC/RLS authority audit for AI Studio's remaining Supabase mutations (Phase 8) — beyond
   the pricing/moq lockdown (Finding 2, including its recurrence fix) and product-media bucket
   enforcement (Phase 12) already fixed this session.
6. Publishing state machine verification (Phase 9), asset pipeline (Phase 10) — media upload path
   spot-checked and hardened (Phase 12, see above, including Central's image upload); rest of the
   pipeline not yet audited.
7. Testing/CI execution and gap-filling (Phase 13), then remaining implementation PRs (Phase 16).
8. Regenerate Central's `types.ts` from the live schema to replace the hand-added pricing/moq
   draft-table and RPC type entries added in Finding 2.

## Findings status summary

| # | Finding | Status |
| --- | --- | --- |
| 1 | Operator Inbox / `whatsapp_sales_order_drafts` dormant dead-end | **Authority question resolved this session** (no promotion path should be built; bridge stays disabled) — module kept in place with a clear disposition note; delete-vs-keep-dormant is the one remaining owner call, now scale/reversibility only |
| 2 | Pricing/MOQ self-approval bypass (AI Studio "direct" mode) | **Resolved** — merged (Core PR #60, Central PR #344; AI Studio PR #118 green, merge-ready). A second recurrence (`syncChannelPricingFromForm.ts`) was found and fixed in the same pass. |
| 3 | Central (`AdminProducts.tsx`) independently generates SKUs, duplicates AI Studio's Product Master authority | **Authority question resolved this session** (Central legitimately owns this; no migration needed) — residual governance gaps (AI-compliance server-side gate, `products.sku` uniqueness) documented as follow-ups, not authority-blocked |

## Safety

- No production data mutation performed.
- No migration applied directly to production by this session — Core migrations added this session
  (pricing/moq lockdown, product-media bucket enforcement) are committed to reviewed PR #60 and only
  reach production through the normal reviewed-merge pipeline, same as any other change in this repo.
- No Edge Function deployed from this session.
- No service-role credential use.
- No destructive git operations performed.
