-- CENTRAL_catalogue_versions_minimal.sql
-- Scope: Product Truth → Central Sync preview persistence only (AI Studio).
-- Creates: public.catalogue_versions, public.catalogue_sync_events
-- Requires: public.products, public.is_team_member(uuid)
-- Safe to re-run (idempotent). No destructive DDL.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) catalogue_versions — immutable approved snapshots from Product Truth
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catalogue_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku_id uuid NULL,
  version_code text NOT NULL,
  version_number integer NOT NULL,
  snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'published', 'synced')),
  approved_by uuid NULL,
  approved_at timestamptz NULL,
  published_at timestamptz NULL,
  synced_to_central_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_catalogue_versions_product_id
  ON public.catalogue_versions (product_id, version_number DESC);

COMMENT ON TABLE public.catalogue_versions IS
  'Immutable approved catalogue snapshots from AI Studio (Product Truth).';

COMMENT ON COLUMN public.catalogue_versions.snapshot_json IS
  'Full Product Truth snapshot JSON for Central sync preview/export.';

-- ---------------------------------------------------------------------------
-- 2) catalogue_sync_events — preview/export event log (no live Central write)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catalogue_sync_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogue_version_id uuid NOT NULL REFERENCES public.catalogue_versions(id) ON DELETE CASCADE,
  target_system text NOT NULL DEFAULT 'oasis_central',
  sync_status text NOT NULL DEFAULT 'preview_only'
    CHECK (sync_status IN ('preview_only', 'pending', 'success', 'failed')),
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text NULL,
  triggered_by uuid NULL,
  triggered_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalogue_sync_events_version
  ON public.catalogue_sync_events (catalogue_version_id, triggered_at DESC);

COMMENT ON TABLE public.catalogue_sync_events IS
  'Central sync preview/export events; preview_only rows do not write to Central.';

-- ---------------------------------------------------------------------------
-- 3) RLS — team members only (matches products / product_media pattern)
-- ---------------------------------------------------------------------------
ALTER TABLE public.catalogue_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogue_sync_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team read catalogue_versions" ON public.catalogue_versions;
CREATE POLICY "Team read catalogue_versions"
  ON public.catalogue_versions
  FOR SELECT
  TO authenticated
  USING (public.is_team_member(auth.uid()));

DROP POLICY IF EXISTS "Team insert catalogue_versions" ON public.catalogue_versions;
CREATE POLICY "Team insert catalogue_versions"
  ON public.catalogue_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_team_member(auth.uid()));

DROP POLICY IF EXISTS "Team update catalogue_versions" ON public.catalogue_versions;
CREATE POLICY "Team update catalogue_versions"
  ON public.catalogue_versions
  FOR UPDATE
  TO authenticated
  USING (public.is_team_member(auth.uid()))
  WITH CHECK (public.is_team_member(auth.uid()));

DROP POLICY IF EXISTS "Team read catalogue_sync_events" ON public.catalogue_sync_events;
CREATE POLICY "Team read catalogue_sync_events"
  ON public.catalogue_sync_events
  FOR SELECT
  TO authenticated
  USING (public.is_team_member(auth.uid()));

DROP POLICY IF EXISTS "Team insert catalogue_sync_events" ON public.catalogue_sync_events;
CREATE POLICY "Team insert catalogue_sync_events"
  ON public.catalogue_sync_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_team_member(auth.uid()));

COMMIT;

-- ---------------------------------------------------------------------------
-- 4) Post-check (SELECT-only — run after the transaction above)
-- ---------------------------------------------------------------------------
-- Tables exist
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('catalogue_versions', 'catalogue_sync_events')
ORDER BY tablename;

-- Column shape (catalogue_versions)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'catalogue_versions'
ORDER BY ordinal_position;

-- Column shape (catalogue_sync_events)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'catalogue_sync_events'
ORDER BY ordinal_position;

-- Indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('catalogue_versions', 'catalogue_sync_events')
ORDER BY tablename, indexname;

-- RLS enabled
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('catalogue_versions', 'catalogue_sync_events')
ORDER BY c.relname;

-- Policies
SELECT schemaname, tablename, policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('catalogue_versions', 'catalogue_sync_events')
ORDER BY tablename, policyname;

-- FK to products
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('catalogue_versions', 'catalogue_sync_events')
ORDER BY tc.table_name, tc.constraint_name;

-- is_team_member helper present (prerequisite)
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'is_team_member';
