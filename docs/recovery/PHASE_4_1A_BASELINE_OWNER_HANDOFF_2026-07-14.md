# Phase 4.1a Baseline-Capture Owner Handoff — 2026-07-14

**Status:** Documentation-only. No migration was written in this repo. No SQL beyond read-only `SELECT` was executed against production (`tcxvcatsqqertcnycuop`). No PR, deployment, merge, new branch, RLS/grant change, Edge Function change, or application/UI change occurred.

---

## Canonical-owner decision

**Target repository for the baseline-capture migration: `oasis-supabase-core`.**

This was determined from two independent, agreeing sources — as instructed, before any file was written:

1. **Phase 3b ownership ledger** (`SCHEMA_DRIFT_REMEDIATION_DESIGN_2026-07-14.md`, §1–3): the five missing baseline objects (`orders`, `order_items`, `users`, `companies`, `products`) are attributed to migration files historically living in `oasis-baklawa-central`'s repository — but that attribution describes where the *existing* tracked migrations that reference these tables happen to live, not who owns *authoring new* schema/DDL going forward.
2. **This repo's own boundary files**, which are authoritative on that second question:
   - `docs/repo-ownership-guardrails.md`: *"oasis-supabase-core owns: Supabase migrations, RLS policies, Backend schema authority, Edge Functions, Database DDL."*
   - `scripts/check-repo-boundaries.sh` (header comment): *"Fails if this repo ... newly adds Supabase migration/schema/DDL/Edge Function ownership that belongs to oasis-supabase-core."*
   - The same script hard-fails CI on any **new** file under `supabase/migrations/` in this repo, with no exception for baseline/recovery work.

Since a baseline-capture migration is new DDL, `oasis-ai-studio` is explicitly and doubly barred from authoring it (by design intent and by enforced CI). `oasis-baklawa-central` is also not the target — the guardrail doc's ownership split assigns "Supabase migrations... Database DDL" to `oasis-supabase-core` specifically, not to Central (which owns the operations *application*, not backend schema authority). Per the task instruction, this repo therefore stops at a documentation-only handoff.

---

## Exact target repo and file location

`oasis-supabase-core`, `supabase/migrations/` — following that repo's existing naming convention (`<14-digit-timestamp>_<description>.sql`), e.g. `supabase/migrations/<timestamp>_baseline_capture_orders_users_companies_products.sql`.

---

## Ordered object contract

Verified this phase via read-only introspection against `tcxvcatsqqertcnycuop` (`information_schema.columns`, `information_schema.table_constraints` + `key_column_usage` + `constraint_column_usage`). **A genuine circular foreign-key dependency exists** (`companies.account_manager_id → users.id` and `users.company_id → companies.id`) and must be resolved by deferring one FK to a post-creation `ALTER TABLE`, not by reordering `CREATE TABLE` statements — no ordering of plain `CREATE TABLE` statements alone can satisfy both directions simultaneously.

**Resolved creation order:**

| Step | Object | Depends on | FK columns created (deferred FKs marked) |
|---|---|---|---|
| 1 | `public.categories` | none | `parent_id → categories.id` (self, nullable — safe within one `CREATE TABLE`) |
| 2 | `public.companies` | none (yet) | `account_manager_id` column created **without** its FK constraint at this step (circular — see step 4) |
| 3 | `public.users` | step 2 (`companies` must exist) | `company_id → companies.id` |
| 4 | *(deferred constraint)* | steps 2–3 | `ALTER TABLE public.companies ADD CONSTRAINT companies_account_manager_id_fkey FOREIGN KEY (account_manager_id) REFERENCES public.users(id);` — added only now that `users` exists |
| 5 | `public.products` | step 1 (`categories` must exist) | `category_id → categories.id` |
| 6 | `public.orders` | step 2 (`companies` must exist) | `company_id → companies.id`; `duplicate_of_order_id → orders.id` (self, nullable — safe within one `CREATE TABLE`) |
| 7 | `public.order_items` | steps 5–6 (`products` and `orders` must exist) | `order_id → orders.id`; `product_id → products.id` |

**Column contract, evidence-based (not invented):**

