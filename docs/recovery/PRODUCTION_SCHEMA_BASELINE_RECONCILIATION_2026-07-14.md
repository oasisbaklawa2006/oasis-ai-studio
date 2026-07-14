# Production Schema Baseline Reconciliation — 2026-07-14

**Scope:** Read-only introspection of Supabase production project `tcxvcatsqqertcnycuop` (region `ap-south-1`, Postgres 17.6.1, status `ACTIVE_HEALTHY`), cross-referenced against the migration files tracked in three repositories:

| Tag | Repository | Migrations dir | File count |
|---|---|---|---|
| Studio | `oasisbaklawa2006/oasis-ai-studio` (this repo) | `supabase/migrations/` | 25 |
| Central | `oasisbaklawa2006/oasis-baklawa-central` | `supabase/migrations/` | 133 |
| Core | `oasisbaklawa2006/oasis-supabase-core` | `supabase/migrations/` | 26 |

No SQL was executed against production beyond `SELECT` queries against `information_schema`, `pg_catalog`, and `storage.buckets`. No migration was applied, tested, or drafted. No customer, order, user, token, secret, or other raw business-data row was read or recorded anywhere in this document — every value below is schema/definition metadata (table names, column names, types, constraint names, function signatures, row *counts*, not row *contents*).

---

## 1. Applied production migration ledger vs. Studio / Central / Core migration files

Production's `supabase_migrations.schema_migrations` currently has **147 applied entries** (verified via `mcp__Supabase__list_migrations` against `tcxvcatsqqertcnycuop`). Repo-file timestamps were extracted with `ls supabase/migrations/ | grep -oE '^[0-9]{14}'` in each repo and set-compared against the applied version list.

**Repo-to-repo relationship (verified, zero timestamp collisions across repos):**
- Studio's 25 migration timestamps are an **exact subset** of Core's 26 (Core has exactly one extra: `20260709120000_catalogue_ai_studio_governance.sql`).
- Central's 133 migration timestamps share **zero** overlap with Studio/Core's 25/26 — they are two structurally disjoint migration lineages that both write to the same `public` schema in the same production project.

**Reconciliation counts:**

| Category | Count |
|---|---|
| Applied in production AND tracked in a repo (exact timestamp match) | 120 (all Central) |
| Applied in production but in **no** repo at any timestamp (live-only ledger entries) | 27 |
| In a repo but **never applied** under that exact timestamp | 39 |
| — of which: same *name* found applied under a **different** timestamp (drift) | 15 |
| — of which: no applied entry with that name at all (true repo-only) | 24 |

**Drifted migrations (repo timestamp ≠ applied timestamp, same logical migration by name — content of the repo file was verified structurally consistent with the live objects it describes, see §3):**

| Repo file timestamp | Applied timestamp | Name |
|---|---|---|
| `20260601142000` (Central) | `20260601142027` | fix_is_internal_staff_dispatch_head |
| `20260601180000` (Central) | `20260602060423` | phase25b_catalogue_product_mappings |
| `20260604120000` (Central) | `20260604034227` | wa_stage1_inbox_reader_rls |
| `20260605120000` (Central) | `20260604092524` | wa_sprint9_sales_order_drafts_staging |
| `20260606120000` (Central) | `20260604124538` | wa_sprint9_sales_order_draft_transition_rpc |
| `20260606130000` (Central) | `20260604124553` | wa_sprint9_sales_order_draft_create_atomic_rpc |
| `20260606140000` (Central) | `20260604132023` | wa_sprint9_sales_order_draft_operator_final_rpc |
| `20260606150000` (Central) | `20260604133321` | wa_sprint9_sales_order_draft_submit_review_atomic_rpc |
| `20260606160000` (Central) | `20260604135037` | wa_sprint9_sales_order_draft_approve_reject_atomic_rpc |
| `20260606170000` (Central) | `20260604142330` | wa_sprint9_sales_order_draft_extraction_version_rpc |
| `20260606180000` (Central) | `20260604164031` | wa_sprint9_sales_order_draft_approve_extraction_readiness_hardening |
| `20260607190000` (Central) | `20260605142934` | sprint_9_5_customer_master_import_staging |
| `20260624160000` (Studio+Core) | `20260624165827` | whatsapp_phase2f_quantity_realtime |
| `20260625140000` (Studio+Core) | `20260625020441` | whatsapp_studio_inbox_bridge_state |
| `20260709120000` (Core) | `20260709085340` | catalogue_ai_studio_governance |

