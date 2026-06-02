-- PR-06C1a production test artifact cleanup
-- Target project: tcxvcatsqqertcnycuop (live Central / production)
-- STATUS: DO NOT RUN until owner reviews SELECT previews and confirms project ref.
-- Does NOT rollback approve_catalogue_draft_internal or catalogue_slugify_tag_part.
--
-- Incident: PR-06C1a verification SQL was executed on production by mistake.
-- This script removes test master rows, pr06c1_staging_verify drafts, and linked audit rows only.

-- =============================================================================
-- SECTION 0 — Read-only preview (safe to run alone)
-- =============================================================================

-- 0a. Master: product_tags
SELECT id, tag_key, tag_label, created_at
FROM public.product_tags
WHERE tag_key ILIKE '%pr06c1a%'
   OR tag_label ILIKE '%PR06C1a%'
   OR tag_key ILIKE '%staging%'
ORDER BY created_at;

-- 0b. Master: product_aliases
SELECT id, alias_text, canonical_name, product_id, created_at
FROM public.product_aliases
WHERE alias_text ILIKE '%PR06C1a%'
   OR alias_text LIKE 'staging-%'
ORDER BY created_at;

-- 0c. Master: products
SELECT id, sku, name, category, created_at
FROM public.products
WHERE name ILIKE '%PR06C1a Staging%'
ORDER BY created_at;

-- 0d. Drafts (source_app scope for this script)
SELECT 'catalogue_tag_drafts' AS draft_table, id, status, operation, target_record_id, submitted_at
FROM public.catalogue_tag_drafts
WHERE source_app = 'pr06c1_staging_verify'
UNION ALL
SELECT 'catalogue_alias_drafts', id, status, operation, target_record_id, submitted_at
FROM public.catalogue_alias_drafts
WHERE source_app = 'pr06c1_staging_verify'
UNION ALL
SELECT 'catalogue_product_drafts', id, status, operation, target_record_id, submitted_at
FROM public.catalogue_product_drafts
WHERE source_app = 'pr06c1_staging_verify'
ORDER BY draft_table;

-- 0e. Audit rows for pr06c1_staging_verify draft ids
SELECT a.id, a.draft_table, a.draft_id, a.action, a.created_at, left(a.notes, 100) AS notes
FROM public.catalogue_approval_audit a
WHERE a.draft_id IN (
  SELECT id FROM public.catalogue_tag_drafts WHERE source_app = 'pr06c1_staging_verify'
  UNION
  SELECT id FROM public.catalogue_alias_drafts WHERE source_app = 'pr06c1_staging_verify'
  UNION
  SELECT id FROM public.catalogue_product_drafts WHERE source_app = 'pr06c1_staging_verify'
)
ORDER BY a.created_at;

-- 0f. Known PR-06C1a IDs (2026-06-02 inventory — must match 0a–0e before delete)
-- product_tags:     3b19b81b-7c3c-4c3f-9ccb-cd7e28731113
-- product_aliases:  556c44c2-157a-4b68-b09a-8f06cac91d45
-- products:         93c23731-1a60-4f77-b40d-0bea87516701
-- tag draft:        e8f926c5-b19c-4c36-86ff-2e42afdd10c1
-- alias draft:      acef1ede-9541-499c-bcda-24635ce98d5c
-- product draft:    e8ae9686-607f-4982-9b53-1d4db868ede1
-- audit:            82aad819-e1d7-4f64-8293-3586b3a10355, a3347919-ee08-4f7b-ba15-8d2a585c07b7,
--                   6b162276-d1ea-4520-bbec-d4c61d7cd720

-- =============================================================================
-- SECTION 1 — Mutating cleanup (owner only; run entire block in SQL editor)
-- =============================================================================

BEGIN;

