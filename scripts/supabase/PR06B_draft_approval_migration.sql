BEGIN;

-- PR-06B Executable Migration (Do not execute from this environment)
-- Scope: additive draft/approval layer only.
-- Excludes: master table RLS hardening (products/product_variants/profiles), frontend changes.

create extension if not exists pgcrypto;

-- 1) Role seed: catalogue_contributor
insert into public.roles (role_key, role_name)
select 'catalogue_contributor', 'Catalogue Contributor'
where not exists (
  select 1 from public.roles r where r.role_key = 'catalogue_contributor'
);

-- 2) Permission seeds (confirmed columns)
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
    ('catalogue.approvals.read', 'catalogue', 'Read catalogue approvals'),
    ('catalogue.approvals.review', 'catalogue', 'Review and approve/reject catalogue drafts')
) as v(permission_key, module_name, permission_name)
where not exists (
  select 1 from public.permissions p where p.permission_key = v.permission_key
);

-- 3) Role-permission mapping
insert into public.role_permission_map (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.permission_key in (
  'catalogue.products.submit','catalogue.media.submit','catalogue.alias.submit',
  'catalogue.bom.submit','catalogue.moq.submit','catalogue.pricing.submit','catalogue.tags.submit'
)
where r.role_key = 'catalogue_contributor'
  and not exists (
    select 1 from public.role_permission_map rpm
    where rpm.role_id = r.id and rpm.permission_id = p.id
  );

insert into public.role_permission_map (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.permission_key in ('catalogue.approvals.read','catalogue.approvals.review')
where r.role_key = 'super_admin'
  and not exists (
    select 1 from public.role_permission_map rpm
    where rpm.role_id = r.id and rpm.permission_id = p.id
  );

-- 4) Draft tables
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

create table if not exists public.catalogue_media_submissions (like public.catalogue_product_drafts including defaults including constraints);
create table if not exists public.catalogue_alias_drafts (like public.catalogue_product_drafts including defaults including constraints);
create table if not exists public.catalogue_bom_drafts (like public.catalogue_product_drafts including defaults including constraints);
create table if not exists public.catalogue_moq_drafts (like public.catalogue_product_drafts including defaults including constraints);
create table if not exists public.catalogue_pricing_drafts (like public.catalogue_product_drafts including defaults including constraints);
create table if not exists public.catalogue_tag_drafts (like public.catalogue_product_drafts including defaults including constraints);

create table if not exists public.catalogue_approval_audit (
  id uuid primary key default gen_random_uuid(),
  source_app text not null default 'catalogue_app',
  draft_table text not null,
  draft_id uuid not null,
  action text not null check (action in ('approved','rejected','cancelled')),
  performed_by uuid not null references auth.users(id),
  payload_snapshot jsonb null,
  before_snapshot jsonb null,
  after_snapshot jsonb null,
  notes text null,
  created_at timestamptz not null default now()
);

-- 5) Indexes
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
create index if not exists idx_catalogue_approval_audit_actor on public.catalogue_approval_audit(performed_by);
create index if not exists idx_catalogue_approval_audit_created_at on public.catalogue_approval_audit(created_at);

-- 6) RLS enablement (draft tables only)
alter table public.catalogue_product_drafts enable row level security;
alter table public.catalogue_media_submissions enable row level security;
alter table public.catalogue_alias_drafts enable row level security;
alter table public.catalogue_bom_drafts enable row level security;
alter table public.catalogue_moq_drafts enable row level security;
alter table public.catalogue_pricing_drafts enable row level security;
alter table public.catalogue_tag_drafts enable row level security;
alter table public.catalogue_approval_audit enable row level security;

-- 7) Helper functions
create or replace function public.get_my_role_keys()
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
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
set search_path = public, pg_temp
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
set search_path = public, pg_temp
as $$
  select public.has_catalogue_permission('catalogue.approvals.review');
$$;

