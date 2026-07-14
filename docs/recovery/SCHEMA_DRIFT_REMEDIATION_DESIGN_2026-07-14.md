# Schema Drift Remediation Design — 2026-07-14

**Phase:** 3b — design and validation only. No SQL was executed against production beyond additional read-only `SELECT`/`information_schema`/`pg_proc` introspection (see "Additional verification queries" at the end). No migration was written, applied, or tested. No PR, deployment, merge, new branch, RLS/grant change, Edge Function change, or Vercel change occurred.

**Depends on:** `docs/recovery/PRODUCTION_SCHEMA_BASELINE_RECONCILIATION_2026-07-14.md` (Phase 3a, commit `69916e7`). This document does not restate Phase 3a's evidence tables — it converts Phase 3a's findings into a remediation ledger and adds only the new evidence gathered specifically for remediation design (RPC bodies, EXECUTE grants, duplicate-SKU aggregate counts). Read Phase 3a first for the underlying facts.

---

## 1–3. Remediation ledger

Every Phase 3a unresolved object, classified, with its canonical owning repository.

| # | Object | Phase 3a status | Classification | Canonical owner |
|---|---|---|---|---|
| 1 | `public.orders`, `public.order_items`, `public.users`, `public.companies` (base tables, no CREATE TABLE in any tracked migration) | repo-only gap (nothing creates them) | **capture-only** | Central (all downstream policy/FK migrations targeting these tables live in Central) |
| 2 | `products` / `profiles` actual live shape (137-col `products`, distinct from Studio's narrower sandbox schema) | unknown provenance | **capture-only** | Central |
| 3 | `catalogue_versions`, `catalogue_sync_events` | tracked but drifted (content matches Studio/Core file, timestamp untracked) | **capture-only** (content already correct; only the tracking record is missing) | Studio / Core (shared) |
| 4 | `catalogue_product_mappings` | tracked but drifted (timestamp only) | **capture-only** | Central |
| 5 | `catalogue_ai_studio_drafts`, `catalogue_ai_studio_draft_audit_log` | tracked but drifted (timestamp only) | **capture-only** | Core (Studio never received the file) |
| 6 | Seven legacy catalogue-draft tables (`catalogue_product_drafts`, `catalogue_media_submissions`, `catalogue_alias_drafts`, `catalogue_bom_drafts`, `catalogue_moq_drafts`, `catalogue_pricing_drafts`, `catalogue_tag_drafts`) | live-only / unknown provenance | **capture-only** | Central (envelope shape — `source_app`, `target_table`, `payload jsonb` — matches Central's generic draft-router pattern, not Studio's per-field pattern) |
| 7 | `catalogue_approval_audit` | live-only / unknown provenance | **capture-only** | Central |
| 8 | 16 catalogue-approval RPCs (`approve_catalogue_draft_internal`, `reject_catalogue_draft_internal`, + 7 approve/7 reject wrappers) | live-only / unknown provenance, but body now captured verbatim (§6) | **capture-only**, with the `catalogue_product_drafts` branch requiring **requires application change first** before any further edit (it writes real business columns to `products` — see §6, §8) | Central (function comment: *"PRESERVED VERBATIM: catalogue_product_drafts branch (Central staging baseline)"*) |
| 9 | `catalogue_alias_drafts.source_mapping_id` + FK (PR06C1b) | repo-only, confirmed not applied | **unsafe / manual architecture decision required** | Central (file lives there); do not merge blindly — see §6 |
| 10 | `catalogue_collections` / share-link tables | repo-only, does not exist live at all | **requires application change first** — no live consumer exists; building this is new capability work, not drift remediation | Studio/Core (file already exists, unapplied) |
| 11 | Anonymous (`anon`/`PUBLIC`) EXECUTE grants on all 16 catalogue-approval RPCs | newly confirmed this phase (§ Additional verification queries) | **requires application change first**, then **safe additive migration candidate** — see §6 for the exact narrowing sequence; **not touched now** | Central (grants were established alongside the RPCs) |
| 12 | Duplicate `products.sku` values (367 rows / 267 distinct SKUs / 55 SKU values duplicated / 0 nulls / **no unique constraint on `sku` exists**) | newly confirmed this phase | **requires data backfill** before any uniqueness constraint can be added — see §7 | Central (owns `products`) |
| 13 | WhatsApp domain overlap (Studio/Core `whatsapp_inbound_messages`/`whatsapp_sales_order_drafts` vs. Central's parallel `wa_*` migrations) | flagged unknown in Phase 3a, out of scope there | **unsafe / manual architecture decision required** — full reconciliation deferred; not part of the catalogue critical path (§8) | Unresolved — requires a dedicated WhatsApp-domain reconciliation pass, not this document |
| 14 | 27 unresolved live-only ledger entries (early Central-era timestamps with no confidently matched file) | unknown | **capture-only**, pending manual per-entry identification | Central |

---

## 4. Dependency order for reconstruction

A fresh-branch replay must apply objects in this exact order. Each step names the item(s) from §1–3 it captures and states the hard blocker it removes.

1. **Baseline capture migration** (new, not yet written) — `CREATE TABLE IF NOT EXISTS` for `public.orders`, `public.order_items`, `public.users`, `public.companies`, and `public.products` exactly as they exist live today (item 1–2). This is the literal fix for Phase 3a §5's root cause: nothing downstream can run until these exist, because the very first tracked migration (`20260316122451`) already assumes them.
2. **Central's 133 tracked migrations, in timestamp order**, replayed against the baseline from step 1. These already reference the base tables correctly once step 1 exists.
3. **Catalogue-versions capture migration** (new) — `catalogue_versions`, `catalogue_sync_events`, and their live RLS policies, exactly as captured (item 3). Depends on step 1 (`products` FK) and step 2 (nothing else references it).
4. **Legacy seven-table + audit capture migration** (new) — the seven draft tables and `catalogue_approval_audit`, exactly as captured (items 6–7). Depends on step 1 (`products` FK target for `catalogue_product_drafts`' downstream writes) but not on step 2 or 3.
5. **16 catalogue-approval RPC capture migration** (new) — `CREATE OR REPLACE FUNCTION` for all 16, exact bodies from §6's captured definitions (item 8). Depends on steps 1 and 4 (references `products`, `product_tags`, `product_aliases`, and all seven draft tables plus the audit table by name inside `EXECUTE format(...)`).
6. **catalogue_ai_studio_drafts capture migration** (new) — item 5, depends on step 1.
7. **catalogue_product_mappings capture migration** (new) — item 4, depends on step 1.
8. Studio's remaining tracked files (excluding the 16 sandbox-only UUID-named ones — Phase 3a §5 established they target an incompatible schema) and Core's one extra (`catalogue_ai_studio_governance`), in timestamp order, depend on steps 1–7 already being in place.
9. **PR06C1b, WhatsApp domain overlap, catalogue_collections** — explicitly **not** part of this reconstruction sequence (items 9, 10, 13 are unsafe/requires-application-change; including them would silently introduce untested capability, not just restore parity).

No step in this sequence has been executed. This is the design order only.

---

## 5. Preflight / transaction / rollback / postflight / acceptance checks (template for every future migration package)

Applies uniformly to every capture migration named in §4.

| Stage | Check |
|---|---|
| **Preflight** | (a) Confirm target objects still match the exact definition captured in this document / Phase 3a — re-run the relevant `information_schema`/`pg_get_functiondef` query and diff against the captured text before writing the migration body. (b) Confirm the migration uses `CREATE TABLE IF NOT EXISTS` / `CREATE OR REPLACE FUNCTION` exclusively — no `DROP`, no destructive `ALTER`. (c) Confirm no new columns, constraints, or behavior are introduced beyond what is already live — a capture migration must be a no-op against current production. |
| **Transaction** | Every migration wrapped in a single `BEGIN; ... COMMIT;` (Supabase migrations already run each file transactionally by default). No multi-file transaction spans — each capture migration in §4 is independently atomic and independently replayable. |
| **Rollback** | Because every capture migration is `IF NOT EXISTS`/`OR REPLACE` against objects that already exist identically in production, applying it to production is designed to be a **guaranteed no-op** (verified by preflight diff) — the practical rollback is "do not apply it," decided at the preflight stage, not after. For the ephemeral branch used in replay verification (Phase 3a §6 step 3), rollback is simply discarding the disposable branch. |
| **Postflight** | Re-run the exact `information_schema`/`pg_proc`/`pg_policy` query for the affected object(s) against the target (branch or production) and confirm output is byte-identical to preflight — proves the migration changed nothing observable. |
| **Acceptance** | (a) Postflight diff is empty. (b) `npm run typecheck`, `npm run build`, and the relevant contract test (`legacyApprovalContract.test.ts` for RPC-touching migrations) pass unchanged. (c) `git diff --check` clean. (d) No new advisory finding from `mcp__Supabase__get_advisors` (security) introduced by the change. |

---

## 6. Legacy-approval reconciliation plan

1. **Capture the true live wrapper definitions as source-controlled baseline.** §"Additional verification queries" below captured `approve_catalogue_draft_internal` and `reject_catalogue_draft_internal` verbatim via `pg_get_functiondef`. The `catalogue_product_drafts` branch inside `approve_catalogue_draft_internal` is explicitly marked in its own SQL comment: *"PRESERVED VERBATIM: catalogue_product_drafts branch (Central staging baseline)"* — confirming Central authored and owns this branch, and that it performs real `INSERT`/`UPDATE` against `public.products`' actual business columns (`sku`, `name`, `category`, `mrp`, `price_b2b`, `gst_rate`, `ingredients`, `nutrition_facts`, etc.). The `catalogue_tag_drafts` and `catalogue_alias_drafts` branches map to `product_tags`/`product_aliases` respectively. `catalogue_bom_drafts`, `catalogue_moq_drafts`, `catalogue_pricing_drafts`, `catalogue_media_submissions` fall through to the unchanged soft-block path (`approve_blocked_mapping_not_finalized`), consistent with `src/features/approvals/legacyApprovalContract.ts` already in this repo. The capture migration in §4 step 5 is this baseline, verbatim, with no edits.
2. **Retain the PR06C1b packaging-scalars branch (`20260610231247_pr06c1b_packaging_product_approve_mapping.sql`, Central) as historical design only.** It is confirmed unapplied (item 9 — `source_mapping_id` absent live). Its own header comment already states live `approve_catalogue_alias_draft` does not read `source_mapping_id`, so applying the column alone would add dead schema with no behavior change, and applying it together with an RPC edit would require rewriting the verbatim-preserved function body from step 1 — an architecture decision, not a drift fix. **Do not merge its SQL blindly** into any capture migration in §4.
3. **Distinguish legacy seven-table drafts from `catalogue_ai_studio_drafts`.** These are two structurally different, independently-live systems: the seven legacy tables use Central's generic envelope (`source_app`/`target_table`/`operation`/`payload jsonb`), routed exclusively through `approve_catalogue_draft_internal`/`reject_catalogue_draft_internal`; `catalogue_ai_studio_drafts` (27 columns, drifted-timestamp-tracked to Core's `catalogue_ai_studio_governance` migration) is a separate, per-field AI Studio draft table with its own audit log (`catalogue_ai_studio_draft_audit_log`) and no RPC overlap with the legacy 16 functions. Any future consolidation of these two systems is out of scope for drift remediation — it is a product/architecture decision requiring its own design document (§9 blocks Phase 4 from doing this implicitly).
4. **Safe path to eventually narrow anonymous EXECUTE grants (not changed now).** All 16 catalogue-approval RPCs currently grant `EXECUTE` to `PUBLIC` and `anon` (confirmed this phase, see below) — the only enforcement is the function-internal `IF NOT public.is_catalogue_reviewer() THEN RAISE EXCEPTION` check, not a database-level `REVOKE`. Defense-in-depth is currently single-layered. The safe narrowing sequence, for a future phase:
   a. Confirm (read-only, via `pg_stat_statements` or application logs — not done in this phase) that no legitimate anon-role caller exists — the frontend always calls these through an authenticated Supabase client per `src/features/approvals/ApprovalInbox.tsx`.
   b. Stage `REVOKE EXECUTE ... FROM PUBLIC, anon` as its own single-purpose migration, reviewed independently of any capture migration, with `authenticated` and `service_role` grants explicitly re-confirmed present first (they already are).
   c. Deploy behind a monitoring window (watch for new `is_catalogue_reviewer` exceptions vs. new `permission denied for function` errors post-revoke — a change in error class would indicate a caller was relying on the anon grant specifically).
   d. This sequence is documented here for Phase 4+ planning only — no grant is changed by this document.

---

## 7. Duplicate SKU remediation decision framework

**Evidence (aggregate counts only — no SKU value, product name, or row content read or recorded):**

| Metric | Value |
|---|---|
| Total `products` rows | 367 |
| Distinct `sku` values | 267 |
| Row-count excess over distinct SKUs | 100 |
| Distinct SKU values that have ≥2 rows | 55 |
| Rows with `sku IS NULL` | 0 |
| Unique constraint on `products.sku` | **none exists** |

**Decision framework (no data touched by this document):**

| Option | When appropriate | Risk |
|---|---|---|
| A. Leave as-is, document as known debt | If duplicate SKUs are a legitimate multi-batch/multi-listing pattern (e.g. same SKU across `catalogue_versions` snapshots, or intentional re-listings) | Blocks ever adding a `UNIQUE` constraint; any future code that assumes SKU uniqueness (e.g. `generate_oasis_sku` collision checks) must keep tolerating duplicates |
| B. Backfill-then-constrain | If duplicates are unintentional drift, requires: (1) a read-only investigation identifying *which* of the 55 duplicated values are genuine business duplicates vs. safe-to-merge stale rows — this investigation is itself out of scope for Phase 3b, since it would require reading actual SKU/product content; (2) an explicit backfill migration (data-only, reviewed and approved separately) reassigning/merging duplicate rows; (3) only then a `UNIQUE` constraint migration | Backfill is a data mutation — requires its own authorization, its own rollback plan, and cannot be designed further without reading the actual duplicated rows (business data), which this phase is explicitly barred from doing |
| C. Soft uniqueness (partial index / application-level check only) | If some duplication is legitimate (e.g. soft-deleted or archived rows sharing a SKU with an active one) | Requires knowing which rows are archived/active — same data-reading blocker as Option B |

**This document does not choose an option.** Classification: **requires data backfill** (item 12), blocked pending a separate, explicitly-authorized data-investigation task that this phase's "no business data" and "no data backfill" constraints do not permit.

---

## 8. Full Editor production-readiness blockers

| Item | Blocks Full Editor readiness? | Why |
|---|---|---|
| Missing baseline capture (§4 step 1) | **No** — Full Editor already runs against live production; the gap only affects *fresh-branch provisioning*, not the running system | Confirmed live schema already has everything Full Editor reads/writes |
| `catalogue_versions`/`catalogue_sync_events` tracking drift | **No** | Content is correct live; only the migration-tracking record is missing |
| Seven legacy draft tables + `catalogue_approval_audit` untracked provenance | **No** | Live and functioning; Full Editor's approval path (via `legacyApprovalContract.ts`) already accounts for the soft-blocked draft types |
| PR06C1b unapplied | **No** | Its own header confirms nothing live reads `source_mapping_id` yet |
| Duplicate SKUs (no unique constraint) | **Yes, conditionally** — if any Full Editor feature (e.g. a future SKU-uniqueness validation, or a lookup keyed by SKU expecting exactly one row) is built assuming `sku` is unique, it will silently misbehave against the 55 duplicated values today. Current Full Editor code was not audited in this phase for such an assumption — flagged as a **pre-check item** for whoever next touches SKU-keyed lookups, not a current known bug. |
| Anonymous EXECUTE grants on approval RPCs | **No** for current behavior (function-internal check already blocks non-reviewers) — **Yes** as a defense-in-depth gap that should be closed before treating the approval workflow as fully hardened for production scale, per §6 item 4's staged plan |
| catalogue_collections / share links absent | **No** — no live UI in this repo currently depends on them (confirmed no table exists to depend on) |
| WhatsApp domain overlap | **No** — unrelated to Full Editor's catalogue/approval surface |

---

## 9. Go / no-go gate for Phase 4 implementation

**NO-GO** on any of the following until independently resolved:

1. The baseline capture migration (§4 step 1) has not been drafted, reviewed, or diffed against a fresh `pg_dump --schema-only` of production — it exists only as a design step in this document.
2. No capture migration in §4 has been preflight-diffed per §5's template against current production state at implementation time (production may have changed between this document's writing and Phase 4 starting).
3. PR06C1b (item 9) requires an explicit, separate architecture decision before any part of it is merged — Phase 4 must not fold it into a capture migration.
4. The duplicate-SKU decision (§7) is unresolved and requires a data-reading investigation this phase could not perform — Phase 4 must not add a `UNIQUE` constraint on `products.sku` under any circumstances until that investigation and an explicit backfill decision exist.
5. The WhatsApp domain overlap (item 13) remains fully unreconciled — Phase 4 must not touch any `whatsapp_*` object as a side effect of catalogue capture work.
6. Anonymous EXECUTE grant narrowing (§6 item 4) requires its own monitoring-backed rollout — Phase 4 must not include any `REVOKE` statement.

**GO**, scoped strictly to: drafting (not applying) the seven capture migrations named in §4 steps 1, 3–7, each independently preflight-verified per §5, each committed and reviewed before any is applied to any environment (including a disposable branch).

---

## Proposed Phase 4 package breakdown (for planning only — not started)

| Package | Contents | Depends on |
|---|---|---|
| 4.1 | Baseline capture: `orders`, `order_items`, `users`, `companies`, `products` | none |
| 4.2 | `catalogue_versions` + `catalogue_sync_events` capture | 4.1 |
| 4.3 | Seven legacy draft tables + `catalogue_approval_audit` capture | 4.1 |
| 4.4 | 16 catalogue-approval RPC capture (verbatim bodies from §6) | 4.1, 4.3 |
| 4.5 | `catalogue_ai_studio_drafts` + audit log capture | 4.1 |
| 4.6 | `catalogue_product_mappings` capture | 4.1 |
| 4.7 | Replay verification on a disposable branch (Phase 3a §6 step 3) + contract tests (Phase 3a §6 step 4) | 4.1–4.6 |

Deferred, each requiring its own separate authorization and design pass: PR06C1b architecture decision, duplicate-SKU investigation and backfill, anonymous EXECUTE grant narrowing, WhatsApp domain reconciliation, `catalogue_collections` capability decision, controlled production `schema_migrations` reconciliation (Phase 3a §6 step 5).

---

## Additional verification queries (read-only, this phase)

```sql
-- Verbatim RPC capture
select p.proname, pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
  ('approve_catalogue_draft_internal','reject_catalogue_draft_internal');

-- EXECUTE grant audit (all 16 approval RPCs)
select r.routine_name, g.grantee, g.privilege_type
from information_schema.routine_privileges g
join information_schema.routines r on r.specific_name = g.specific_name
where r.routine_schema='public' and r.routine_name in (/* 16 names */)
order by r.routine_name, g.grantee;

-- Duplicate SKU aggregate (no row content)
select count(*) as total_products, count(distinct sku) as distinct_skus,
       count(*) - count(distinct sku) as duplicate_row_excess,
       (select count(*) from (select sku from public.products where sku is not null group by sku having count(*)>1) d) as sku_values_with_duplicates,
       count(*) filter (where sku is null) as null_sku_rows
from public.products;

-- Unique constraint check on sku
select tc.constraint_name, tc.constraint_type, kcu.column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
where tc.table_schema='public' and tc.table_name='products' and kcu.column_name='sku';
```
