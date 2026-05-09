-- Central Supabase Schema Audit (READ-ONLY)
-- Safe to run in SQL Editor / read-only session.
-- This script uses SELECT statements only.

-- 1) Project / database context
select
  current_database() as database_name,
  current_schema() as current_schema,
  current_user as current_user,
  version() as postgres_version,
  now() as audited_at_utc;

-- 2) Public tables
select
  t.table_schema,
  t.table_name,
  pg_total_relation_size(format('%I.%I', t.table_schema, t.table_name)) as total_bytes
from information_schema.tables t
where t.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
order by t.table_name;

-- 3) Public columns
select
  c.table_schema,
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
order by c.table_name, c.ordinal_position;

-- 4) Primary keys
select
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  kcu.ordinal_position as key_ordinal_position,
  tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
where tc.constraint_type = 'PRIMARY KEY'
  and tc.table_schema = 'public'
order by tc.table_name, kcu.ordinal_position;

-- 5) Foreign keys
select
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema as foreign_table_schema,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name,
  tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on tc.constraint_name = ccu.constraint_name
 and tc.table_schema = ccu.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
order by tc.table_name, tc.constraint_name;

-- 6) Indexes
select
  schemaname as table_schema,
  tablename as table_name,
  indexname as index_name,
  indexdef as index_definition
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;

-- 7) RLS enabled/forced flags per table
select
  n.nspname as table_schema,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;

-- 8) RLS policies
select
  p.schemaname as table_schema,
  p.tablename as table_name,
  p.policyname as policy_name,
  p.permissive,
  p.roles,
  p.cmd,
  p.qual,
  p.with_check
from pg_policies p
where p.schemaname = 'public'
order by p.tablename, p.policyname;

-- 9) Enum types and enum values (includes app_role if present)
select
  n.nspname as type_schema,
  t.typname as enum_name,
  e.enumsortorder,
  e.enumlabel as enum_value
from pg_type t
join pg_enum e on t.oid = e.enumtypid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname in ('public', 'auth')
order by t.typname, e.enumsortorder;

-- 10) Public functions / RPCs
select
  n.nspname as function_schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as function_args,
  pg_get_function_result(p.oid) as return_type,
  l.lanname as language,
  p.provolatile as volatility,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
order by p.proname, function_args;

-- 11) Storage buckets metadata (if accessible)
select
  b.id,
  b.name,
  b.public,
  b.file_size_limit,
  b.allowed_mime_types,
  b.created_at,
  b.updated_at
from storage.buckets b
order by b.name;

-- 12) Grants/privileges for public schema objects
select
  grantee,
  table_schema,
  table_name,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
order by table_name, grantee, privilege_type;

-- 13) Function execute grants (public schema)
select
  routine_schema,
  routine_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_routine_grants
where routine_schema = 'public'
order by routine_name, grantee;
