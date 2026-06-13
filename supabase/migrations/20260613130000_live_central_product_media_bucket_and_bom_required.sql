-- Live Central deploy gap fix (idempotent, non-destructive)
-- Project: tcxvcatsqqertcnycuop (oasis-baklawa)
-- Fixes preview/production errors:
--   1) Storage bucket "product-media" not found
--   2) products.bom_required column missing (PGRST204)
--
-- Owner: apply in Supabase SQL editor, then verify media upload + product save.

-- ---------------------------------------------------------------------------
-- A) product-media storage bucket + team-member policies
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-media',
  'product-media',
  true,
  52428800,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
    'video/mp4', 'video/webm', 'application/pdf'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = COALESCE(storage.buckets.file_size_limit, EXCLUDED.file_size_limit),
  allowed_mime_types = COALESCE(storage.buckets.allowed_mime_types, EXCLUDED.allowed_mime_types);

DROP POLICY IF EXISTS "Public read product-media" ON storage.objects;
CREATE POLICY "Public read product-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-media');

DROP POLICY IF EXISTS "Team insert product-media" ON storage.objects;
CREATE POLICY "Team insert product-media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-media' AND public.is_team_member(auth.uid()));

DROP POLICY IF EXISTS "Team update product-media" ON storage.objects;
CREATE POLICY "Team update product-media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-media' AND public.is_team_member(auth.uid()))
  WITH CHECK (bucket_id = 'product-media' AND public.is_team_member(auth.uid()));

DROP POLICY IF EXISTS "Team delete product-media" ON storage.objects;
CREATE POLICY "Team delete product-media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-media' AND public.is_team_member(auth.uid()));

-- ---------------------------------------------------------------------------
-- B) products.bom_required (Batch B column missing on some live Central deploys)
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS bom_required boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.bom_required IS
  'True when product requires Internal BOM or Hamper BOM (AI Studio ProductEdit BOM tab).';
