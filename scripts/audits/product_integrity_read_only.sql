-- ============================================================================
-- AI-Studio existing-product integrity audit — READ-ONLY
-- Companion: docs/audits/2026-07-10-product-integrity-audit.md
--
-- SAFETY
--   * This file contains ONLY SELECT statements.
--   * No INSERT / UPDATE / DELETE / UPSERT / MERGE / TRUNCATE / ALTER / DROP /
--     CREATE / GRANT / REVOKE / RPC call appears anywhere below.
--   * Wrapped in a read-only transaction. If your client supports it, this
--     transaction will refuse any accidental write statement added later.
--   * Uses explicit column lists — no `SELECT *` in any final audit query.
--   * Re-runnable: every query is a pure SELECT against current table state.
--
-- STATUS AS WRITTEN (2026-07-10)
--   This file was authored during the audit but was NOT executed against any
--   database in this pass. Phase 2 (Environment Identity Gate) of the audit
--   could not conclusively determine which Supabase project backs the
--   deployed oasis-ai-studio production application — see the audit report,
--   section "Environment Identity". Per the audit's explicit read-only rule,
--   execution was deliberately withheld rather than guessed against an
--   unconfirmed database. This SQL is provided so a future session that DOES
--   have confirmed production access can run it immediately and safely.
--
-- AUTHORITY SOURCE FOR EVERY RULE BELOW
--   Every classification below is a direct SQL reproduction of the corrected
--   application logic merged in PR #75 (commit 443ba403523dcedb9552def684368b30aae28828):
--     - Structured SKU validity: src/features/productAuthority/skuGuard.ts
--         isStructuredOasisSku()
--     - SKU packaging segment: 5th dash-separated part of OAS-DIV-CAT-SUBCAT-PKG-SEQ
--         (src/features/fastCreate/saveFastCreateProduct.ts skuPackagingSegment())
--     - Packaging presence for the gate: src/features/productAuthority/catalogueReadyGate.ts
--         hasPackagingTaxonomyCode() = !!form.packaging_code (JS truthiness — see
--         Section 8 "new code finding" in the report; this SQL reproduces that
--         truthiness gap deliberately so the audit can quantify its blast radius)
--     - Sale type derivation: src/features/productAuthority/saleType.ts
--         saleTypeFromForm() — product_class -> sale type inverse mapping
--     - Pricing requirement by sale type: src/features/productAuthority/saleType.ts
--         getSaleTypeRequirements() combined with
--         src/features/productAuthority/pricingAuthority.ts pricingBlockers()
--     - Multi-row approved pricing selection (UPDATED post-audit — see the "Correction
--         record" in the companion report): previously an unordered Array.find(), so this
--         SQL could only approximate it. Fixed to a defined, deterministic rule —
--         newest currently-valid approved row by approved_at, ties broken by lowest id —
--         implemented in getChannelPrice()/compareChannelPriceRows()
--         (src/features/productTruth/channelPricingMoqEngine.ts) and used by
--         resolvePricing() (src/features/productAuthority/pricingAuthority.ts). The CTEs
--         below now reproduce that exact rule instead of an approximation, and also flag
--         products where multiple currently-valid approved rows for the same
--         product+channel disagree in value (review-required), mirroring
--         pricingAuthority.ts's disagreesWithSelected().
--     - Active packaging taxonomy: sku_code_rules WHERE code_type = 'packaging'
--         AND is_active = true (src/lib/skuCodeRules.ts fetchActiveSkuCodeRules())
--   Product Truth score (readinessSnapshot.readiness.score / maxScore) is
--   computed client-side in TypeScript from products + product_media +
--   product_pricing_rules + product_moq_rules + compliance metadata
--   (buildProductReadinessSnapshot, referenced from src/pages/ProductEdit.tsx).
--   It is NOT reproduced in SQL here — reimplementing that scoring algorithm
--   independently in SQL would be exactly the "independently invented
--   approximation" the audit brief forbids. Every row below reports
--   truth_score_reconstructable = false for this reason; treat the Product
--   Truth dimension as UNVERIFIABLE from this SQL alone.
-- ============================================================================

BEGIN TRANSACTION READ ONLY;

-- ----------------------------------------------------------------------------
-- 0. SCHEMA / COUNT SANITY CHECKS — run before any row-level query
-- ----------------------------------------------------------------------------

-- 0a. Confirm the tables and row counts this audit depends on.
SELECT
  (SELECT count(*) FROM products)                                   AS products_total,
  (SELECT count(*) FROM products WHERE is_catalogue_ready = true)   AS products_catalogue_ready,
  (SELECT count(*) FROM products WHERE sku IS NOT NULL)             AS products_with_sku,
  (SELECT count(*) FROM sku_code_rules)                             AS sku_code_rules_total,
  (SELECT count(*) FROM sku_code_rules
     WHERE code_type = 'packaging' AND is_active = true)            AS active_packaging_codes,
  (SELECT count(*) FROM product_pricing_rules)                      AS pricing_rules_total,
  (SELECT count(*) FROM product_pricing_rules
     WHERE approval_status = 'approved')                            AS approved_pricing_rules;

-- 0b. Active packaging taxonomy, for cross-reference while reading results below.
SELECT
  code,
  label,
  is_active,
  sort_order
FROM sku_code_rules
WHERE code_type = 'packaging'
ORDER BY is_active DESC, sort_order;

-- 0c. Duplicate active packaging codes (same code registered more than once and active) —
--     feeds Audit D "duplicate taxonomy codes".
SELECT
  code,
  count(*) AS active_row_count
FROM sku_code_rules
WHERE code_type = 'packaging' AND is_active = true
GROUP BY code
HAVING count(*) > 1;

-- ----------------------------------------------------------------------------
-- SHARED CTE FRAGMENT (repeated per query below for standalone re-runnability):
--   sku_analysis: reproduces isStructuredOasisSku() + the SKU packaging segment.
--
--   is_structured_sku mirrors skuGuard.ts exactly, INCLUDING its known-permissive
--   fallback branch (`sku LIKE 'OAS-%' AND length(sku) >= 12`), which is a
--   pre-existing legacy gap outside PR #75's scope, not invented by this audit.
--
--   sku_packaging_segment mirrors skuPackagingSegment() (saveFastCreateProduct.ts,
--   PR #75) exactly, NOT isStructuredOasisSku()'s strict regex: uppercase the trimmed
--   SKU, split on "-", and take the 5th of exactly 6 parts when the first is "OAS" — no
--   character-class or digit-suffix requirement. This is deliberately independent of
--   is_structured_sku above; the two checks can disagree in either direction.
-- ----------------------------------------------------------------------------

-- ============================================================================
-- AUDIT A — CATALOGUE-READY INTEGRITY
-- Every product with is_catalogue_ready = true, re-evaluated against the
-- corrected gate (catalogueReadyGate.ts + saleType.ts + pricingAuthority.ts).
-- Product Truth is intentionally left UNVERIFIABLE (see header note).
-- ============================================================================

WITH sku_analysis AS (
  -- isStructuredOasisSku() trims whitespace before every check (skuGuard.ts:
  -- "const s = String(sku).trim();") — every check below runs against btrim(p.sku),
  -- not the raw column, so leading/trailing spaces on an otherwise
  -- valid SKU aren't misclassified.
  SELECT
    p.id,
    p.sku,
    p.packaging_code,
    CASE
      WHEN p.sku IS NULL OR btrim(p.sku) = '' THEN false
      WHEN btrim(p.sku) ~* '^DRAFT-' THEN false
      WHEN btrim(p.sku) ~* '^OAS-FC-' THEN false
      WHEN btrim(p.sku) ~ '^OAS-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[0-9]{4}$' THEN true
      WHEN btrim(p.sku) LIKE 'OAS-%' AND length(btrim(p.sku)) >= 12 THEN true
      ELSE false
    END AS is_structured_sku,
    -- sku_packaging_segment mirrors skuPackagingSegment() (saveFastCreateProduct.ts,
    -- PR #75), NOT isStructuredOasisSku()'s strict regex — that function uppercases the
    -- trimmed SKU and takes the 5th of exactly 6 dash-separated parts whenever the first
    -- is "OAS", with no character-class or digit-suffix requirement. A SKU can satisfy
    -- is_structured_sku above (including via its permissive fallback) yet not have
    -- exactly 6 parts, and vice versa — the two checks are independent in the real app.
    CASE
      WHEN array_length(string_to_array(upper(btrim(p.sku)), '-'), 1) = 6
           AND (string_to_array(upper(btrim(p.sku)), '-'))[1] = 'OAS'
        THEN (string_to_array(upper(btrim(p.sku)), '-'))[5]
      ELSE NULL
    END AS sku_packaging_segment
  FROM products p
),
sale_type_derivation AS (
  SELECT
    p.id,
    CASE
      WHEN lower(coalesce(p.product_class, '')) = 'ready_pack' THEN 'retail_ready_pack'
      WHEN lower(coalesce(p.product_class, '')) = 'gift_hamper' THEN 'gift_hamper'
      WHEN lower(coalesce(p.product_class, '')) = 'bulk_loose_product' THEN 'b2b_horeca'
      WHEN lower(coalesce(p.main_department, '')) = 'packing_material'
        OR lower(coalesce(p.category, '')) LIKE '%packaging%' THEN 'packaging_material'
      ELSE 'b2b_horeca'
    END AS derived_sale_type
  FROM products p
),
sale_type_requirements AS (
  -- Mirrors getSaleTypeRequirements() in saleType.ts.
  SELECT * FROM (VALUES
    ('retail_ready_pack', true,  true,  false, false, true,  true),
    ('b2b_horeca',         true,  false, true,  false, true,  false),
    ('export',             true,  false, false, true,  true,  true),
    ('internal_bom',       false, false, false, false, false, false),
    ('gift_hamper',        true,  true,  false, false, true,  true),
    ('packaging_material', false, false, false, false, false, false)
  ) AS req(sale_type, customer_facing, requires_mrp, requires_b2b_price,
           requires_export_price, requires_packaging, requires_hero_image)
  -- Every cell mirrors REQUIREMENTS in saleType.ts exactly (retail_ready_pack's
  -- requires_b2b_price is false unless b2bEnabled is passed, which has no persisted
  -- column to query; export and gift_hamper both require a hero image).
),
derived_hero AS (
  -- Mirrors resolveProductCardHeroUrl() / latestApprovedHeroUrlFromMediaRows(): the
  -- gate's actual heroImageUrl input is readinessSnapshot?.derivedHeroUrl ??
  -- form.hero_image_url, and derivedHeroUrl itself prefers the latest APPROVED
  -- product_media row of type='hero_image' over the products.hero_image_url column.
  -- (The function's third fallback tier, products.image_url, is omitted — that column
  -- does not exist in the generated products Row type, same class of gap as price_b2b.)
  SELECT DISTINCT ON (pm.product_id)
    pm.product_id,
    pm.file_url AS media_hero_url
  FROM product_media pm
  WHERE pm.type = 'hero_image'
    AND pm.status = 'approved'
    AND pm.file_url IS NOT NULL
    AND btrim(pm.file_url) <> ''
  ORDER BY pm.product_id, pm.created_at DESC NULLS LAST
),
approved_pricing AS (
  -- Positivity filter mirrors pricingAuthority.ts's num() helper, which treats zero,
  -- negative, and non-numeric values as "missing" — an approved rule saved as 0 must
  -- not satisfy a pricing blocker here just because a row exists. The valid_from/
  -- valid_until window mirrors isPriceEffective() (channelPricingMoqEngine.ts) — a
  -- currently-expired or not-yet-effective approved row is not "currently valid".
  SELECT
    id,
    product_id,
    lower(price_channel) AS channel,
    coalesce(calculated_price, base_price) AS price_value,
    approved_at
  FROM product_pricing_rules
  WHERE approval_status = 'approved'
    AND coalesce(calculated_price, base_price) > 0
    AND (valid_from IS NULL OR valid_from <= now())
    AND (valid_until IS NULL OR valid_until >= now())
),
newest_approved_pricing AS (
  -- Exact reproduction of getChannelPrice()/compareChannelPriceRows()
  -- (channelPricingMoqEngine.ts): newest approved_at first, ties (including rows with no
  -- approved_at at all) broken by lowest id. This is now a defined, provable rule — not
  -- an approximation — following the post-audit fix that gave resolvePricing() a
  -- deterministic multi-row selection.
  SELECT DISTINCT ON (product_id, channel)
    product_id, channel, price_value, id
  FROM approved_pricing
  ORDER BY product_id, channel, approved_at DESC NULLS LAST, id ASC
),
pricing_review_required AS (
  -- A product+channel needs manual review when more than one currently-valid approved row
  -- disagrees on price_value — mirrors pricingAuthority.ts's disagreesWithSelected(). The
  -- newest row above is still used as the resolved value below; this is a diagnostic, not
  -- a silent aggregation.
  SELECT DISTINCT ap.product_id, ap.channel
  FROM approved_pricing ap
  JOIN newest_approved_pricing nap
    ON nap.product_id = ap.product_id AND nap.channel = ap.channel
  WHERE ap.id <> nap.id AND ap.price_value IS DISTINCT FROM nap.price_value
),
pricing_summary AS (
  SELECT
    p.id,
    -- resolvePricing() derives MRP from the 'retail' channel only (channelOf("retail")),
    -- never from a channel literally named 'mrp' — pricingRuleRowToChannelPrice's
    -- isMrpChannel branch only ever populates a field the app never reads back out.
    -- max() here is a no-op selector: newest_approved_pricing has at most one row per
    -- (product_id, channel) already.
    max(CASE WHEN ap.channel = 'retail' THEN ap.price_value END)          AS channel_mrp,
    max(CASE WHEN ap.channel = 'b2b' THEN ap.price_value END)             AS channel_b2b,
    max(CASE WHEN ap.channel = 'export' THEN ap.price_value END)         AS channel_export,
    bool_or(rr.channel = 'retail')                                       AS mrp_review_required,
    bool_or(rr.channel = 'b2b')                                          AS b2b_review_required,
    bool_or(rr.channel = 'export')                                       AS export_review_required,
    -- product-row fallback prices, per pricingAuthority.ts resolvePricing().
    -- NOTE: resolvePricing() also checks form.price_b2b, but that key is not a real
    -- products column per the generated Supabase types (src/integrations/supabase/
    -- types.ts) — only b2b_price and b2b_price_inr exist. Omitted here; see the audit
    -- report's schema-gap note on this discrepancy (a code-level observation, not
    -- something this SQL can resolve).
    CASE WHEN p.mrp > 0 THEN p.mrp END AS field_mrp,
    CASE WHEN coalesce(p.b2b_price, p.b2b_price_inr) > 0
      THEN coalesce(p.b2b_price, p.b2b_price_inr) END AS field_b2b,
    CASE WHEN coalesce(p.export_price, p.export_price_usd) > 0
      THEN coalesce(p.export_price, p.export_price_usd) END AS field_export
  FROM products p
  LEFT JOIN newest_approved_pricing ap ON ap.product_id = p.id
  LEFT JOIN pricing_review_required rr ON rr.product_id = p.id
  GROUP BY p.id, p.mrp, p.b2b_price, p.b2b_price_inr,
           p.export_price, p.export_price_usd
)
SELECT
  p.id                                        AS product_id,
  p.sku,
  p.product_name,
  p.product_class,
  st.derived_sale_type,
  p.is_catalogue_ready,
  sa.is_structured_sku,
  sa.sku_packaging_segment,
  p.packaging_code,
  (p.packaging_code IS NOT NULL AND p.packaging_code <> '')          AS packaging_present_by_app_truthiness,
  coalesce(ps.channel_mrp, ps.field_mrp)                             AS resolved_mrp,
  coalesce(ps.channel_b2b, ps.field_b2b)                             AS resolved_b2b_price,
  coalesce(ps.channel_export, ps.field_export)                       AS resolved_export_price,
  p.hero_image_url,
  dh.media_hero_url,
  coalesce(dh.media_hero_url, p.hero_image_url)                      AS resolved_hero_url,
  req.customer_facing,
  req.requires_mrp,
  req.requires_b2b_price,
  req.requires_export_price,
  req.requires_packaging,
  req.requires_hero_image,
  -- Individual blocker flags, mirroring evaluateCatalogueReadyGate() blocker list:
  (NOT req.customer_facing)                                          AS blocker_not_customer_facing,
  (req.customer_facing AND NOT sa.is_structured_sku)                 AS blocker_invalid_sku,
  (req.customer_facing AND req.requires_mrp
    AND coalesce(ps.channel_mrp, ps.field_mrp) IS NULL)              AS blocker_mrp_missing,
  (req.customer_facing AND req.requires_b2b_price
    AND coalesce(ps.channel_b2b, ps.field_b2b) IS NULL)              AS blocker_b2b_price_missing,
  (req.customer_facing AND req.requires_export_price
    AND coalesce(ps.channel_export, ps.field_export) IS NULL)        AS blocker_export_price_missing,
  -- Multiple currently-valid approved rows disagree — mirrors pricingBlockers()'s
  -- reviewRequiredChannels handling, a diagnostic rather than a silently-picked value.
  (req.customer_facing AND req.requires_mrp
    AND coalesce(ps.mrp_review_required, false))                    AS blocker_mrp_review_required,
  (req.customer_facing AND req.requires_b2b_price
    AND coalesce(ps.b2b_review_required, false))                    AS blocker_b2b_price_review_required,
  (req.customer_facing AND req.requires_export_price
    AND coalesce(ps.export_review_required, false))                 AS blocker_export_price_review_required,
  (req.customer_facing AND req.requires_packaging
    AND NOT (p.packaging_code IS NOT NULL AND p.packaging_code <> '')) AS blocker_packaging_missing,
  (req.customer_facing AND req.requires_hero_image
    AND (coalesce(dh.media_hero_url, p.hero_image_url) IS NULL
         OR btrim(coalesce(dh.media_hero_url, p.hero_image_url)) = '')) AS blocker_hero_image_missing,
  false                                                               AS product_truth_reconstructable
FROM products p
JOIN sku_analysis sa ON sa.id = p.id
JOIN sale_type_derivation st ON st.id = p.id
JOIN sale_type_requirements req ON req.sale_type = st.derived_sale_type
LEFT JOIN pricing_summary ps ON ps.id = p.id
LEFT JOIN derived_hero dh ON dh.product_id = p.id
WHERE p.is_catalogue_ready = true
ORDER BY p.sku;

-- ============================================================================
-- AUDIT B — SKU / PACKAGING CONSISTENCY
-- Compares the SKU's 5th segment against products.packaging_code and the
-- active sku_code_rules taxonomy. Classifies every row into exactly one of
-- the 9 categories from the audit brief.
-- ============================================================================

WITH sku_analysis AS (
  -- Trimmed per isStructuredOasisSku()'s own String(sku).trim(). sku_packaging_segment
  -- mirrors skuPackagingSegment() (uppercased, 6 parts, first = "OAS") — see Audit A's
  -- sku_analysis CTE for the full rationale on both.
  SELECT
    p.id,
    p.sku,
    p.packaging_code,
    CASE
      WHEN array_length(string_to_array(upper(btrim(p.sku)), '-'), 1) = 6
           AND (string_to_array(upper(btrim(p.sku)), '-'))[1] = 'OAS'
        THEN (string_to_array(upper(btrim(p.sku)), '-'))[5]
      ELSE NULL
    END AS sku_packaging_segment
  FROM products p
),
active_packaging AS (
  SELECT code FROM sku_code_rules WHERE code_type = 'packaging' AND is_active = true
)
SELECT
  p.id                                 AS product_id,
  p.sku,
  p.product_name,
  sa.sku_packaging_segment,
  p.packaging_code,
  (p.packaging_code IS NOT NULL AND btrim(p.packaging_code) = '' AND p.packaging_code <> '')
                                        AS packaging_code_whitespace_only,
  (sa.sku_packaging_segment IS NOT NULL
     AND EXISTS (SELECT 1 FROM active_packaging ap WHERE ap.code = sa.sku_packaging_segment))
                                        AS sku_segment_in_active_taxonomy,
  (p.packaging_code IS NOT NULL AND btrim(p.packaging_code) <> ''
     AND EXISTS (SELECT 1 FROM active_packaging ap WHERE ap.code = p.packaging_code))
                                        AS saved_code_in_active_taxonomy,
  CASE
    WHEN sa.sku_packaging_segment IS NULL AND (p.packaging_code IS NULL OR btrim(p.packaging_code) = '')
      THEN 'NOT_APPLICABLE'
    WHEN sa.sku_packaging_segment IS NULL
      THEN 'SKU_PACKAGING_MISSING_OR_MALFORMED'
    WHEN p.packaging_code IS NULL OR p.packaging_code = ''
      THEN 'SAVED_PACKAGING_MISSING'
    WHEN btrim(p.packaging_code) = '' AND p.packaging_code <> ''
      THEN 'SAVED_PACKAGING_MISSING'  -- whitespace-only: SQL treats as missing; app truthiness does NOT (see report finding NEW-1)
    WHEN upper(btrim(sa.sku_packaging_segment)) = upper(btrim(p.packaging_code))
         AND sa.sku_packaging_segment <> p.packaging_code
      THEN 'CASE_OR_WHITESPACE_NORMALIZATION_ONLY'
    WHEN sa.sku_packaging_segment = p.packaging_code
         AND NOT EXISTS (SELECT 1 FROM active_packaging ap WHERE ap.code = p.packaging_code)
      THEN 'BOTH_CODES_INVALID'
    WHEN sa.sku_packaging_segment = p.packaging_code
      THEN 'MATCH'
    WHEN NOT EXISTS (SELECT 1 FROM active_packaging ap WHERE ap.code = sa.sku_packaging_segment)
         AND NOT EXISTS (SELECT 1 FROM active_packaging ap WHERE ap.code = p.packaging_code)
      THEN 'BOTH_CODES_INVALID'
    WHEN NOT EXISTS (SELECT 1 FROM active_packaging ap WHERE ap.code = p.packaging_code)
      THEN 'SAVED_CODE_NOT_IN_ACTIVE_TAXONOMY'
    WHEN NOT EXISTS (SELECT 1 FROM active_packaging ap WHERE ap.code = sa.sku_packaging_segment)
      THEN 'SKU_CODE_NOT_IN_ACTIVE_TAXONOMY'
    ELSE 'SKU_VS_SAVED_PACKAGING_MISMATCH'
  END AS classification
FROM products p
JOIN sku_analysis sa ON sa.id = p.id
ORDER BY classification, p.sku;

-- Audit B summary counts (run after inspecting the row-level query above).
WITH sku_analysis AS (
  SELECT
    p.id,
    p.sku,
    p.packaging_code,
    CASE
      WHEN array_length(string_to_array(upper(btrim(p.sku)), '-'), 1) = 6
           AND (string_to_array(upper(btrim(p.sku)), '-'))[1] = 'OAS'
        THEN (string_to_array(upper(btrim(p.sku)), '-'))[5]
      ELSE NULL
    END AS sku_packaging_segment
  FROM products p
),
active_packaging AS (
  SELECT code FROM sku_code_rules WHERE code_type = 'packaging' AND is_active = true
),
classified AS (
  SELECT
    CASE
      WHEN sa.sku_packaging_segment IS NULL AND (p.packaging_code IS NULL OR btrim(p.packaging_code) = '')
        THEN 'NOT_APPLICABLE'
      WHEN sa.sku_packaging_segment IS NULL
        THEN 'SKU_PACKAGING_MISSING_OR_MALFORMED'
      WHEN p.packaging_code IS NULL OR p.packaging_code = ''
        THEN 'SAVED_PACKAGING_MISSING'
      WHEN btrim(p.packaging_code) = '' AND p.packaging_code <> ''
        THEN 'SAVED_PACKAGING_MISSING'
      WHEN upper(btrim(sa.sku_packaging_segment)) = upper(btrim(p.packaging_code))
           AND sa.sku_packaging_segment <> p.packaging_code
        THEN 'CASE_OR_WHITESPACE_NORMALIZATION_ONLY'
      WHEN sa.sku_packaging_segment = p.packaging_code
           AND NOT EXISTS (SELECT 1 FROM active_packaging ap WHERE ap.code = p.packaging_code)
        THEN 'BOTH_CODES_INVALID'
      WHEN sa.sku_packaging_segment = p.packaging_code
        THEN 'MATCH'
      WHEN NOT EXISTS (SELECT 1 FROM active_packaging ap WHERE ap.code = sa.sku_packaging_segment)
           AND NOT EXISTS (SELECT 1 FROM active_packaging ap WHERE ap.code = p.packaging_code)
        THEN 'BOTH_CODES_INVALID'
      WHEN NOT EXISTS (SELECT 1 FROM active_packaging ap WHERE ap.code = p.packaging_code)
        THEN 'SAVED_CODE_NOT_IN_ACTIVE_TAXONOMY'
      WHEN NOT EXISTS (SELECT 1 FROM active_packaging ap WHERE ap.code = sa.sku_packaging_segment)
        THEN 'SKU_CODE_NOT_IN_ACTIVE_TAXONOMY'
      ELSE 'SKU_VS_SAVED_PACKAGING_MISMATCH'
    END AS classification
  FROM products p
  JOIN sku_analysis sa ON sa.id = p.id
)
SELECT classification, count(*) AS row_count
FROM classified
GROUP BY classification
ORDER BY row_count DESC;

-- ============================================================================
-- AUDIT C — INTERNAL PRODUCT MISCLASSIFICATION CANDIDATES
-- IMPORTANT: sale_type was never a persisted column at any point in this
-- application's history (see saleType.ts docblock). There is NO durable field
-- that can prove a product was originally intended as internal_bom. This
-- query can only surface *candidates* via indirect signals — it cannot
-- VERIFY original intent. Every row from this query is at best
-- HIGH_CONFIDENCE_REVIEW or POSSIBLE_REVIEW, never VERIFIED_MISCLASSIFIED,
-- unless cross-referenced against an external, durable record (e.g. a
-- preserved catalogue draft payload) not queried here.
-- ============================================================================

SELECT
  p.id                              AS product_id,
  p.sku,
  p.product_name,
  p.product_class,
  p.main_department,
  p.production_department,
  p.category,
  p.subcategory,
  p.bom_required,
  p.is_catalogue_ready,
  p.is_active,
  p.hero_image_url,
  (EXISTS (
     SELECT 1 FROM product_pricing_rules ppr
     WHERE ppr.product_id = p.id AND ppr.approval_status = 'approved'
   ))                               AS has_any_approved_pricing,
  CASE
    WHEN p.bom_required = true AND p.is_catalogue_ready = true
      THEN 'HIGH_CONFIDENCE_REVIEW'   -- flagged as a BOM/component input yet marked catalogue-ready
    WHEN p.bom_required = true
      THEN 'POSSIBLE_REVIEW'
    ELSE 'UNVERIFIABLE_BECAUSE_SALE_TYPE_WAS_NOT_PERSISTED'
  END AS classification
FROM products p
WHERE p.bom_required = true
   OR lower(coalesce(p.main_department, '')) = 'packing_material'
ORDER BY classification, p.sku;

-- ============================================================================
-- AUDIT D — PACKAGING TAXONOMY INTEGRITY
-- Products where packaging is required by sale type (per saleType.ts) but the
-- saved packaging_code fails one or more integrity checks.
-- ============================================================================

WITH sale_type_derivation AS (
  SELECT
    p.id,
    CASE
      WHEN lower(coalesce(p.product_class, '')) = 'ready_pack' THEN 'retail_ready_pack'
      WHEN lower(coalesce(p.product_class, '')) = 'gift_hamper' THEN 'gift_hamper'
      WHEN lower(coalesce(p.product_class, '')) = 'bulk_loose_product' THEN 'b2b_horeca'
      WHEN lower(coalesce(p.main_department, '')) = 'packing_material'
        OR lower(coalesce(p.category, '')) LIKE '%packaging%' THEN 'packaging_material'
      ELSE 'b2b_horeca'
    END AS derived_sale_type
  FROM products p
),
requires_packaging AS (
  SELECT sale_type, requires_packaging FROM (VALUES
    ('retail_ready_pack', true),
    ('b2b_horeca',        true),
    ('export',            true),
    ('internal_bom',      false),
    ('gift_hamper',       true),
    ('packaging_material', false)
  ) AS r(sale_type, requires_packaging)
),
active_packaging AS (
  SELECT code FROM sku_code_rules WHERE code_type = 'packaging' AND is_active = true
)
SELECT
  p.id                                AS product_id,
  p.sku,
  p.product_name,
  st.derived_sale_type,
  p.packaging_code,
  p.pcs_per_pack,
  p.pack_size,
  p.is_catalogue_ready,
  (p.packaging_code IS NULL)                                          AS packaging_code_null,
  (p.packaging_code = '')                                              AS packaging_code_blank,
  (p.packaging_code IS NOT NULL AND btrim(p.packaging_code) = ''
     AND p.packaging_code <> '')                                       AS packaging_code_whitespace_only,
  (p.packaging_code IS NOT NULL AND btrim(p.packaging_code) <> ''
     AND NOT EXISTS (SELECT 1 FROM active_packaging ap WHERE ap.code = p.packaging_code))
                                                                        AS packaging_code_not_in_active_taxonomy,
  ((p.pcs_per_pack IS NOT NULL OR (p.pack_size IS NOT NULL AND p.pack_size <> ''))
     AND (p.packaging_code IS NULL OR p.packaging_code = ''))          AS qty_or_pack_text_without_taxonomy_code,
  -- Reproduces the app's current (unsafe) gate check exactly, per Section 8 finding:
  (p.packaging_code IS NOT NULL AND p.packaging_code <> '')            AS would_pass_app_hasPackagingTaxonomyCode
FROM products p
JOIN sale_type_derivation st ON st.id = p.id
JOIN requires_packaging rp ON rp.sale_type = st.derived_sale_type
WHERE rp.requires_packaging = true
  AND (
    p.packaging_code IS NULL
    OR p.packaging_code = ''
    OR (p.packaging_code IS NOT NULL AND btrim(p.packaging_code) = '' AND p.packaging_code <> '')
    OR NOT EXISTS (SELECT 1 FROM active_packaging ap WHERE ap.code = p.packaging_code)
  )
ORDER BY p.is_catalogue_ready DESC, p.sku;

ROLLBACK;
-- End of read-only audit. No statement above this line can mutate data —
-- the transaction is rolled back unconditionally even though nothing was
-- written, as an explicit safety guarantee for anyone re-running this file.