-- --- Before counts ---
SELECT 'before' AS phase,
  (SELECT count(*) FROM public.product_tags
   WHERE id = '3b19b81b-7c3c-4c3f-9ccb-cd7e28731113'::uuid
     AND tag_key = 'staging:pr06c1a-staging-tag-1db44da7') AS tags_to_delete,
  (SELECT count(*) FROM public.product_aliases
   WHERE id = '556c44c2-157a-4b68-b09a-8f06cac91d45'::uuid
     AND alias_text ILIKE 'PR06C1a Staging%') AS aliases_to_delete,
  (SELECT count(*) FROM public.products
   WHERE id = '93c23731-1a60-4f77-b40d-0bea87516701'::uuid
     AND name ILIKE 'PR06C1a Staging%'
     AND sku LIKE 'DRAFT-%') AS products_to_delete,
  (SELECT count(*) FROM public.catalogue_tag_drafts
   WHERE source_app = 'pr06c1_staging_verify') AS tag_drafts_to_delete,
  (SELECT count(*) FROM public.catalogue_alias_drafts
   WHERE source_app = 'pr06c1_staging_verify') AS alias_drafts_to_delete,
  (SELECT count(*) FROM public.catalogue_product_drafts
   WHERE source_app = 'pr06c1_staging_verify') AS product_drafts_to_delete,
  (SELECT count(*) FROM public.catalogue_approval_audit
   WHERE draft_id IN (
     'e8f926c5-b19c-4c36-86ff-2e42afdd10c1'::uuid,
     'acef1ede-9541-499c-bcda-24635ce98d5c'::uuid,
     'e8ae9686-607f-4982-9b53-1d4db868ede1'::uuid
   )) AS audit_rows_to_delete;

-- Abort if counts do not match expected inventory (adjust if re-verified)
DO $$
BEGIN
  IF (SELECT count(*) FROM public.product_tags
      WHERE id = '3b19b81b-7c3c-4c3f-9ccb-cd7e28731113'::uuid
        AND tag_key = 'staging:pr06c1a-staging-tag-1db44da7') <> 1 THEN
    RAISE EXCEPTION 'Safety check failed: product_tags test row count != 1';
  END IF;
  IF (SELECT count(*) FROM public.product_aliases
      WHERE id = '556c44c2-157a-4b68-b09a-8f06cac91d45'::uuid
        AND alias_text ILIKE 'PR06C1a Staging%') <> 1 THEN
    RAISE EXCEPTION 'Safety check failed: product_aliases test row count != 1';
  END IF;
  IF (SELECT count(*) FROM public.products
      WHERE id = '93c23731-1a60-4f77-b40d-0bea87516701'::uuid
        AND name ILIKE 'PR06C1a Staging%'
        AND sku LIKE 'DRAFT-%') <> 1 THEN
    RAISE EXCEPTION 'Safety check failed: products test row count != 1';
  END IF;
  IF (SELECT count(*) FROM public.catalogue_tag_drafts
      WHERE source_app = 'pr06c1_staging_verify') <> 1
     OR (SELECT count(*) FROM public.catalogue_alias_drafts
         WHERE source_app = 'pr06c1_staging_verify') <> 1
     OR (SELECT count(*) FROM public.catalogue_product_drafts
         WHERE source_app = 'pr06c1_staging_verify') <> 1 THEN
    RAISE EXCEPTION 'Safety check failed: pr06c1_staging_verify draft count != 1 each';
  END IF;
END $$;

-- 1. Audit (draft ids from pr06c1_staging_verify only)
DELETE FROM public.catalogue_approval_audit
WHERE draft_id IN (
  SELECT id FROM public.catalogue_tag_drafts WHERE source_app = 'pr06c1_staging_verify'
  UNION
  SELECT id FROM public.catalogue_alias_drafts WHERE source_app = 'pr06c1_staging_verify'
  UNION
  SELECT id FROM public.catalogue_product_drafts WHERE source_app = 'pr06c1_staging_verify'
);

-- 2. Draft rows
DELETE FROM public.catalogue_tag_drafts
WHERE source_app = 'pr06c1_staging_verify';

DELETE FROM public.catalogue_alias_drafts
WHERE source_app = 'pr06c1_staging_verify';

DELETE FROM public.catalogue_product_drafts
WHERE source_app = 'pr06c1_staging_verify';

