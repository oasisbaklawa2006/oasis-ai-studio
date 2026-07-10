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
-- STATUS AS WRITTEN (2026-07-10, original audit draft)
--   This file was originally authored during the PR #76 audit but was NOT
--   executed against any database in that pass. Phase 2 (Environment Identity
--   Gate) of that audit could not conclusively determine which Supabase
--   project backs the deployed oasis-ai-studio production application.
--
-- STATUS AS OF PHASE 1 EXECUTION (2026-07-10, durable closeout)
--   The PR #76 draft above was NEVER executed. This file WAS executed
--   read-only against confirmed production project `tcxvcatsqqertcnycuop` on
--   2026-07-10, against repository main commit
--   d3b83e702f0471b91542cc78e8b48d9797b68365, after the owner independently
--   verified the production Supabase project reference from the live
--   deployed bundle (see docs/audits/2026-07-10-product-integrity-audit.md,
--   "Phase 1 Durable Closeout" section, for the full evidence trail). Zero
--   rows were mutated; every statement ran inside BEGIN TRANSACTION READ ONLY
--   with an explicit SET LOCAL statement_timeout, followed by ROLLBACK.
--   Mid-execution, this file's original pricing fallback columns
--   (products.b2b_price, products.b2b_price_inr, products.export_price,
--   products.export_price_usd) were found NOT to exist on production —
--   confirmed via information_schema.columns — and have been corrected below
--   (see "SCHEMA-DRIFT CORRECTION" comments at each site). The file as
--   committed now matches the columns that actually exist and is re-runnable
--   unchanged against the same project.
--
-- IMPORTANT — THIS FILE DOES NOT UNIFORMLY REPRODUCE CURRENT (POST-PR-#77)
-- APPLICATION BEHAVIOUR. Two DIFFERENT packaging evaluations coexist below,
-- deliberately, and must not be confused with each other:
--   1. LEGACY TRUTHINESS BLAST-RADIUS MEASUREMENT (Audit A's
--      `packaging_present_by_app_truthiness` / `blocker_packaging_missing`,
--      and Audit D's `would_pass_app_hasPackagingTaxonomyCode`) — intentionally
--      reproduces the PRE-PR-#77 `hasPackagingTaxonomyCode() = !!form.packaging_code`
--      truthiness check (a bare non-empty check, no taxonomy or SKU-segment
--      validation). Kept as-is on purpose, to measure how many products the
--      OLD buggy check would have silently passed. This is historical
--      measurement, NOT current app behaviour.
--   2. CURRENT-GATE EVALUATION (Audit A's new `packaging_ready_under_current_gate`
--      / `blocker_packaging_missing_current_gate` columns, and Audit D's new
--      `packaging_ready_under_current_gate` column) — an exact SQL reproduction
--      of `evaluatePackagingReadiness()` as merged in PR #77
--      (src/features/productAuthority/catalogueReadyGate.ts): the saved
--      packaging_code must be non-empty after normalization, must be an
--      active `sku_code_rules` taxonomy code, AND — when the SKU itself
--      encodes a packaging segment — that segment must agree with the saved
--      code after normalization. This is what the live app actually enforces
--      today. Any row where the two evaluations disagree (legacy truthiness
--      says "present", current gate says "not ready") is exactly the kind of
--      case PR #77 fixed going forward but that may still exist as
--      already-saved data — see e.g. OAS-AS-BKL-ASS-RBOX-0002 in the report.
--
-- STATUS AS OF POST-R1A PRICING-AUTHORITY RECOVERY (2026-07-10)
--   R1A (owner product-decision worksheet) surfaced a second, distinct application
--   defect: resolvePricing() (src/features/productAuthority/pricingAuthority.ts) queried
--   channelOf("retail") to compute MRP and never queried the "mrp" channel at all. In
--   production, "mrp" and "retail" are separate, independently-used price_channel values
--   (28 approved 'retail' rows vs. 15 approved 'mrp' rows database-wide) — every approved
--   mrp-channel rule was being silently ignored by the app. This was fixed in
--   pricingAuthority.ts (resolvePricing now calls channelOf("mrp", ...)) and mirrored here:
--     - pricing_summary_raw's channel_mrp now reads channel = 'mrp' (was 'retail').
--     - A new mrp_field_conflict diagnostic (pricing_summary CTE) flags when the selected
--       approved mrp-channel rule disagrees with a positive products.mrp fallback value —
--       mirroring pricingAuthority.ts's new conflict check — rather than silently trusting
--       either source. Production example: OAS-AS-BKL-0007 (mrp-channel rule = 25 vs.
--       products.mrp = 40).
--     - blocker_mrp_review_required now also considers mrp_field_conflict, not only
--       multiple-disagreeing-approved-rows.
--   A read-only blast-radius query (tcxvcatsqqertcnycuop) confirmed ZERO catalogue-ready
--   products had any approved 'retail'-channel rule at all, so "retail" is not retained as
--   an MRP fallback anywhere in this file or in the app — removing it created no verified
--   regression. See pricingAuthority.ts's canonical-semantics docblock for the full
--   producer/consumer contract this file now reproduces.
--
-- AUTHORITY SOURCE FOR EVERY RULE BELOW
--   Every classification below is a direct SQL reproduction of the corrected
--   application logic merged in PR #75 (commit 443ba403523dcedb9552def684368b30aae28828)
--   and PR #77 (commit d3b83e702f0471b91542cc78e8b48d9797b68365), except where
--   explicitly marked above as the intentionally-retained legacy measurement:
--     - Structured SKU validity: src/features/productAuthority/skuGuard.ts
--         isStructuredOasisSku()
--     - SKU packaging segment: 5th dash-separated part of OAS-DIV-CAT-SUBCAT-PKG-SEQ
--         (src/features/productAuthority/skuGuard.ts skuPackagingSegment(), exported
--         there since PR #77; originally private to saveFastCreateProduct.ts)
--     - Packaging readiness under the CURRENT gate: src/features/productAuthority/
--         catalogueReadyGate.ts evaluatePackagingReadiness() (PR #77) — active
--         taxonomy membership + SKU-segment agreement, see new columns described above.
--     - Packaging presence under the LEGACY blast-radius measurement:
--         hasPackagingTaxonomyCode() = !!form.packaging_code (JS truthiness, the
--         pre-PR-#77 check — intentionally retained, see note above, NOT current
--         app behaviour)
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
SET LOCAL statement_timeout = '30s';

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
--   sku_packaging_segment mirrors skuPackagingSegment() (originally private to
--   saveFastCreateProduct.ts as of PR #75, exported from skuGuard.ts since PR #77)
--   exactly, NOT isStructuredOasisSku()'s strict regex: uppercase the trimmed
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
    -- sku_packaging_segment mirrors skuPackagingSegment() (skuGuard.ts since PR #77,
    -- originally private to saveFastCreateProduct.ts), NOT isStructuredOasisSku()'s
    -- strict regex — that function uppercases the
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
active_packaging AS (
  SELECT code FROM sku_code_rules WHERE code_type = 'packaging' AND is_active = true
),
current_gate_packaging AS (
  -- CURRENT-GATE EVALUATION — exact SQL reproduction of evaluatePackagingReadiness()
  -- (src/features/productAuthority/catalogueReadyGate.ts, PR #77). This is NOT the same
  -- thing as packaging_present_by_app_truthiness below — see the file header's
  -- "IMPORTANT" note for why both are kept, deliberately, side by side.
  --   Ready requires ALL of:
  --     1. normalized packaging_code (trim + uppercase) is non-empty;
  --     2. that normalized code is an active sku_code_rules taxonomy code;
  --     3. when the SKU itself encodes a packaging segment (sku_analysis above), that
  --        segment agrees with the normalized packaging_code — a mismatch (e.g. SKU says
  --        RBOX, saved code says MAAPET) blocks readiness even though both codes are
  --        individually valid, active taxonomy entries.
  SELECT
    sa.id,
    upper(btrim(coalesce(sa.packaging_code, ''))) AS normalized_packaging_code,
    (upper(btrim(coalesce(sa.packaging_code, ''))) <> ''
       -- Bugbot-caught: normalizePackagingCode() is applied to BOTH sides in the real
       -- app (packagingAuthorityFromRulesResult() maps every rule's own .code through
       -- normalizePackagingCode() when building the activeCodes Set, not just the
       -- input) -- ap.code must be normalized here too, not just sa.packaging_code, or
       -- a taxonomy row with stray casing/whitespace would wrongly fail to match.
       AND EXISTS (SELECT 1 FROM active_packaging ap WHERE upper(btrim(ap.code)) = upper(btrim(sa.packaging_code)))
       AND (
         sa.sku_packaging_segment IS NULL
         OR upper(btrim(sa.sku_packaging_segment)) = upper(btrim(sa.packaging_code))
       )
    ) AS packaging_ready_under_current_gate,
    (sa.sku_packaging_segment IS NOT NULL
       AND sa.packaging_code IS NOT NULL AND btrim(sa.packaging_code) <> ''
       AND upper(btrim(sa.sku_packaging_segment)) <> upper(btrim(sa.packaging_code))
    ) AS sku_packaging_code_mismatch
  FROM sku_analysis sa
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
pricing_summary_raw AS (
  SELECT
    p.id,
    -- PRICING-AUTHORITY FIX (POST-R1A recovery, 2026-07-10): resolvePricing() previously
    -- derived MRP from the 'retail' channel only (channelOf("retail")) and never queried
    -- the 'mrp' channel at all — production-wide, "mrp" and "retail" are distinct channel
    -- values (28 approved 'retail' rows vs. 15 approved 'mrp' rows database-wide; a
    -- read-only blast-radius query confirmed ZERO catalogue-ready products had any
    -- approved 'retail'-channel rule at all, so the "retail" channel is not retained as an
    -- MRP fallback — see pricingAuthority.ts's canonical-semantics docblock). Fixed to read
    -- the 'mrp' channel, matching pricingRuleRowToChannelPrice()'s isMrpChannel branch and
    -- the app-side fix in pricingAuthority.ts resolvePricing(). max() here is a no-op
    -- selector: newest_approved_pricing has at most one row per (product_id, channel) already.
    max(CASE WHEN ap.channel = 'mrp' THEN ap.price_value END)             AS channel_mrp,
    max(CASE WHEN ap.channel = 'b2b' THEN ap.price_value END)             AS channel_b2b,
    max(CASE WHEN ap.channel = 'export' THEN ap.price_value END)         AS channel_export,
    bool_or(rr.channel = 'mrp')                                          AS mrp_review_required,
    bool_or(rr.channel = 'b2b')                                          AS b2b_review_required,
    bool_or(rr.channel = 'export')                                       AS export_review_required,
    -- product-row fallback prices, per pricingAuthority.ts resolvePricing().
    CASE WHEN p.mrp > 0 THEN p.mrp END AS field_mrp,
    -- SCHEMA-DRIFT CORRECTION (Phase 1 durable closeout, 2026-07-10): the original draft
    -- of this file coalesced products.b2b_price and products.b2b_price_inr, matching the
    -- generated src/integrations/supabase/types.ts Row type. Neither column exists on
    -- live production (confirmed via information_schema.columns on tcxvcatsqqertcnycuop
    -- during Phase 1 execution) — the real column is products.price_b2b. types.ts is
    -- stale relative to the deployed schema; see the audit report's schema-drift finding.
    -- resolvePricing() itself also checks form.price_b2b as one of its candidate keys
    -- (pricingAuthority.ts: `num(form.b2b_price) ?? num(form.price_b2b) ?? num(form.b2b_price_inr)`),
    -- so this correction queries the one candidate column that is actually real.
    CASE WHEN p.price_b2b > 0 THEN p.price_b2b END AS field_b2b,
    -- SCHEMA-DRIFT CORRECTION: no export_price or export_price_usd column exists on live
    -- production's products table at all (confirmed via information_schema.columns) — no
    -- product-row fallback is possible for export, so this is a typed NULL, not a guess.
    -- Channel-rule resolution for export (channel_export above, from
    -- newest_approved_pricing/approved_pricing) is entirely unaffected by this gap — it
    -- reads product_pricing_rules, not this column, and continues to work normally. Only
    -- the product-row fallback tier is gapped.
    NULL::numeric AS field_export
  FROM products p
  LEFT JOIN newest_approved_pricing ap ON ap.product_id = p.id
  LEFT JOIN pricing_review_required rr ON rr.product_id = p.id
  GROUP BY p.id, p.mrp, p.price_b2b
),
pricing_summary AS (
  -- Conflict diagnostic (not silent): mirrors pricingAuthority.ts's new field-vs-rule
  -- conflict check — the approved mrp-channel rule remains authoritative (channel_mrp is
  -- still what resolved_mrp below uses), but a disagreeing positive products.mrp value
  -- must surface for operator review rather than being silently discarded. Production
  -- example: OAS-AS-BKL-0007 (approved mrp-channel rule = 25, products.mrp = 40).
  SELECT
    psr.*,
    (psr.channel_mrp IS NOT NULL AND psr.field_mrp IS NOT NULL
       AND psr.channel_mrp <> psr.field_mrp)                              AS mrp_field_conflict
  FROM pricing_summary_raw psr
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
  -- LEGACY blast-radius measurement (pre-PR-#77 truthiness) — see file header.
  (p.packaging_code IS NOT NULL AND p.packaging_code <> '')          AS packaging_present_by_app_truthiness,
  -- CURRENT-GATE evaluation (PR #77 evaluatePackagingReadiness()) — see file header and
  -- the current_gate_packaging CTE above. cgp.sku_packaging_code_mismatch is the exact
  -- flag that catches the RBOX-vs-MAAPET class of case.
  cgp.packaging_ready_under_current_gate,
  cgp.sku_packaging_code_mismatch,
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
  -- Multiple currently-valid approved rows disagree, OR the selected mrp-channel rule
  -- disagrees with a positive products.mrp fallback — mirrors pricingBlockers()'s
  -- reviewRequiredChannels handling (both diagnostics), a review signal rather than a
  -- silently-picked value. ps.mrp_field_conflict alone is the exact flag for the
  -- OAS-AS-BKL-0007-style rule-vs-field disagreement.
  (req.customer_facing AND req.requires_mrp
    AND (coalesce(ps.mrp_review_required, false) OR coalesce(ps.mrp_field_conflict, false)))
                                                                     AS blocker_mrp_review_required,
  ps.mrp_field_conflict,
  (req.customer_facing AND req.requires_b2b_price
    AND coalesce(ps.b2b_review_required, false))                    AS blocker_b2b_price_review_required,
  (req.customer_facing AND req.requires_export_price
    AND coalesce(ps.export_review_required, false))                 AS blocker_export_price_review_required,
  -- LEGACY blast-radius blocker (pre-PR-#77 truthiness) — see file header.
  (req.customer_facing AND req.requires_packaging
    AND NOT (p.packaging_code IS NOT NULL AND p.packaging_code <> '')) AS blocker_packaging_missing,
  -- CURRENT-GATE blocker (PR #77 evaluatePackagingReadiness()) — this is the blocker that
  -- actually governs the live app's save-time/auto-clear behaviour today.
  (req.customer_facing AND req.requires_packaging
    AND NOT coalesce(cgp.packaging_ready_under_current_gate, false)) AS blocker_packaging_missing_current_gate,
  (req.customer_facing AND req.requires_hero_image
    AND (coalesce(dh.media_hero_url, p.hero_image_url) IS NULL
         OR btrim(coalesce(dh.media_hero_url, p.hero_image_url)) = '')) AS blocker_hero_image_missing,
  false                                                               AS product_truth_reconstructable
FROM products p
JOIN sku_analysis sa ON sa.id = p.id
JOIN sale_type_derivation st ON st.id = p.id
JOIN sale_type_requirements req ON req.sale_type = st.derived_sale_type
LEFT JOIN current_gate_packaging cgp ON cgp.id = p.id
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
-- AUDIT C — BOM / CATALOGUE COHERENCE REVIEW (renamed; see POST-R1A correction)
-- IMPORTANT: sale_type was never a persisted column at any point in this
-- application's history (see saleType.ts docblock). There is NO durable field
-- that can prove a product was originally intended as internal_bom. This
-- query can only surface *candidates* for a coherence review via indirect
-- signals — it cannot VERIFY original intent, and it does NOT claim
-- high-confidence internal misclassification.
--
-- CORRECTION (POST-R1A pricing-authority recovery, 2026-07-10): this audit
-- previously labelled bom_required=true AND is_catalogue_ready=true rows
-- 'HIGH_CONFIDENCE_REVIEW' for "potential internal misclassification". That
-- was unsupported by the source: bom_required proves only that a BOM is
-- required. It does not prove the product is internal or non-sellable.
-- Packing & Assembly (main_department = 'packing_assembly') products
-- automatically require a BOM by design — they are EXPECTED BOM candidates,
-- not probable internal products — and gift hampers and other sellable
-- manufactured products can legitimately require a BOM too. Do not
-- recommend changing bom_required or catalogue-ready for any row below
-- without external operational evidence (production-team confirmation);
-- this query alone is never sufficient grounds for that change.
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
         AND lower(coalesce(p.main_department, '')) = 'packing_assembly'
      THEN 'EXPECTED_BOM_CANDIDATE_PACKING_ASSEMBLY'  -- BOM is the normal/expected state for this department; not a review signal
    WHEN p.bom_required = true AND p.is_catalogue_ready = true
      THEN 'BOM_CATALOGUE_COHERENCE_REVIEW'  -- worth a human look at the BOM/catalogue combination; NOT an internal-intent claim
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
),
sku_analysis AS (
  -- sku_packaging_segment mirrors skuPackagingSegment() (skuGuard.ts, exported there
  -- since PR #77) — see Audit A's sku_analysis CTE for the full rationale.
  SELECT
    p.id, p.packaging_code,
    CASE
      WHEN array_length(string_to_array(upper(btrim(p.sku)), '-'), 1) = 6
           AND (string_to_array(upper(btrim(p.sku)), '-'))[1] = 'OAS'
        THEN (string_to_array(upper(btrim(p.sku)), '-'))[5]
      ELSE NULL
    END AS sku_packaging_segment
  FROM products p
),
current_gate_packaging AS (
  -- CURRENT-GATE EVALUATION — exact reproduction of evaluatePackagingReadiness()
  -- (PR #77). See Audit A's current_gate_packaging CTE and the file header for the full
  -- rationale; identical logic, scoped to this audit's row set.
  SELECT
    sa.id,
    (upper(btrim(coalesce(sa.packaging_code, ''))) <> ''
       -- Bugbot-caught: normalizePackagingCode() is applied to BOTH sides in the real
       -- app (packagingAuthorityFromRulesResult() maps every rule's own .code through
       -- normalizePackagingCode() when building the activeCodes Set, not just the
       -- input) -- ap.code must be normalized here too, not just sa.packaging_code, or
       -- a taxonomy row with stray casing/whitespace would wrongly fail to match.
       AND EXISTS (SELECT 1 FROM active_packaging ap WHERE upper(btrim(ap.code)) = upper(btrim(sa.packaging_code)))
       AND (
         sa.sku_packaging_segment IS NULL
         OR upper(btrim(sa.sku_packaging_segment)) = upper(btrim(sa.packaging_code))
       )
    ) AS packaging_ready_under_current_gate,
    (sa.sku_packaging_segment IS NOT NULL
       AND sa.packaging_code IS NOT NULL AND btrim(sa.packaging_code) <> ''
       AND upper(btrim(sa.sku_packaging_segment)) <> upper(btrim(sa.packaging_code))
    ) AS sku_packaging_code_mismatch
  FROM sku_analysis sa
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
  -- LEGACY blast-radius measurement (pre-PR-#77 truthiness) — see file header. NOT
  -- current app behaviour.
  (p.packaging_code IS NOT NULL AND p.packaging_code <> '')            AS would_pass_app_hasPackagingTaxonomyCode,
  -- CURRENT-GATE evaluation (PR #77 evaluatePackagingReadiness()) — see file header.
  cgp.packaging_ready_under_current_gate,
  cgp.sku_packaging_code_mismatch
FROM products p
JOIN sale_type_derivation st ON st.id = p.id
JOIN requires_packaging rp ON rp.sale_type = st.derived_sale_type
LEFT JOIN current_gate_packaging cgp ON cgp.id = p.id
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