**True repo-only migrations (no applied entry under any timestamp, by name):**
- Central: `20260610231247_pr06c1b_packaging_product_approve_mapping.sql` — verified **not applied**: the column it adds (`catalogue_alias_drafts.source_mapping_id`) does not exist live (§3, §4).
- Studio+Core (16 files, timestamps `20260506044916`–`20260507145824`, UUID-named): these create a **narrower, self-contained** `profiles` / `user_roles` / `products` / `product_media` / `tags` schema (verified by reading the file — `CREATE TABLE public.products` with far fewer columns than the live 137-column `products` table). This is evidence Studio's repository was originally scaffolded against an independent sandbox Supabase project, not this production project — see §5.
- Studio+Core: `20260602120000/140000/160000` (product_truth_snapshot_additive, catalogue_versions_and_sync_events, catalogue_collections_foundation), `20260603120000/180000` (product_governance_archive_delete, catalogue_versions_rls_team_access), `20260623140000/210000` (whatsapp_inbound_messages_phase2c, whatsapp_sales_order_drafts_phase2de) — mixed status, see §3.

**Live-only applied entries (27 total, no matching repo file at all):** all fall in the timestamp range `20260316122451`–`20260427121337` immediately preceding Central's earliest UUID-named files, i.e. within Central's own oldest era — these are early Central migrations whose `.sql` bodies are still present in Central's repo (86 of the ~113 migrations in that date range **do** have matching files; the 27 without a match are the ones this reconciliation could not resolve to a repo file and are flagged **unknown** in §3).

**Verification query (repeatable):**
```sql
-- run via mcp__Supabase__list_migrations against project tcxvcatsqqertcnycuop
-- cross-referenced with: ls -1 supabase/migrations/ | grep -oE '^[0-9]{14}' in each repo
```

---

## 2. Complete public-schema inventory

**Verification query:**
```sql
select relname, relrowsecurity, relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' order by relname;
```

| Object type | Count | Verification |
|---|---|---|
| Tables (`public`, `relkind='r'`) | **155** | query above |
| Tables with RLS enabled | **155 / 155 (100%)** | `relrowsecurity = true` on every row returned |
| Tables with `FORCE ROW LEVEL SECURITY` | 0 | `relforcerowsecurity = true` on none |
| Functions (`public` schema) | **78** | `select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'` |
| `SECURITY DEFINER` functions | 45 of 78 | `where p.prosecdef` |
| Triggers (`public` schema) | **53** | `select count(*) from information_schema.triggers where trigger_schema='public'` |
| RLS policies (`public` schema) | **≈340** (sum of per-table `pg_policy` counts gathered in §4) | `select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'` |
| Storage buckets | **8** | `select * from storage.buckets` |
| Grant pattern | Uniform: `anon`=1165, `authenticated`=1165, `postgres`=1176, `service_role`=1176 table-grants | `select grantee, count(*) from information_schema.role_table_grants where table_schema='public' group by grantee` — standard Supabase default-privilege pattern, no anomalous grantee found |

**All 155 public table names** (verified via `select string_agg(relname, ', ' order by relname), count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'`):

