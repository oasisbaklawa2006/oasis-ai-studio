-- ============================================================================
-- PR-06A DO-NOT-RUN DRAFT MIGRATION
-- FILE: scripts/supabase/PR06A_DO_NOT_RUN_draft_approval_migration.sql
-- PURPOSE: Draft-only additive migration design for catalogue draft/approval flow.
-- STATUS: DO NOT RUN until owner review, schema verification, and PR-06B approval.
-- ============================================================================

-- -----------------------------
-- EXTENSIONS / PREREQUISITES
-- -----------------------------
-- DO-NOT-RUN NOTE:
-- Verify pgcrypto extension availability for gen_random_uuid().
-- create extension if not exists pgcrypto;

-- -----------------------------
-- 1) ROLE SEED (ADDITIVE)
-- -----------------------------
-- DO-NOT-RUN: verify roles table unique keys and required columns before execution.
insert into public.roles (role_key, role_name)
select 'catalogue_contributor', 'Catalogue Contributor'
where not exists (
  select 1 from public.roles r where r.role_key = 'catalogue_contributor'
);

-- -----------------------------
-- 2) PERMISSION SEEDS (ADDITIVE)
-- -----------------------------
-- IMPORTANT: VERIFY permissions table columns before execution.
-- This draft assumes columns similar to:
--   permission_key, module_name, permission_name
-- If Central schema differs, adjust INSERT column list before execution.

insert into public.permissions (permission_key, module_name, permission_name)
select v.permission_key, v.module_name, v.permission_name
from (
  values
    ('catalogue.products.submit', 'catalogue', 'Submit product draft'),
    ('catalogue.media.submit', 'catalogue', 'Submit media draft'),
    ('catalogue.alias.submit', 'catalogue', 'Submit alias draft'),
    ('catalogue.bom.submit', 'catalogue', 'Submit BOM draft'),
    ('catalogue.moq.submit', 'catalogue', 'Submit MOQ draft'),
    ('catalogue.pricing.submit', 'catalogue', 'Submit pricing draft'),
    ('catalogue.tags.submit', 'catalogue', 'Submit tag draft'),
    ('catalogue.approvals.read', 'catalogue', 'Read approval inbox'),
    ('catalogue.approvals.review', 'catalogue', 'Approve or reject draft submissions')
) as v(permission_key, module_name, permission_name)
where not exists (
  select 1 from public.permissions p where p.permission_key = v.permission_key
);

-- OPTIONAL mapping sketch (DO-NOT-RUN until role/permission schema verified)
-- Map submit permissions to catalogue_contributor.
-- Map approval permissions to super_admin.
-- Optionally map approval permissions to finance_head / future product manager role.

-- -----------------------------
-- 3) DRAFT TABLES (ADDITIVE)
-- -----------------------------

create table if not exists public.catalogue_product_drafts (
  id uuid primary key default gen_random_uuid(),
  source_app text not null default 'catalogue_app',
  target_table text not null,
  target_record_id uuid null,
  operation text not null check (operation in ('create','update','delete_request')),
  payload jsonb not null,
  status text not null default 'pending_approval' check (status in ('pending_approval','approved','rejected','cancelled')),
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid null references auth.users(id),
  reviewed_at timestamptz null,
  review_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalogue_media_submissions (
  like public.catalogue_product_drafts including defaults including constraints
);

create table if not exists public.catalogue_alias_drafts (
  like public.catalogue_product_drafts including defaults including constraints
);

create table if not exists public.catalogue_bom_drafts (
  like public.catalogue_product_drafts including defaults including constraints
);

create table if not exists public.catalogue_moq_drafts (
  like public.catalogue_product_drafts including defaults including constraints
);

create table if not exists public.catalogue_pricing_drafts (
  like public.catalogue_product_drafts including defaults including constraints
);

create table if not exists public.catalogue_tag_drafts (
  like public.catalogue_product_drafts including defaults including constraints
);

create table if not exists public.catalogue_approval_audit (
  id uuid primary key default gen_random_uuid(),
  source_app text not null default 'catalogue_app',
  draft_table text not null,
  draft_id uuid not null,
  action text not null check (action in ('approved','rejected','cancelled')),
  actor_id uuid not null references auth.users(id),
  notes text null,
  snapshot jsonb null,
  created_at timestamptz not null default now()
);

-- -----------------------------
-- 4) INDEXES
-- -----------------------------

create index if not exists idx_catalogue_product_drafts_status on public.catalogue_product_drafts(status);
create index if not exists idx_catalogue_product_drafts_submitted_by on public.catalogue_product_drafts(submitted_by);
create index if not exists idx_catalogue_product_drafts_target_record_id on public.catalogue_product_drafts(target_record_id);
create index if not exists idx_catalogue_product_drafts_created_at on public.catalogue_product_drafts(created_at);
create index if not exists gin_catalogue_product_drafts_payload on public.catalogue_product_drafts using gin (payload);