-- 3. Master rows (explicit ids + label guards — does not touch Cranberry Dragees product 1c320f87-…)
DELETE FROM public.product_tag_mapping
WHERE tag_id = '3b19b81b-7c3c-4c3f-9ccb-cd7e28731113'::uuid
  AND tag_id IN (
    SELECT id FROM public.product_tags
    WHERE id = '3b19b81b-7c3c-4c3f-9ccb-cd7e28731113'::uuid
      AND tag_key = 'staging:pr06c1a-staging-tag-1db44da7'
  );

DELETE FROM public.product_aliases
WHERE id = '556c44c2-157a-4b68-b09a-8f06cac91d45'::uuid
  AND alias_text ILIKE 'PR06C1a Staging%';

DELETE FROM public.product_tags
WHERE id = '3b19b81b-7c3c-4c3f-9ccb-cd7e28731113'::uuid
  AND tag_key = 'staging:pr06c1a-staging-tag-1db44da7';

DELETE FROM public.products
WHERE id = '93c23731-1a60-4f77-b40d-0bea87516701'::uuid
  AND name ILIKE 'PR06C1a Staging%'
  AND sku LIKE 'DRAFT-%';

-- --- After counts (expect zeros) ---
SELECT 'after' AS phase,
  (SELECT count(*) FROM public.product_tags
   WHERE tag_key ILIKE '%pr06c1a%' OR tag_label ILIKE '%PR06C1a%') AS tags_remaining,
  (SELECT count(*) FROM public.product_aliases
   WHERE alias_text ILIKE '%PR06C1a%') AS aliases_remaining,
  (SELECT count(*) FROM public.products
   WHERE name ILIKE '%PR06C1a Staging%') AS products_remaining,
  (SELECT count(*) FROM public.catalogue_tag_drafts
   WHERE source_app = 'pr06c1_staging_verify') AS tag_drafts_remaining,
  (SELECT count(*) FROM public.catalogue_alias_drafts
   WHERE source_app = 'pr06c1_staging_verify') AS alias_drafts_remaining,
  (SELECT count(*) FROM public.catalogue_product_drafts
   WHERE source_app = 'pr06c1_staging_verify') AS product_drafts_remaining,
  (SELECT count(*) FROM public.catalogue_approval_audit
   WHERE draft_id IN (
     'e8f926c5-b19c-4c36-86ff-2e42afdd10c1'::uuid,
     'acef1ede-9541-499c-bcda-24635ce98d5c'::uuid,
     'e8ae9686-607f-4982-9b53-1d4db868ede1'::uuid
   )) AS audit_remaining;

-- Review after counts; then COMMIT or ROLLBACK.
-- COMMIT;
ROLLBACK;  -- default: no-op until owner replaces with COMMIT

-- =============================================================================
-- SECTION 2 — OPTIONAL: blocked-approve test drafts (NOT in primary scope)
-- source_app = catalogue_app, payload {"test": true}, ~2026-06-02 04:05:34 UTC
-- Uncomment only after owner confirms these are disposable:
--
-- BEGIN;
-- DELETE FROM public.catalogue_approval_audit WHERE draft_id IN (
--   'c01f2e16-20b2-4aa9-b353-fc08cc5aad7f',
--   '7f805848-75be-4fc5-adbd-f46acdf35bda',
--   '507acbfd-c2be-4a10-a9b8-0cfb8619849e',
--   'c68db803-c950-49b7-b7c3-cd226b1e07cd'
-- );
-- DELETE FROM public.catalogue_bom_drafts WHERE id = 'c01f2e16-20b2-4aa9-b353-fc08cc5aad7f' AND payload = '{"test": true}'::jsonb;
-- DELETE FROM public.catalogue_moq_drafts WHERE id = '7f805848-75be-4fc5-adbd-f46acdf35bda' AND payload = '{"test": true}'::jsonb;
-- DELETE FROM public.catalogue_pricing_drafts WHERE id = '507acbfd-c2be-4a10-a9b8-0cfb8619849e' AND payload = '{"test": true}'::jsonb;
-- DELETE FROM public.catalogue_media_submissions WHERE id = 'c68db803-c950-49b7-b7c3-cd226b1e07cd' AND payload = '{"test": true}'::jsonb;
-- COMMIT;