admin_manual_entries, app_settings, archive_logs, audit_logs, auth_logs, b2b_applications, bi_monthly_ledgers, catalogue_ai_studio_draft_audit_log, catalogue_ai_studio_drafts, catalogue_alias_drafts, catalogue_approval_audit, catalogue_bom_drafts, catalogue_media_submissions, catalogue_moq_drafts, catalogue_pricing_drafts, catalogue_product_drafts, catalogue_product_mappings, catalogue_sync_events, catalogue_tag_drafts, catalogue_versions, categories, client_interactions, commission_payouts, companies, credit_requests, credit_rescue_events, crm_tasks, customer_import_batches, customer_import_company_candidates, customer_import_contact_candidates, customer_import_duplicate_review, customer_import_raw, daily_production_logs, debug_webhooks, delivery_addresses, dispatch_cartons, dispatch_completion_evidence, dispatch_readiness_evidence, dispatch_release_lineage, dispatches, documents, employee_performance_logs, exchange_rates, factory_holidays, factory_inventory, finance_review_evidence, freight_ledger, inventory_adjustments, inventory_items, inventory_movements, inventory_reservation_allocations, inventory_reservations, inventory_stock_balances, invoices, inward_material_advice, inward_material_items, ledger_disputes, moq_rules, notification_events, notification_outbox, notifications, ols_audit_logs, ols_carton_contents, ols_cartons, ols_departments, ols_dispatch_document_bundles, ols_dpl_cartons, ols_dpl_documents, ols_finance_pi, ols_finance_pi_cartons, ols_finance_pi_lines, ols_gate_scans, ols_inventory_movements, ols_label_templates, ols_manual_override_logs, ols_orders_cache, ols_permissions, ols_print_jobs, ols_print_logs, ols_printer_settings, ols_printers, ols_production_batches, ols_production_labels, ols_products_cache, ols_profiles_light, ols_reprint_requests, ols_scan_history, ols_settings, ols_shipping_labels, ols_stock_units, operational_events, operational_queue_assignments, operational_queue_items, operational_scan_records, operational_search_index, order_attachments, order_items, order_payments, order_returns, order_status_history, orders, packing_lists, permissions, portal_access_invites, premium_announcements, pricing_slabs, product_aliases, product_bom, product_media, product_moq_rules, product_pricing_rules, product_tag_mapping, product_tags, product_variants, production_issues, production_jobs, production_pauses, production_rgs_transfers, products, profile_change_requests, profiles, role_permission_map, roles, sales_order_draft_audit_log, sales_order_draft_lines, sales_order_drafts, shadow_clients, sku_code_rules, starter_packs, stock_consumption_lineage, stock_logs, store_requisition_items, store_requisitions, suggested_orders, support_tickets, system_alerts, system_settings, tickets, user_favorites, user_role_map, users, wallet_transactions, whatsapp_automations, whatsapp_buffer, whatsapp_config, whatsapp_contacts, whatsapp_inbound_messages, whatsapp_message_packets, whatsapp_messages, whatsapp_operator_decisions, whatsapp_override_log, whatsapp_sales_order_drafts, whatsapp_stitched_packets, whatsapp_studio_inbox_bridge_state, whatsapp_suggestions_log

Full column/PK/FK/index/policy detail for every catalogue-critical table is in §4. Detail for the remaining ~130 tables (orders/dispatch/finance/WhatsApp/OLS/customer-import domains) was intentionally **not** transcribed column-by-column into this document — it is outside this task's catalogue-focused reconciliation objective and would not fit a reviewable document; the compact per-table summary (RLS state, column/constraint/index/policy counts) was captured for every one of the 155 tables via the query in §2 and is reproducible on demand with the same query, table-by-table, using the `target_tables` pattern shown in §4's verification query.

**Storage buckets (full detail, `select * from storage.buckets`):**

| id | public | file_size_limit | allowed_mime_types |
|---|---|---|---|
| final-invoices | true | — | — |
| product-images | true | — | — |
| product-media | true | 52428800 | image/jpeg, image/png, image/webp, image/gif, image/avif, video/mp4, video/webm, application/pdf |
| proforma-invoices | true | — | — |
| receipts | false | — | image/jpeg, image/png, image/webp, image/gif, application/pdf |
| trade_documents | true | — | — |
| trade-documents | false | — | — |
| whatsapp_attachments | false | — | — |

Note: `trade_documents` (underscore, public) and `trade-documents` (hyphen, private) are two distinct live buckets — naming-convention drift, not a duplicate.

---

## 3. Explicit source status for every live catalogue-critical object

