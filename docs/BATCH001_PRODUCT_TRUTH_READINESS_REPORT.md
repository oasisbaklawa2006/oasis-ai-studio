# Batch 001 Product Truth Readiness Report

**Date:** 2026-06-10  
**Program:** AI Studio Catalogue Authority Completion Wave — Workstream B  
**Scope:** All 25 Batch 001 SKUs (`OAS-AS-BKL-0001` … `OAS-AS-BKL-0025`)  
**Mode:** Read-only audit — no master writes, no Central sync

---

## Executive summary

| Dimension | Ready (25-SKU avg) | Blocker |
|-----------|-------------------|---------|
| Identity / content | **100%** | — |
| UOM (basic) | **100%** | Primary + channel UOM present |
| Tax / HSN | **100%** | HSN `21069099`, GST 5% on all |
| Pricing (raw fields) | **100%** | MRP + `price_b2b` populated |
| Production mapping | **100%** | `ready_goods_store` → `arabic_sweets` |
| Language authority | **68%** | 17/25 SKUs have approved aliases |
| Packaging conversion | **0%** | `pcs_per_kg` = 0, `grams_per_piece` null |
| Media | **0%** | `image_url` null on all 25 |
| Compliance approval | **0%** | `allergen_warnings` = "Imported — requires review" |
| Channel visibility | **0%** | `visible_in_catalog` = false on all |
| Pricing/MOQ governance | **0%** | No approved channel price rules in UI path |
| **Overall Product Truth readiness** | **42%** | |

All 25 products exist in master with strong identity and tax foundations. Catalogue-publishable Product Truth is blocked by media, packaging, compliance sign-off, and channel governance gaps on every SKU.

---

## Audit methodology

Data source: live Supabase (`tcxvcatsqqertcnycuop`) `products` table, queried 2026-06-10.

Readiness engine reference: `src/features/productTruth/productReadiness.ts` — dimensions evaluated per SKU against the same rules the Product Edit UI uses when `complianceApproved: false` and channel prices are empty.

---

## Per-dimension findings (25/25 SKUs)

### 1. Media readiness — 0%

| Field | Status (all 25) |
|-------|-----------------|
| `image_url` | null |
| `hero_image_url` | null / unused |
| Media assets in UI | None uploaded |
| `media_status` | Not approved |

**Blocker:** `evaluateProductReadiness` requires hero image or approved media assets. `ProductEdit` does not pass approved media for Batch 001 imports.

**Source CSV hint:** Category 1 file has weight/shelf-life but no image URLs. Media upload is a manual post-import step.

### 2. UOM readiness — 100% (basic), 0% (conversion)

| Field | Value (all 25) |
|-------|----------------|
| `uom` | KG |
| `retail_uom` | pc |
| `b2b_uom` | kg |

**Gap:** `validateConversionRuleChain` fails — `pcs_per_kg` = 0 and `grams_per_piece` null. Source CSV has piece weights (e.g. 18g, 20g) but these were not mapped into master on import.

### 3. Packaging readiness — 0%

| Field | Status |
|-------|--------|
| `pcs_per_kg` | 0 |
| `grams_per_piece` | null |
| `master_carton_qty` | null / 0 |
| Primary/secondary pack | Not in master |

Source CSV (`CATEGORY1_IMPORT_BATCH_001_uploaded.csv`) contains `Weight (GM)`, `Carton Qty`, `Prmiary Packing`, `Secondary Packing` — available for a governed republish draft, not yet applied.

### 4. Pricing / MOQ readiness — 35%

| Field | Status |
|-------|--------|
| `mrp` | Populated (₹30–₹115) |
| `price_b2b` | Populated (₹595–₹2250/kg) |
| Channel price rules | Not in `product_pricing_rules` |
| MOQ rules | Not in `product_moq_rules` |
| UI `priceStatus: approved` | Never set |

