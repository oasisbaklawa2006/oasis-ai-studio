-- PR06C1b packaging approval mapping — READ-ONLY verification
-- Run after applying 20260610231247_pr06c1b_packaging_product_approve_mapping.sql on STAGING only.
-- Do NOT run approve steps on production until sign-off.

-- =============================================================================
-- 1) Function definition includes Wave 4A-0 packaging_scalars mapping
-- =============================================================================
SELECT
  CASE
    WHEN pg_get_functiondef(p.oid) LIKE '%packing,packaging_scalars,grams_per_piece%'
     AND pg_get_functiondef(p.oid) LIKE '%packing,packaging_scalars,pcs_per_kg%'
     AND pg_get_functiondef(p.oid) LIKE '%packing,pack_size}%'
     AND pg_get_functiondef(p.oid) NOT LIKE '%packing,primary_pack_type}%,\n          pack_size%'
    THEN 'PASS: packaging_scalars + pack_size precedence present'
    ELSE 'FAIL: expected PR06C1b mappings missing'
  END AS definition_check
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'approve_catalogue_draft_internal';

-- =============================================================================
-- 2) Confirm tag/alias branches still present (unchanged from PR06C1a)
-- =============================================================================
SELECT
  CASE
    WHEN pg_get_functiondef(p.oid) LIKE '%catalogue_tag_drafts%'
     AND pg_get_functiondef(p.oid) LIKE '%catalogue_alias_drafts%'
     AND pg_get_functiondef(p.oid) LIKE '%product_aliases%'
    THEN 'PASS: tag + alias branches preserved'
    ELSE 'FAIL: tag/alias branches missing'
  END AS branch_preservation_check
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'approve_catalogue_draft_internal';

-- =============================================================================
-- 3) Dry-run payload shape check (no writes)
-- =============================================================================
-- Example Wave 4A packaging update payload (from batch001_packaging_drafts_payload.json)
WITH sample AS (
  SELECT jsonb_build_object(
    'packaging_authority_republish', true,
    'source', 'batch001_packaging_wave4a_verify',
    'identity', jsonb_build_object('product_name', 'VERIFY ONLY'),
    'sku_draft', jsonb_build_object('sku', 'OAS-AS-BKL-0001'),
    'uom', jsonb_build_object('primary_uom', 'KG'),
    'packing', jsonb_build_object(
      'pack_size', '3kg',
      'primary_pack_type', 'Tray 3kg',
      'carton_type', '666',
      'packaging_scalars', jsonb_build_object(
        'grams_per_piece', 18,
        'pcs_per_kg', 55.56,
        'primary_pack_weight_kg', 3,
        'pcs_per_primary_pack', 167,
        'pcs_per_master_carton', 167,
        'packs_per_master_carton', null,
        'packs_per_carton', 1
      )
    )
  ) AS payload
)
SELECT
  payload #>> '{packing,pack_size}' AS expected_pack_size,
  (payload #>> '{packing,packaging_scalars,grams_per_piece}')::numeric AS expected_grams,
  (payload #>> '{packing,packaging_scalars,pcs_per_kg}')::numeric AS expected_pcs_per_kg,
  coalesce(
    nullif(payload #>> '{packing,packaging_scalars,carton_type}', ''),
    nullif(payload #>> '{packing,carton_type}', '')
  ) AS expected_carton_type
FROM sample;

-- =============================================================================
-- 4) MANUAL staging test plan (requires reviewer session — do not run unattended)
-- =============================================================================
-- Step A: Pick a test product UUID (staging only), e.g. OAS-AS-BKL-0001
--   SELECT id, sku, pack_size, grams_per_piece, pcs_per_kg, carton_type
--   FROM products WHERE sku = 'OAS-AS-BKL-0001';
--
-- Step B: Insert ONE pending packaging draft (staging only):
--   INSERT INTO catalogue_product_drafts (
--     source_app, target_table, target_record_id, operation, payload, status, submitted_by
--   ) VALUES (
--     'catalogue_app', 'products', '<product_uuid>', 'update',
--     <paste sample payload from batch001_packaging_drafts_payload.json>,
--     'pending_approval', auth.uid()
--   ) RETURNING id;
--
-- Step C: Approve via reviewer RPC (staging only):
--   SELECT approve_catalogue_product_draft('<draft_id>');
--
-- Step D: Verify packaging columns updated; identity/pricing unchanged:
--   SELECT sku, name, pack_size, grams_per_piece, pcs_per_kg, primary_pack_weight_kg,
--          pcs_per_primary_pack, carton_type, pcs_per_master_carton,
--          packs_per_master_carton, packs_per_carton, mrp, price_b2b
--   FROM products WHERE id = '<product_uuid>';
--
-- Expected after approve:
--   pack_size = '3kg' (NOT 'Tray 3kg')
--   grams_per_piece = 18, pcs_per_kg = 55.56, carton_type = '666'
--   mrp / price_b2b unchanged from before
--
-- Step E: Rollback test product packaging if needed (staging cleanup only).