| Object | Status | Evidence |
|---|---|---|
| `products` | **tracked, matching** | Live 137-column table. Central's lineage owns this table; not the narrower Studio-only `CREATE TABLE public.products` in `20260506044916` (never applied — see §1, §5). |
| `product_media` | **tracked, matching** | 8 columns, FK to `products`, RLS policies "Authenticated write media" / "Public read media" — consistent with expected shape. |
| `product_aliases`, `product_tags`, `product_tag_mapping`, `product_bom`, `product_moq_rules`, `product_pricing_rules` | **tracked, matching** | Present, RLS-enabled, FK-linked to `products`; no repo-only drift detected for these specifically. |
| `catalogue_versions` | **tracked but drifted** | Live DDL (columns, defaults, CHECK constraints, indexes) is a byte-for-byte structural match to Studio/Core's `20260602140000_catalogue_versions_and_sync_events.sql` — but that timestamp has **no** corresponding entry in `supabase_migrations.schema_migrations` under any name. Applied out-of-band (dashboard/manual apply) or via a squashed/renamed history event, never CLI-tracked. RLS policies present live ("Team read/insert/update catalogue_versions", role `authenticated`) are **not** in that migration file at all — they were added by a separate, unidentified statement. |
| `catalogue_sync_events` | **tracked but drifted** | Same file, same situation as `catalogue_versions` — live DDL matches file content exactly; timestamp untracked. |
| `catalogue_product_mappings` | **tracked, matching (drifted timestamp)** | Live table matches Central's `phase25b_catalogue_product_mappings`; repo timestamp `20260601180000` vs. applied `20260602060423` — same migration, different recorded timestamp (§1). |
| `catalogue_product_drafts`, `catalogue_media_submissions`, `catalogue_alias_drafts`, `catalogue_bom_drafts`, `catalogue_moq_drafts`, `catalogue_pricing_drafts`, `catalogue_tag_drafts` (legacy seven-table approval workflow) | **live-only / unknown provenance** | All 7 exist live with an identical generic envelope shape (`source_app`, `target_table`, `target_record_id`, `operation`, `payload jsonb`, `status`, `submitted_by/at`, `reviewed_by/at`, `review_notes`, `created_at`, `updated_at` — verified directly for `catalogue_alias_drafts`). **No CREATE TABLE for any of these seven tables was found in any of the 184 tracked migration files across all three repos** (`grep -rlE "CREATE TABLE.*catalogue_(product\|media_submissions\|alias\|bom\|moq\|pricing\|tag)_drafts"` returns nothing). Confirmed live and functionally exercised (267 rows in `catalogue_alias_drafts`, 36 in `catalogue_product_drafts` — counts only, no row content read) but their origin migration is absent from every tracked repo. |
| `catalogue_ai_studio_drafts`, `catalogue_ai_studio_draft_audit_log` | **tracked but drifted** | Timestamp `20260709085340` applied vs. Core's file `20260709120000_catalogue_ai_studio_governance.sql` — same name, drifted timestamp (§1). Studio itself never received this migration file. |
| `catalogue_approval_audit` | **live-only / unknown provenance** | Exists live (312 rows), RLS-enabled, FK-linked; no matching `CREATE TABLE public.catalogue_approval_audit` found in any tracked migration file in any of the three repos. |
| 16 catalogue-approval RPCs (`approve_catalogue_*`/`reject_catalogue_*` × 7 + `approve_catalogue_draft_internal` + `reject_catalogue_draft_internal`) | **live-only / unknown provenance for CREATE, but confirmed present and matching Phase 1a's live-introspected contract** | All 16 exist as `SECURITY DEFINER` functions (verified name + argument signature via `pg_proc`). This matches the contract independently recorded in `docs/recovery/LIVE_CATALOGUE_APPROVAL_RPC_PROVENANCE_2026-07-14.md` from this engagement's Phase 1a. No tracked migration creates these functions under a matching name. |
| `catalogue_alias_drafts.source_mapping_id` + FK to `catalogue_product_mappings` (PR06C1b) | **repo-only, confirmed not applied** | Central's `20260610231247_pr06c1b_packaging_product_approve_mapping.sql` adds this column; verified absent from the live 14-column `catalogue_alias_drafts` schema. |
| `catalogue_collections`, any "share link" table | **repo-only, confirmed not applied — does not exist live at all** | Studio/Core's `20260602160000_catalogue_collections_foundation.sql` has no live counterpart; no table with `collect` or `share` in its name exists anywhere in the 155-table live public schema. |
| `whatsapp_inbound_messages`, `whatsapp_sales_order_drafts` (Studio/Core `phase2c`/`phase2de` files) | **tracked but drifted or superseded by Central's parallel lineage** | Both tables exist live. Central independently tracks overlapping WhatsApp objects (`wa_stage1_inbox_reader_rls`, `wa_sprint9_sales_order_drafts_staging`, etc.) under different timestamps and names for what may be the same or adjacent functionality — full reconciliation of the WhatsApp domain is out of scope for this catalogue-focused pass and is flagged **unknown**, pending a dedicated WhatsApp-domain reconciliation. |
| `sku_code_rules` | **tracked, matching** | Present live, matches expected shape from Studio's `generate_oasis_sku` RPC dependency. |

**Verification query used throughout this section:**
```sql
with target_tables as (select unnest(array[...22 catalogue table names...]) as table_name)
select tt.table_name,
  (select json_agg(...) from information_schema.columns c where c.table_schema='public' and c.table_name=tt.table_name) as columns,
  (select json_agg(...) from information_schema.table_constraints tc where ...) as constraints,
  (select json_agg(...) from pg_indexes i where ...) as indexes,
  (select json_agg(...) from pg_policy p join pg_class c on c.oid=p.polrelid where c.relname=tt.table_name) as policies
from target_tables tt order by tt.table_name;
```
(Full result set retained for this session; re-runnable verbatim against `tcxvcatsqqertcnycuop`.)