-- 8) Complete RLS policies for all draft tables
-- Product
DROP POLICY IF EXISTS catalogue_app_product_drafts_select_own ON public.catalogue_product_drafts;
create policy catalogue_app_product_drafts_select_own on public.catalogue_product_drafts for select to authenticated using (submitted_by = auth.uid());
DROP POLICY IF EXISTS catalogue_app_product_drafts_reviewer_select ON public.catalogue_product_drafts;
create policy catalogue_app_product_drafts_reviewer_select on public.catalogue_product_drafts for select to authenticated using (public.is_catalogue_reviewer());
DROP POLICY IF EXISTS catalogue_app_product_drafts_insert_submitter ON public.catalogue_product_drafts;
create policy catalogue_app_product_drafts_insert_submitter on public.catalogue_product_drafts for insert to authenticated with check (submitted_by = auth.uid() and status = 'pending_approval' and public.has_catalogue_permission('catalogue.products.submit'));

-- Media
DROP POLICY IF EXISTS catalogue_app_media_submissions_select_own ON public.catalogue_media_submissions;
create policy catalogue_app_media_submissions_select_own on public.catalogue_media_submissions for select to authenticated using (submitted_by = auth.uid());
DROP POLICY IF EXISTS catalogue_app_media_submissions_reviewer_select ON public.catalogue_media_submissions;
create policy catalogue_app_media_submissions_reviewer_select on public.catalogue_media_submissions for select to authenticated using (public.is_catalogue_reviewer());
DROP POLICY IF EXISTS catalogue_app_media_submissions_insert_submitter ON public.catalogue_media_submissions;
create policy catalogue_app_media_submissions_insert_submitter on public.catalogue_media_submissions for insert to authenticated with check (submitted_by = auth.uid() and status = 'pending_approval' and public.has_catalogue_permission('catalogue.media.submit'));

-- Alias
DROP POLICY IF EXISTS catalogue_app_alias_drafts_select_own ON public.catalogue_alias_drafts;
create policy catalogue_app_alias_drafts_select_own on public.catalogue_alias_drafts for select to authenticated using (submitted_by = auth.uid());
DROP POLICY IF EXISTS catalogue_app_alias_drafts_reviewer_select ON public.catalogue_alias_drafts;
create policy catalogue_app_alias_drafts_reviewer_select on public.catalogue_alias_drafts for select to authenticated using (public.is_catalogue_reviewer());
DROP POLICY IF EXISTS catalogue_app_alias_drafts_insert_submitter ON public.catalogue_alias_drafts;
create policy catalogue_app_alias_drafts_insert_submitter on public.catalogue_alias_drafts for insert to authenticated with check (submitted_by = auth.uid() and status = 'pending_approval' and public.has_catalogue_permission('catalogue.alias.submit'));

-- BOM
DROP POLICY IF EXISTS catalogue_app_bom_drafts_select_own ON public.catalogue_bom_drafts;
create policy catalogue_app_bom_drafts_select_own on public.catalogue_bom_drafts for select to authenticated using (submitted_by = auth.uid());
DROP POLICY IF EXISTS catalogue_app_bom_drafts_reviewer_select ON public.catalogue_bom_drafts;
create policy catalogue_app_bom_drafts_reviewer_select on public.catalogue_bom_drafts for select to authenticated using (public.is_catalogue_reviewer());
DROP POLICY IF EXISTS catalogue_app_bom_drafts_insert_submitter ON public.catalogue_bom_drafts;
create policy catalogue_app_bom_drafts_insert_submitter on public.catalogue_bom_drafts for insert to authenticated with check (submitted_by = auth.uid() and status = 'pending_approval' and public.has_catalogue_permission('catalogue.bom.submit'));

-- MOQ
DROP POLICY IF EXISTS catalogue_app_moq_drafts_select_own ON public.catalogue_moq_drafts;
create policy catalogue_app_moq_drafts_select_own on public.catalogue_moq_drafts for select to authenticated using (submitted_by = auth.uid());
DROP POLICY IF EXISTS catalogue_app_moq_drafts_reviewer_select ON public.catalogue_moq_drafts;
create policy catalogue_app_moq_drafts_reviewer_select on public.catalogue_moq_drafts for select to authenticated using (public.is_catalogue_reviewer());
DROP POLICY IF EXISTS catalogue_app_moq_drafts_insert_submitter ON public.catalogue_moq_drafts;
create policy catalogue_app_moq_drafts_insert_submitter on public.catalogue_moq_drafts for insert to authenticated with check (submitted_by = auth.uid() and status = 'pending_approval' and public.has_catalogue_permission('catalogue.moq.submit'));