- **`categories`**: `id uuid PK default gen_random_uuid()`, `name text NOT NULL`, `parent_id uuid NULL` (self-FK). Full column set (3 columns) — small enough to capture in full, verified live.
- **`companies`**: 24 live columns verified (full list: `id`, `business_name`, `gst_number`, `business_volume`, `website`, `credit_limit`, `wallet_balance`, `created_at`, `status`, `current_balance`, `discount_percentage`, `preferred_courier`, `courier_account_number`, `allow_credit`, `account_manager_id`, `price_tier`, `phone`, `fssai_number`, `registered_address`, `payment_terms`, `is_frozen`, `total_outstanding`, `rescue_payment_date`, `settlement_deadline`).
- **`users`**: 20 live columns verified (`id`, `company_id`, `name`, `email`, `phone`, `role`, `created_at`, `full_name`, `mobile_number`, `department`, `designation`, `is_active`, `joined_at`, `preferred_language`, `invite_status`, `commission_rate_percentage`, `has_seen_tutorial`, `is_sales_executive`, `secondary_phones`, `deleted_at`). No FK to `auth.users` exists on `users.id` (unlike the unrelated, never-applied Studio sandbox `profiles` table from Phase 3a §5 — do not conflate the two).
- **`orders`**: 42 live columns verified. Full list available via the verification query below; do not re-derive from memory.
- **`order_items`**: 12 live columns verified (`id`, `order_id`, `product_id`, `quantity`, `pack_size`, `carton_type`, `notes`, `department`, `production_status`, `task_type`, `actual_packed_qty`, `weight_kg`).
- **`products`**: 137 live columns — too many to enumerate exhaustively here without inventing false precision. Two subsets are already evidence-backed from this engagement and should anchor the minimal-column derivation:
  - **FK-critical for dependency order**: `id` (PK), `category_id` (FK to `categories.id`).
  - **Explicitly required by an already-captured, in-scope tracked object** (`approve_catalogue_draft_internal`, captured verbatim in Phase 3b, which will itself become a Phase 4.4 capture migration depending on this baseline): `id`, `sku`, `name`, `category`, `sub_category`, `description`, `department`, `production_department`, `hsn_code`, `gst_rate`, `gst_percentage`, `mrp`, `price_b2b`, `price_bulk`, `price_wholesale`, `wholesale_price`, `uom`, `is_active`, `visible_in_catalog`, `pack_size`, `ingredients`, `allergen_warnings`, `nutrition_facts`, `product_family`, `created_at`. Note `products.category` (text) and `products.category_id` (uuid FK) are two distinct, coexisting columns live — both are required, do not assume one supersedes the other without further investigation (consistent with the drift pattern already documented in Phase 3a).
  - The remaining ~110 columns should be pulled from the live schema directly (query below) rather than re-typed by hand into a migration file, to avoid transcription error against a 137-column table.

---

## Required dependencies

- Extensions: `pgcrypto` (for `gen_random_uuid()` — already installed live per Phase 3a §2, schema `extensions`).
- No dependency on `auth.users`, `auth.uid()`, or any `auth` schema object for table creation itself (RLS policies that reference `auth.uid()` are a separate, later concern — not part of this baseline-capture package, which per Phase 3b §1 item 1 is classified **capture-only**, i.e. tables and their structural constraints only, not policies/grants/triggers).
- No dependency on any catalogue object (`products`, `catalogue_versions`, etc.) — this baseline is upstream of all catalogue work in the Phase 4 dependency order established in Phase 3b §4.

---

## Replay acceptance tests (for the assigned repo to satisfy at implementation time)

1. **Dependency-safe creation order**: applying the migration standalone, in isolation, against an empty schema produces no `relation does not exist` / `constraint ... referenced table does not exist` errors, in the exact 7-step order above (including the deferred `ALTER TABLE` for the circular FK).
2. **Unblocks the existing chain**: with this migration applied first, Central's earliest tracked migration (`20260316122451_bbadbd7b-....sql`, which opens with `CREATE POLICY ... ON public.orders ... FOR INSERT ... WITH CHECK (company_id = (SELECT users.company_id FROM users WHERE users.id = auth.uid()))`) no longer fails at "relation `public.orders` does not exist" or "relation `public.users` does not exist" — confirmed by this document's dependency graph, since both tables and their `company_id` columns exist after step 3.
3. **Idempotent / safe to rerun**: every `CREATE TABLE` uses `IF NOT EXISTS`; the deferred `ALTER TABLE ADD CONSTRAINT` step is guarded (e.g. wrapped in a `DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_account_manager_id_fkey') THEN ... END IF; END $$;` block, or use `ADD CONSTRAINT IF NOT EXISTS` if the target Postgres version supports it) so a second application against an already-baselined database is a no-op, not an error.
4. **No destructive statements**: the migration must contain zero `DROP`, `TRUNCATE`, `DELETE`, or non-additive `ALTER` statements — confirmed by static review before merge, not just by testing.
5. **No data migration**: the migration creates empty tables only — zero `INSERT` statements, no backfill, no seed data. (Production already has real rows in all five tables; this capture migration is schema-only and is never intended to run against production itself — see Phase 3a §6 step 2/3: it is for fresh-branch/disposable-environment replay only.)

---

## Verification queries used to build this contract (repeatable, read-only)

```sql
-- Full column list for the four narrow tables
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name in ('orders','order_items','users','companies')
order by table_name, ordinal_position;

-- categories (products' FK dependency)
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name='categories'
order by ordinal_position;

-- Full FK graph for the six-table dependency set (reveals the circular reference)
select tc.table_name, tc.constraint_name, kcu.column_name,
       ccu.table_name as references_table, ccu.column_name as references_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
where tc.table_schema='public' and tc.constraint_type='FOREIGN KEY'
  and tc.table_name in ('orders','order_items','users','companies','products');

-- Full products column list (137 columns — pull directly, do not hand-transcribe)
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public' and table_name='products'
order by ordinal_position;
```

---

## Remaining prerequisites before Phase 4.1b

1. `oasis-supabase-core` must accept this handoff and draft the actual migration file using the ordered contract above, then run this document's own replay acceptance tests against a disposable branch or isolated database (subject to that repo's own cost/credential constraints — not evaluated here).
2. Once the baseline-capture migration exists and passes replay verification, Phase 4.1b (per the Phase 3b package breakdown) is the `catalogue_versions`/`catalogue_sync_events` capture migration, which depends on `products` existing (step 5 above).
3. This repo (`oasis-ai-studio`) has no further action until `oasis-supabase-core`'s baseline migration is merged and its commit SHA is available for this recovery branch's records to reference.