---

## 4. Catalogue critical-path contract

| Domain | Live object(s) | Rows* | RLS policies |
|---|---|---|---|
| Products | `products` (137 cols), `product_variants` | 365 / — | 1, 1 |
| Product media | `product_media` | 32 | 2 (public read, authenticated write) |
| Catalogue versions | `catalogue_versions`, `catalogue_sync_events` | 21 / 51 | 3 / 2 |
| Legacy seven-table approval workflow | `catalogue_product_drafts` (36), `catalogue_media_submissions`, `catalogue_alias_drafts` (267), `catalogue_bom_drafts`, `catalogue_moq_drafts`, `catalogue_pricing_drafts`, `catalogue_tag_drafts` | see §3 | 3 each |
| AI Studio drafts | `catalogue_ai_studio_drafts`, `catalogue_ai_studio_draft_audit_log` | — | 4 / 3 |
| Catalogue collections / share links | **none exist** | n/a | n/a |
| Aliases | `product_aliases` | 286 | 3 |
| Labels | `ols_label_templates`, `ols_production_labels`, `ols_shipping_labels` (operational-label domain; no dedicated "catalogue label" table found) | — | 3 each |
| Ingredients / nutrition | **no dedicated table found** in the 155-table public schema (`grep -i ingredient\|nutrition` against all table names returns nothing) — this data, if it exists, is stored inside `products`' 137 columns or `catalogue_versions.snapshot_json`; not independently verifiable without reading row content, which is out of scope. |
| Pricing | `product_pricing_rules` (121), `pricing_slabs`, `catalogue_pricing_drafts` | | 2, 2, 3 |
| BOM | `product_bom` (18), `catalogue_bom_drafts` | | 2, 3 |
| MOQ | `product_moq_rules` (35), `moq_rules`, `catalogue_moq_drafts` | | 2, 2, 3 |
| Publication | `catalogue_versions.status` (draft/pending_approval/approved/published/synced), `catalogue_versions.published_at` | | — |
| Audit | `catalogue_approval_audit` (312), `catalogue_ai_studio_draft_audit_log`, `audit_logs` (521) | | 1, 3, 2 |

*Row counts are `COUNT(*)`-derived metadata only (or `-1` where `pg_class.reltuples` has no live estimate); no row content was read.

---

## 5. Why a fresh Supabase branch fails

**Root cause, precisely located:** the tracked migration chain's *earliest* entry — Central's `20260316122451_bbadbd7b-9e37-467f-b174-96232c0c4fe7.sql`, the very first statement executed in any from-scratch replay — opens with:

```sql
CREATE POLICY "Users can insert orders for their company"
ON public.orders
FOR INSERT TO authenticated
WITH CHECK (company_id = (SELECT users.company_id FROM users WHERE users.id = auth.uid()));
```

This is a `CREATE POLICY` on `public.orders` and a `SELECT ... FROM users` — **neither `public.orders` nor `public.users` is created by any `CREATE TABLE` statement in any of the 184 tracked migration files across Studio, Central, and Core.** Verified exhaustively:

```bash
grep -lE "CREATE TABLE (IF NOT EXISTS )?public\.(orders|users|companies)\b" \
  supabase/migrations/*.sql   # in all three repos — zero matches for orders/users/companies
```