-- Pricing
DROP POLICY IF EXISTS catalogue_app_pricing_drafts_select_own ON public.catalogue_pricing_drafts;
create policy catalogue_app_pricing_drafts_select_own on public.catalogue_pricing_drafts for select to authenticated using (submitted_by = auth.uid());
DROP POLICY IF EXISTS catalogue_app_pricing_drafts_reviewer_select ON public.catalogue_pricing_drafts;
create policy catalogue_app_pricing_drafts_reviewer_select on public.catalogue_pricing_drafts for select to authenticated using (public.is_catalogue_reviewer());
DROP POLICY IF EXISTS catalogue_app_pricing_drafts_insert_submitter ON public.catalogue_pricing_drafts;
create policy catalogue_app_pricing_drafts_insert_submitter on public.catalogue_pricing_drafts for insert to authenticated with check (submitted_by = auth.uid() and status = 'pending_approval' and public.has_catalogue_permission('catalogue.pricing.submit'));

-- Tags
DROP POLICY IF EXISTS catalogue_app_tag_drafts_select_own ON public.catalogue_tag_drafts;
create policy catalogue_app_tag_drafts_select_own on public.catalogue_tag_drafts for select to authenticated using (submitted_by = auth.uid());
DROP POLICY IF EXISTS catalogue_app_tag_drafts_reviewer_select ON public.catalogue_tag_drafts;
create policy catalogue_app_tag_drafts_reviewer_select on public.catalogue_tag_drafts for select to authenticated using (public.is_catalogue_reviewer());
DROP POLICY IF EXISTS catalogue_app_tag_drafts_insert_submitter ON public.catalogue_tag_drafts;
create policy catalogue_app_tag_drafts_insert_submitter on public.catalogue_tag_drafts for insert to authenticated with check (submitted_by = auth.uid() and status = 'pending_approval' and public.has_catalogue_permission('catalogue.tags.submit'));

-- Approval audit
DROP POLICY IF EXISTS catalogue_app_approval_audit_reviewer_select ON public.catalogue_approval_audit;
create policy catalogue_app_approval_audit_reviewer_select on public.catalogue_approval_audit for select to authenticated using (public.is_catalogue_reviewer());
DROP POLICY IF EXISTS catalogue_app_approval_audit_reviewer_insert ON public.catalogue_approval_audit;
create policy catalogue_app_approval_audit_reviewer_insert on public.catalogue_approval_audit for insert to authenticated with check (public.is_catalogue_reviewer() and performed_by = auth.uid());

-- No DELETE policies. No direct reviewer UPDATE policies.