create index if not exists idx_catalogue_media_submissions_status on public.catalogue_media_submissions(status);
create index if not exists idx_catalogue_media_submissions_submitted_by on public.catalogue_media_submissions(submitted_by);
create index if not exists idx_catalogue_media_submissions_target_record_id on public.catalogue_media_submissions(target_record_id);
create index if not exists idx_catalogue_media_submissions_created_at on public.catalogue_media_submissions(created_at);
create index if not exists gin_catalogue_media_submissions_payload on public.catalogue_media_submissions using gin (payload);

create index if not exists idx_catalogue_alias_drafts_status on public.catalogue_alias_drafts(status);
create index if not exists idx_catalogue_alias_drafts_submitted_by on public.catalogue_alias_drafts(submitted_by);
create index if not exists idx_catalogue_alias_drafts_target_record_id on public.catalogue_alias_drafts(target_record_id);
create index if not exists idx_catalogue_alias_drafts_created_at on public.catalogue_alias_drafts(created_at);
create index if not exists gin_catalogue_alias_drafts_payload on public.catalogue_alias_drafts using gin (payload);

create index if not exists idx_catalogue_bom_drafts_status on public.catalogue_bom_drafts(status);
create index if not exists idx_catalogue_bom_drafts_submitted_by on public.catalogue_bom_drafts(submitted_by);
create index if not exists idx_catalogue_bom_drafts_target_record_id on public.catalogue_bom_drafts(target_record_id);
create index if not exists idx_catalogue_bom_drafts_created_at on public.catalogue_bom_drafts(created_at);
create index if not exists gin_catalogue_bom_drafts_payload on public.catalogue_bom_drafts using gin (payload);

create index if not exists idx_catalogue_moq_drafts_status on public.catalogue_moq_drafts(status);
create index if not exists idx_catalogue_moq_drafts_submitted_by on public.catalogue_moq_drafts(submitted_by);
create index if not exists idx_catalogue_moq_drafts_target_record_id on public.catalogue_moq_drafts(target_record_id);
create index if not exists idx_catalogue_moq_drafts_created_at on public.catalogue_moq_drafts(created_at);
create index if not exists gin_catalogue_moq_drafts_payload on public.catalogue_moq_drafts using gin (payload);

create index if not exists idx_catalogue_pricing_drafts_status on public.catalogue_pricing_drafts(status);
create index if not exists idx_catalogue_pricing_drafts_submitted_by on public.catalogue_pricing_drafts(submitted_by);
create index if not exists idx_catalogue_pricing_drafts_target_record_id on public.catalogue_pricing_drafts(target_record_id);
create index if not exists idx_catalogue_pricing_drafts_created_at on public.catalogue_pricing_drafts(created_at);
create index if not exists gin_catalogue_pricing_drafts_payload on public.catalogue_pricing_drafts using gin (payload);

create index if not exists idx_catalogue_tag_drafts_status on public.catalogue_tag_drafts(status);
create index if not exists idx_catalogue_tag_drafts_submitted_by on public.catalogue_tag_drafts(submitted_by);
create index if not exists idx_catalogue_tag_drafts_target_record_id on public.catalogue_tag_drafts(target_record_id);
create index if not exists idx_catalogue_tag_drafts_created_at on public.catalogue_tag_drafts(created_at);
create index if not exists gin_catalogue_tag_drafts_payload on public.catalogue_tag_drafts using gin (payload);

create index if not exists idx_catalogue_approval_audit_draft on public.catalogue_approval_audit(draft_table, draft_id);
create index if not exists idx_catalogue_approval_audit_actor on public.catalogue_approval_audit(actor_id);
create index if not exists idx_catalogue_approval_audit_created_at on public.catalogue_approval_audit(created_at);

-- -----------------------------
-- 5) ENABLE RLS + POLICIES
-- -----------------------------

alter table public.catalogue_product_drafts enable row level security;
alter table public.catalogue_media_submissions enable row level security;
alter table public.catalogue_alias_drafts enable row level security;
alter table public.catalogue_bom_drafts enable row level security;
alter table public.catalogue_moq_drafts enable row level security;
alter table public.catalogue_pricing_drafts enable row level security;
alter table public.catalogue_tag_drafts enable row level security;
alter table public.catalogue_approval_audit enable row level security;

-- 6) HELPER FUNCTIONS (SECURITY DEFINER)
create or replace function public.get_my_role_keys()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(r.role_key), '{}')
  from public.user_role_map urm
  join public.roles r on r.id = urm.role_id
  where urm.user_id = auth.uid();
$$;

create or replace function public.has_catalogue_permission(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_role_map urm
    join public.role_permission_map rpm on rpm.role_id = urm.role_id
    join public.permissions p on p.id = rpm.permission_id
    where urm.user_id = auth.uid()
      and p.permission_key = has_catalogue_permission.permission_key
  );
$$;

create or replace function public.is_catalogue_reviewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_catalogue_permission('catalogue.approvals.review');
$$;

-- Policy templates for each draft table
-- Submitter SELECT own + reviewer SELECT all
create policy catalogue_product_drafts_select
on public.catalogue_product_drafts
for select
to authenticated
using (
  submitted_by = auth.uid() or public.is_catalogue_reviewer()
);