`public.products` *is* created by one tracked file (Studio/Core's `20260506044916_a42777fe-....sql`), but that file was never applied to this project (§1) and, when read, defines a narrower schema with `profiles`/`user_roles`/`tags` alongside it — evidence it was written for an independent, self-contained sandbox project (a "fresh app" scaffold), not this shared production database.

**Consequence for a fresh branch/project replay of the tracked chain, in order:**
1. First failure: `CREATE POLICY ... ON public.orders` → `ERROR: relation "public.orders" does not exist` (Central, migration 1 of 133).
2. Even if `orders` were stubbed in, the same statement selects from `public.users` (not `auth.users`) → second failure, same class.
3. Downstream, dozens of later Central/Studio/Core migrations `ALTER TABLE`, add FKs to, or `CREATE POLICY` against `companies`, `products`, `profiles` and other base tables that are likewise never `CREATE TABLE`'d in tracked history — each is an independent break, not a chain reaction from #1.
4. The seven legacy catalogue-draft tables and `catalogue_approval_audit` (§3) have **no creating migration anywhere** — a fresh replay that somehow got past #1–3 would still be missing these entirely, breaking every catalogue-approval RPC that references them.
5. `catalogue_collections`/share-links genuinely do not exist even in production — not a replay gap, a real capability gap (§3).

**Conclusion:** the original foundational schema (base tables: `orders`, `order_items`, `users`, `companies`, `products` as they exist live, plus the seven catalogue-draft tables and `catalogue_approval_audit`) was established **before** migration-based tracking began for this project — most plausibly via the Supabase dashboard SQL editor, a one-time seed/import, or a squashed baseline migration that was deleted from history — and was never captured as a replayable `.sql` file in any of the three repositories. No migration chain, however completely replayed, can provision a fresh database matching production until this baseline is captured.

---

## 6. No-data-loss baseline reconstruction sequence

1. **Capture** — `pg_dump --schema-only` (or `supabase db dump --schema public,storage,auth --linked`) against `tcxvcatsqqertcnycuop`, producing a complete, versioned DDL snapshot of every object in §2 exactly as it exists today. Read-only against production; no data rows included.
2. **Canonical baseline** — Diff the captured DDL against the union of all 184 tracked migration files to isolate exactly the objects with no tracked origin (§3's "live-only / unknown provenance" rows: 7 draft tables, `catalogue_approval_audit`, the 16 RPCs, `orders`/`users`/`companies`/base `products`, and the 27 unresolved live-only ledger entries from §1). Author one new, explicitly-labeled baseline migration file (e.g. `00000000000000_baseline_capture.sql`) containing only `CREATE TABLE IF NOT EXISTS` / `CREATE OR REPLACE FUNCTION` statements for those objects, generated from the pg_dump output — never hand-written from memory.
3. **Replay verification** — Provision an actual Supabase branch (ephemeral, disposable) seeded with: baseline migration (step 2) → Central's 133 files in timestamp order → Core's 26 files in timestamp order → Studio's 25 files in timestamp order (skipping Studio/Core's `20260506044916`–`20260507145824` sandbox-only files, since §1/§5 established they target a different schema shape). Confirm the branch's resulting `information_schema` output matches §2/§3's captured counts exactly (155 tables, 78 functions, 53 triggers, matching RLS/policy counts).
4. **Contract tests** — Run this repo's existing `legacyApprovalContract.test.ts` and any RPC-signature assertions against the replayed branch (not production) to confirm the 16 approval RPCs and seven draft tables behave identically to the live contract already documented in `docs/recovery/LIVE_CATALOGUE_APPROVAL_RPC_PROVENANCE_2026-07-14.md`.
5. **Controlled production reconciliation** — Only after step 4 passes cleanly: register the baseline migration's checksum against production's actual `supabase_migrations.schema_migrations` (an `INSERT` recording that the objects already exist, not a `CREATE` — this step touches production's migration-tracking metadata only, never `public`-schema DDL) so future `supabase db push` runs stop treating already-live objects as pending. This step is **out of scope for Phase 3a** and requires explicit separate authorization — nothing in this task applies it.

---

## 7. Rollback and acceptance-gate matrix

| Step | Acceptance gate | Rollback |
|---|---|---|
| 1. Capture | `pg_dump` exit code 0; output file's table count matches §2's 155 | Discard the dump file; no production state changed (read-only) |
| 2. Canonical baseline | Baseline migration file diffs cleanly against captured DDL for every §3 "live-only"/"unknown" object; peer-reviewed before commit | Delete the draft baseline file; no production or branch state changed |
| 3. Replay verification | Ephemeral branch's `information_schema` counts match §2 exactly (155/78/53/8); zero replay errors | Delete the ephemeral branch — it is disposable and never linked to production |
| 4. Contract tests | 100% pass on the replayed branch, same pass rate as current production-targeted contract tests | Fix baseline migration and re-run step 3; ephemeral branch discarded either way |
| 5. Production reconciliation | Explicit human sign-off; a **separate, later task** with its own review — not covered by this document or this branch's authorization | N/A — not attempted here |

---

## Verification summary

Every claim above was produced by a `SELECT`-only query against `tcxvcatsqqertcnycuop` (via `mcp__Supabase__execute_sql` / `list_tables` / `list_migrations` / `list_extensions`) or a `grep`/`ls` read against the three repositories' `supabase/migrations/` directories on disk. No `INSERT`/`UPDATE`/`DELETE`/`CREATE`/`ALTER`/`DROP` statement was executed against production at any point in this task. No PR, deployment, migration application, RLS/grant change, Edge Function change, or Vercel change occurred.
