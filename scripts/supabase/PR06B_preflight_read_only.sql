-- PR-06B Preflight Check — READ ONLY

-- 1. Check existing catalogue draft tables
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'catalogue_product_drafts',
    'catalogue_media_submissions',
    'catalogue_alias_drafts',
    'catalogue_bom_drafts',
    'catalogue_moq_drafts',
    'catalogue_pricing_drafts',
    'catalogue_tag_drafts',
    'catalogue_approval_audit'
  )
order by table_name;

-- 2. Check existing catalogue role
select
  id,
  role_key,
  role_name,
  is_active
from public.roles
where role_key = 'catalogue_contributor';

-- 3. Check existing catalogue permissions
select
  id,
  permission_key,
  module_name,
  permission_name
from public.permissions
where permission_key like 'catalogue.%'
order by permission_key;

-- 4. Check existing catalogue policies
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and (
    tablename like 'catalogue_%'
    or policyname like 'catalogue_app_%'
  )
order by tablename, policyname;

-- 5. Check existing catalogue functions
select
  n.nspname as function_schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname like '%catalogue%'
    or p.proname in (
      'get_my_role_keys',
      'has_catalogue_permission',
      'is_catalogue_reviewer'
    )
  )
order by p.proname;

-- 6. Confirm master table RLS current status before migration
select
  n.nspname as table_schema,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'products',
    'product_variants',
    'profiles',
    'tags',
    'product_tags',
    'product_tag_mapping',
    'product_aliases',
    'product_bom',
    'moq_rules',
    'pricing_slabs'
  )
order by c.relname;

-- 7. PR-06C1: Central product_tags + product_aliases columns
select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('product_tags', 'product_aliases')
  and column_name in (
    'id', 'tag_key', 'tag_label', 'is_active', 'sort_order',
    'alias_text', 'canonical_name', 'product_id'
  )
order by table_name, column_name;

-- 8. PR-06C1: Central unique constraints
select
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type
from information_schema.table_constraints tc
where tc.table_schema = 'public'
  and tc.table_name in ('product_tags', 'product_aliases')
  and tc.constraint_type in ('UNIQUE', 'PRIMARY KEY')
order by tc.table_name, tc.constraint_name;

-- 9. PR-06C1: approval functions (before/after C1a deploy)
select
  p.proname,
  pg_get_function_result(p.oid) as result_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'approve_catalogue_draft_internal',
    'catalogue_slugify_tag_part',
    'is_catalogue_reviewer',
    'approve_catalogue_tag_draft',
    'approve_catalogue_alias_draft'
  )
order by p.proname;
