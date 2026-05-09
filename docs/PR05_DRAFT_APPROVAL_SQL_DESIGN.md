# PR-05 Draft/Approval SQL Design (Design-Only, DO-NOT-RUN)

## Scope
- SQL architecture proposal only.
- No SQL executed in this PR.
- No migration files created in this PR.
- No frontend business flow changes in this PR.

## Why draft/approval is required
Central currently has risky policy conditions (e.g., permissive `ALL true true` patterns and disabled RLS in key places), so Catalogue App must not rely only on frontend gating. Contributors should submit draft requests; only approved RPC paths should mutate master tables.

## Proposed additive draft tables
1. `catalogue_product_drafts`
2. `catalogue_media_submissions`
3. `catalogue_alias_drafts`
4. `catalogue_bom_drafts`
5. `catalogue_moq_drafts`
6. `catalogue_pricing_drafts`
7. `catalogue_tag_drafts`
8. `catalogue_approval_audit`

## Standard draft table shape (applies to each draft table)
Each draft table should include:
- `id uuid primary key`
- `source_app text default 'catalogue_app'`
- `target_table text`
- `target_record_id uuid null`
- `operation text check (operation in ('create','update','delete_request'))`
- `payload jsonb not null`
- `status text check (status in ('pending_approval','approved','rejected','cancelled')) default 'pending_approval'`
- `submitted_by uuid references auth.users(id)`
- `submitted_at timestamptz default now()`
- `reviewed_by uuid references auth.users(id) null`
- `reviewed_at timestamptz null`
- `review_notes text null`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

## Proposed permission seeds (design only)
### Role insert if missing
- `roles.role_key = 'catalogue_contributor'`
- `roles.role_name = 'Catalogue Contributor'`

### Permission insert if missing
- `catalogue.products.submit`
- `catalogue.media.submit`
- `catalogue.alias.submit`
- `catalogue.bom.submit`
- `catalogue.moq.submit`
- `catalogue.pricing.submit`
- `catalogue.tags.submit`
- `catalogue.approvals.read`
- `catalogue.approvals.review`

### Permission mapping intent
- Map all `catalogue.*.submit` permissions to `catalogue_contributor`.
- Map `catalogue.approvals.read` + `catalogue.approvals.review` to `super_admin`.
- Optionally map review permissions to `finance_head` and future product-manager-equivalent role if formally present.

## Proposed helper functions / RPCs (design only)
- `get_my_role_keys()`
- `has_permission(permission_key text)`
- `is_catalogue_reviewer()`
- `submit_catalogue_product_draft(payload jsonb, operation text, target_record_id uuid default null)`
- `approve_catalogue_product_draft(draft_id uuid)`
- `reject_catalogue_product_draft(draft_id uuid, reason text)`
- Similar submit/approve/reject functions for:
  - media
  - alias
  - bom
  - moq
  - pricing
  - tags

## Security model requirements
- Approval RPCs **must be SECURITY DEFINER**.
- Approval RPCs must verify reviewer permissions internally using Central permission tables.
- Contributors can only insert pending drafts for permitted modules.
- Contributors cannot update/delete Central master tables.
- Contributors cannot edit submitted drafts after submit, except optional own-cancel while status is `pending_approval`.
- Reviewer actions must stamp `reviewed_by`, `reviewed_at`, `review_notes`, and write to `catalogue_approval_audit`.

## Draft-table RLS design (future migration)
### SELECT
- Submitter can read own drafts.
- Reviewers can read all drafts.

### INSERT
- Authenticated users with relevant `catalogue.*.submit` permission only.
- `WITH CHECK`: `submitted_by = auth.uid()` and `status = 'pending_approval'`.

### UPDATE
- Reviewer-only updates for approval status + review fields.
- Optional submitter self-cancel (`status = 'cancelled'`) only when pending and only for own rows.

### DELETE
- No delete policy for authenticated users (preferred).
- Service role only (or effectively no delete path).

## Master-table hardening required later (NOT in PR-05)
- Remove permissive `ALL true true` style policies from `products`/`product_variants` in approved migration.
- Enable RLS on `profiles` after compatibility validation.
- Restrict direct writes to approved roles and audited RPC paths.

## Proposed DO-NOT-RUN SQL skeleton (for review)
```sql
-- DO-NOT-RUN (design sketch only)
-- create table public.catalogue_product_drafts (...);
-- create table public.catalogue_media_submissions (...);
-- create table public.catalogue_alias_drafts (...);
-- create table public.catalogue_bom_drafts (...);
-- create table public.catalogue_moq_drafts (...);
-- create table public.catalogue_pricing_drafts (...);
-- create table public.catalogue_tag_drafts (...);
-- create table public.catalogue_approval_audit (...);

-- DO-NOT-RUN role/permission seeding sketches
-- insert into roles (role_key, role_name) values ('catalogue_contributor','Catalogue Contributor') on conflict do nothing;
-- insert into permissions (...) values (...);
-- insert into role_permission_map (...) select ...;

-- DO-NOT-RUN function sketches
-- create or replace function public.get_my_role_keys() returns text[] ...;
-- create or replace function public.has_permission(permission_key text) returns boolean ...;
-- create or replace function public.is_catalogue_reviewer() returns boolean ...;
-- create or replace function public.submit_catalogue_product_draft(...) returns uuid ...;
-- create or replace function public.approve_catalogue_product_draft(...) returns void security definer ...;
-- create or replace function public.reject_catalogue_product_draft(...) returns void security definer ...;
```

## PR-06 recommendation
After owner approval, create an additive migration containing:
1. Draft tables + audit table
2. Role/permission seed inserts
3. RLS policies for draft tables
4. SECURITY DEFINER approval/reject RPCs with internal permission checks
5. No breaking changes to existing master-table structures in first rollout