-- 9) Generic reject helper (functional)
create or replace function public.reject_catalogue_draft(
  draft_table text,
  draft_id uuid,
  reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rec record;
  sql_text text;
  before_row jsonb;
  after_row jsonb;
begin
  if not public.is_catalogue_reviewer() then
    raise exception 'Not authorized to review catalogue drafts';
  end if;

  sql_text := format('select * from %I where id = $1 for update', draft_table);
  execute sql_text into rec using draft_id;

  if rec is null then
    raise exception 'Draft not found in %', draft_table;
  end if;

  if rec.status <> 'pending_approval' then
    raise exception 'Only pending drafts can be rejected';
  end if;

  before_row := to_jsonb(rec);

  sql_text := format('update %I set status = ''rejected'', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = $1, updated_at = now() where id = $2 returning to_jsonb(%I.*)', draft_table, draft_table);
  execute sql_text into after_row using reason, draft_id;

  insert into public.catalogue_approval_audit (draft_table, draft_id, action, performed_by, payload_snapshot, before_snapshot, after_snapshot, notes)
  values (draft_table, draft_id, 'rejected', auth.uid(), before_row->'payload', before_row, after_row, reason);
end;
$$;

-- 10) Approve / Reject wrappers for each table
create or replace function public.approve_catalogue_product_draft(draft_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_catalogue_reviewer() then raise exception 'Not authorized to review catalogue drafts'; end if;
  raise exception 'Product approval mapping not finalized';
end; $$;

create or replace function public.reject_catalogue_product_draft(draft_id uuid, reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.reject_catalogue_draft('catalogue_product_drafts', draft_id, reason);
end; $$;

create or replace function public.approve_catalogue_media_submission(draft_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_catalogue_reviewer() then raise exception 'Not authorized to review catalogue drafts'; end if;
  raise exception 'Approval mapping not finalized for this draft type';
end; $$;

create or replace function public.reject_catalogue_media_submission(draft_id uuid, reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$ begin perform public.reject_catalogue_draft('catalogue_media_submissions', draft_id, reason); end; $$;

create or replace function public.approve_catalogue_alias_draft(draft_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$ begin if not public.is_catalogue_reviewer() then raise exception 'Not authorized to review catalogue drafts'; end if; raise exception 'Approval mapping not finalized for this draft type'; end; $$;
create or replace function public.reject_catalogue_alias_draft(draft_id uuid, reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$ begin perform public.reject_catalogue_draft('catalogue_alias_drafts', draft_id, reason); end; $$;

create or replace function public.approve_catalogue_bom_draft(draft_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$ begin if not public.is_catalogue_reviewer() then raise exception 'Not authorized to review catalogue drafts'; end if; raise exception 'Approval mapping not finalized for this draft type'; end; $$;
create or replace function public.reject_catalogue_bom_draft(draft_id uuid, reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$ begin perform public.reject_catalogue_draft('catalogue_bom_drafts', draft_id, reason); end; $$;

create or replace function public.approve_catalogue_moq_draft(draft_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$ begin if not public.is_catalogue_reviewer() then raise exception 'Not authorized to review catalogue drafts'; end if; raise exception 'Approval mapping not finalized for this draft type'; end; $$;
create or replace function public.reject_catalogue_moq_draft(draft_id uuid, reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$ begin perform public.reject_catalogue_draft('catalogue_moq_drafts', draft_id, reason); end; $$;

create or replace function public.approve_catalogue_pricing_draft(draft_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$ begin if not public.is_catalogue_reviewer() then raise exception 'Not authorized to review catalogue drafts'; end if; raise exception 'Approval mapping not finalized for this draft type'; end; $$;
create or replace function public.reject_catalogue_pricing_draft(draft_id uuid, reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$ begin perform public.reject_catalogue_draft('catalogue_pricing_drafts', draft_id, reason); end; $$;

create or replace function public.approve_catalogue_tag_draft(draft_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$ begin if not public.is_catalogue_reviewer() then raise exception 'Not authorized to review catalogue drafts'; end if; raise exception 'Approval mapping not finalized for this draft type'; end; $$;
create or replace function public.reject_catalogue_tag_draft(draft_id uuid, reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$ begin perform public.reject_catalogue_draft('catalogue_tag_drafts', draft_id, reason); end; $$;

-- 11) Function grants (app-callable)
GRANT EXECUTE ON FUNCTION public.get_my_role_keys() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_catalogue_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_catalogue_reviewer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_catalogue_draft(text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_catalogue_product_draft(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_catalogue_product_draft(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_catalogue_media_submission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_catalogue_media_submission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_catalogue_alias_draft(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_catalogue_alias_draft(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_catalogue_bom_draft(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_catalogue_bom_draft(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_catalogue_moq_draft(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_catalogue_moq_draft(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_catalogue_pricing_draft(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_catalogue_pricing_draft(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_catalogue_tag_draft(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_catalogue_tag_draft(uuid, text) TO authenticated;

-- 12) Verification queries (SELECT-only; run manually post-migration)
-- select id, role_key, role_name from public.roles where role_key = 'catalogue_contributor';
-- select permission_key, module_name, permission_name from public.permissions where permission_key like 'catalogue.%' order by permission_key;
-- select schemaname, tablename from pg_tables where schemaname='public' and tablename like 'catalogue_%' order by tablename;
-- select schemaname, tablename, policyname from pg_policies where schemaname='public' and tablename like 'catalogue_%' order by tablename, policyname;
-- select n.nspname as schema_name, p.proname as function_name, p.prosecdef as security_definer
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname like '%catalogue%'
-- order by p.proname;

-- Notes:
-- - No app_role enum usage.
-- - No user_roles table usage.
-- - No master table RLS policy changes included.

COMMIT;