create policy catalogue_product_drafts_insert
on public.catalogue_product_drafts
for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and status = 'pending_approval'
  and public.has_catalogue_permission('catalogue.products.submit')
);

create policy catalogue_product_drafts_reviewer_update
on public.catalogue_product_drafts
for update
to authenticated
using (public.is_catalogue_reviewer())
with check (public.is_catalogue_reviewer());

create policy catalogue_product_drafts_submitter_cancel
on public.catalogue_product_drafts
for update
to authenticated
using (submitted_by = auth.uid() and status = 'pending_approval')
with check (submitted_by = auth.uid() and status = 'cancelled');

-- TODO: replicate equivalent SELECT/INSERT/UPDATE policies for:
--   catalogue_media_submissions (submit permission: catalogue.media.submit)
--   catalogue_alias_drafts (submit permission: catalogue.alias.submit)
--   catalogue_bom_drafts (submit permission: catalogue.bom.submit)
--   catalogue_moq_drafts (submit permission: catalogue.moq.submit)
--   catalogue_pricing_drafts (submit permission: catalogue.pricing.submit)
--   catalogue_tag_drafts (submit permission: catalogue.tags.submit)
-- No DELETE policy should be created for authenticated users.

-- Audit table policies
create policy catalogue_approval_audit_select
on public.catalogue_approval_audit
for select
to authenticated
using (public.is_catalogue_reviewer());

create policy catalogue_approval_audit_insert
on public.catalogue_approval_audit
for insert
to authenticated
with check (public.is_catalogue_reviewer() and actor_id = auth.uid());

-- -----------------------------
-- 7) APPROVAL FUNCTIONS (SKELETON)
-- -----------------------------

create or replace function public.approve_catalogue_product_draft(draft_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.catalogue_product_drafts%rowtype;
begin
  if not public.is_catalogue_reviewer() then
    raise exception 'Not authorized to review catalogue drafts';
  end if;

  select * into d
  from public.catalogue_product_drafts
  where id = draft_id
  for update;

  if not found then
    raise exception 'Draft not found';
  end if;

  if d.status <> 'pending_approval' then
    raise exception 'Only pending drafts can be approved';
  end if;

  -- Conservative mapping until Central products schema mapping is finalized.
  if d.operation = 'create' then
    if (d.payload ? 'product_name') and (d.payload ? 'sku') then
      -- DO-NOT-RUN DRAFT LOGIC:
      -- insert into public.products(product_name, sku)
      -- values (d.payload->>'product_name', d.payload->>'sku');
      raise exception 'DO-NOT-RUN: product create mapping not finalized for Central schema';
    else
      raise exception 'Payload missing required minimal fields for product create';
    end if;
  else
    raise exception 'DO-NOT-RUN: update/delete_request mapping not finalized for Central schema';
  end if;

  update public.catalogue_product_drafts
  set status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = d.id;

  insert into public.catalogue_approval_audit (draft_table, draft_id, action, actor_id, notes, snapshot)
  values ('catalogue_product_drafts', d.id, 'approved', auth.uid(), 'Approved via draft function', to_jsonb(d));
end;
$$;

create or replace function public.reject_catalogue_product_draft(draft_id uuid, reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.catalogue_product_drafts%rowtype;
begin
  if not public.is_catalogue_reviewer() then
    raise exception 'Not authorized to review catalogue drafts';
  end if;

  select * into d
  from public.catalogue_product_drafts
  where id = draft_id
  for update;

  if not found then
    raise exception 'Draft not found';
  end if;

  if d.status <> 'pending_approval' then
    raise exception 'Only pending drafts can be rejected';
  end if;

  update public.catalogue_product_drafts
  set status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = reason,
      updated_at = now()
  where id = d.id;

  insert into public.catalogue_approval_audit (draft_table, draft_id, action, actor_id, notes, snapshot)
  values ('catalogue_product_drafts', d.id, 'rejected', auth.uid(), reason, to_jsonb(d));
end;
$$;

-- TODO patterns for future approval/reject functions:
--   approve_catalogue_media_draft(draft_id uuid)
--   reject_catalogue_media_draft(draft_id uuid, reason text)
--   approve_catalogue_alias_draft(draft_id uuid)
--   reject_catalogue_alias_draft(draft_id uuid, reason text)
--   approve_catalogue_bom_draft(draft_id uuid)
--   reject_catalogue_bom_draft(draft_id uuid, reason text)
--   approve_catalogue_moq_draft(draft_id uuid)
--   reject_catalogue_moq_draft(draft_id uuid, reason text)
--   approve_catalogue_pricing_draft(draft_id uuid)
--   reject_catalogue_pricing_draft(draft_id uuid, reason text)
--   approve_catalogue_tag_draft(draft_id uuid)
--   reject_catalogue_tag_draft(draft_id uuid, reason text)

-- -----------------------------
-- 8) MASTER TABLE SAFETY NOTE
-- -----------------------------
-- Intentionally NOT changing master table schemas/policies in PR-06A draft.
-- products/product_variants permissive policy risks and profiles RLS hardening are deferred.

-- ============================================================================
-- END (DO-NOT-RUN DRAFT)
-- ============================================================================