Raw import prices exist but the governed pricing engine (`channelPricingMoqEngine`) has no approved rules. Catalogue Builder passes empty price arrays → cards show no selling price.

### 5. Compliance readiness — 50% (data), 0% (approved)

| Field | Status |
|-------|--------|
| `hsn_code` | `21069099` (all) |
| `gst_rate` | `0.05` (all) |
| `ingredients` | null |
| `shelf_life_days` | null (CSV says 90 days) |
| `allergen_warnings` | "Imported — requires review" |
| `complianceApproved` in UI | false |

Tax codes are present but manual compliance approval has not been performed. `evalCompliance` blocks Central sync and catalogue publishability.

### 6. Channel readiness — 0%

| Field | Status |
|-------|--------|
| `visible_in_catalog` | false (all 25) |
| Public catalogue inclusion | None |
| Channel-specific display text | Not configured |

Products are master-visible internally but not channel-published.

### 7. Language readiness — 68%

| Metric | Value |
|--------|-------|
| SKUs with approved aliases | 17/25 |
| Total approved aliases | 201 |
| SKUs with zero aliases | 8 (Wave 2C backlog) |

See `docs/BATCH001_LANGUAGE_AUTHORITY_REPORT.md` for detail.

---

## SKU-level scorecard (sample)

| SKU | Name | Media | UOM | Pack | Price | Compliance | Channel | Language |
|-----|------|-------|-----|------|-------|------------|---------|----------|
| 0001 | Cashew Kitta | ✗ | ✓ | ✗ | partial | partial | ✗ | ✓ (12) |
| 0002 | Square Baklawa | ✗ | ✓ | ✗ | partial | partial | ✗ | ✗ (0) |
| 0013 | Chocolate Cashew Asiyah | ✗ | ✓ | ✗ | partial | partial | ✗ | ✓ (20) |
| 0018 | Diamond Pistachio | ✗ | ✓ | ✗ | partial | partial | ✗ | ✗ (0) |

All 25 SKUs follow the same pattern: strong identity/tax, weak media/packaging/compliance/channel.

---

## Product Truth snapshot gap

`products.product_truth_snapshot` column exists in Central schema but is **not written** from Product Edit or import staging. No versioned Product Truth snapshot exists for Batch 001.

Impact: Catalogue Builder and public catalogue cannot consume a frozen authority snapshot; they read live `products` with incomplete fields.

---

## Readiness score: 42%

| Dimension | Weight | Avg score |
|-----------|--------|-----------|
| Identity + tax + basic UOM | 25% | 100% |
| Packaging + media | 25% | 0% |
| Pricing/MOQ governance | 15% | 35% |
| Compliance approval | 15% | 0% |
| Channel visibility | 10% | 0% |
| Language authority | 10% | 68% |
| **Weighted total** | | **42%** |

---

## Recommended remediation (governed, no direct master writes)

| Priority | Action | Path |
|----------|--------|------|
| P0 | Map CSV piece weights → packaging draft fields | Category 1 republish draft per SKU |
| P0 | Upload hero images (minimum 1 per SKU) | Media tab → `catalogue_media_drafts` |
| P1 | Compliance review queue (ingredients, allergens, shelf life) | Product Edit compliance section |
| P1 | Approve channel pricing rules (retail + B2B) | `catalogue_pricing_drafts` |
| P2 | Set `visible_in_catalog` via governed product draft | After media + compliance gates pass |
| P2 | Write `product_truth_snapshot` on approval | Requires snapshot RPC (not built) |
| P3 | Complete Wave 2C language for 8 SKUs | Language wave (separate workstream) |

---

## References

- `src/features/productTruth/productReadiness.ts`
- `data/category1-preview/CATEGORY1_IMPORT_BATCH_001_uploaded.csv`
- `docs/AI_STUDIO_PRODUCT_TRUTH_MVP_BUILD_REPORT.md`
- `docs/BATCH001_LANGUAGE_AUTHORITY_REPORT.md`
