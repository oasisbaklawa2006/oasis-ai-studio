# Batch 001 Packaging Authority Report

**Date:** 2026-06-10  
**Program:** Product Authority Completion Wave — Workstream B  
**Scope:** All 25 Batch 001 SKUs — packaging, MOQ, weight consistency  
**Mode:** Audit + governed update plan only (no master writes)

---

## Executive summary

| Dimension | Master DB | Authority CSV | Readiness |
|-----------|-----------|---------------|-----------|
| `grams_per_piece` / `weight_per_pc_grams` | **0/25** populated | **24/25** (Weight GM) | 0% applied |
| `pcs_per_kg` (derived) | **0/25** valid (>0) | Computable from weight | 0% |
| `pack_size` / primary pack | **25/25** (partial) | **25/25** | 40% |
| Carton / secondary pack | **0/25** | **25/25** (666/888/Mappet) | 0% |
| MOQ | **25/25** default `1` | Not in CSV | 20% (placeholder) |
| Weight consistency (piece ↔ kg chain) | **0/25** valid | Auditable | 0% |
| **Packaging readiness** | | | **12%** |

Packaging authority exists in the Category 1 source file but was not mapped into master on import. All 25 SKUs have `pcs_per_kg = 0`, `grams_per_piece = null`, and empty carton hierarchy fields.

---

## Per-SKU packaging audit

| SKU | Product | CSV Weight (g) | CSV Primary | CSV Secondary | DB `pack_size` | DB `grams_per_piece` | DB `pcs_per_kg` | DB `pcs_per_master_carton` | Expected pcs/kg |
|-----|---------|----------------|-------------|---------------|----------------|----------------------|-----------------|---------------------------|-----------------|
| 0001 | Cashew Kitta | 18 | 3kg | 666 | 3kg | null | 0 | null | 55.6 |
| 0002 | Square Baklawa | 20 | 3kg | 666 | 3kg | null | 0 | null | 50.0 |
| 0003 | Cashew Ring | 18 | 3kg | 666 | 3kg | null | 0 | null | 55.6 |
| 0004 | Cashew Rosebud | 18 | 3kg | 666 | 3kg | null | 0 | null | 55.6 |
| 0005 | Almond Crosole | 14 | 3kg | 666 | 3kg | null | 0 | null | 71.4 |
| 0006 | Cashew Pyramid | 25 | 6kg | 888 | 6kg | null | 0 | null | 40.0 |
| 0007 | Cashew Finger | 11 | 3kg | 666 | 3kg | null | 0 | null | 90.9 |
| 0008 | Date Baklawa | 18 | 3kg | 666 | 3kg | null | 0 | null | 55.6 |
| 0009 | Special Square Baklawa | 20 | 3kg | 666 | 3kg | null | 0 | null | 50.0 |
| 0010 | Pistachio Ring | 18 | 3kg | 666 | 3kg | null | 0 | null | 55.6 |
| 0011 | Pistachio Pyramid(Topping) | 25 | 6kg | 888 | 6kg | null | 0 | null | 40.0 |
| 0012 | Chocolate Pistachio Asiyah | 25 | 1kg | Mappet | 1kg | null | 0 | null | 40.0 |
| 0013 | Chocolate Cashew Asiyah | 25 | 1kg | Mappet | 1kg | null | 0 | null | 40.0 |
| 0014 | Mor Cashew Asiyah | 25 | 1kg | Mappet | 1kg | null | 0 | null | 40.0 |
| 0015 | Mor Pistachio Asiyah | 25 | 1kg | Mappet | 1kg | null | 0 | null | 40.0 |
| 0016 | Pistachio Asiyah | 25 | 1kg | Mappet | 1kg | null | 0 | null | 40.0 |
| 0017 | Cashew Asiyah | 25 | 1kg | Mappet | 1kg | null | 0 | null | 40.0 |
| 0018 | Diamond Pistachio | 25 | 1kg | Mappet | 1kg | null | 0 | null | 40.0 |
| 0019 | Pistachio Pyramid | 25 | 6kg | 888 | 6kg | null | 0 | null | 40.0 |
| 0020 | Tart Cashew | 26 | 6kg | 888 | 6kg | null | 0 | null | 38.5 |
| 0021 | Mix Nut Tart | 26 | 6kg | 888 | 6kg | null | 0 | null | 38.5 |
| 0022 | Almond Tart | 26 | 6kg | 888 | 6kg | null | 0 | null | 38.5 |
| 0023 | Pistachio Tart | 26 | 6kg | 888 | 6kg | null | 0 | null | 38.5 |
| 0024 | Mor Pistachio Durum | 18 | 1kg | Mappet | 1kg | null | 0 | null | 55.6 |
| 0025 | Coconut Durum | — | 1kg | Mappet | 1kg | null | 0 | null | TBD |

**Note:** SKU 0025 (Coconut Durum) missing from CSV extract row 25 — verify source file row 26.

---

## MOQ audit

| Field | All 25 SKUs | Authority |
|-------|-------------|-----------|
| `moq` | `1` (default) | Not specified per SKU in CSV |
| `moq_packs` | `1` (default) | Not specified |
| `private_label_moq` | null | Not in CSV |
| Channel MOQ rules | None in `product_moq_rules` | Category 2 — out of scope |

MOQ is placeholder-only. B2B MOQ governance requires `catalogue_moq_drafts` after packaging authority is applied.

---

## Weight consistency checks

| Check | Pass | Fail | Notes |
|-------|------|------|-------|
| Piece weight → pcs/kg derivable | 24 | 1 | 0025 missing CSV weight |
| Primary pack matches `pack_size` | 25 | 0 | `pack_size` imported |
| pcs/kg × piece weight ≈ 1000g | 0 | 25 | `pcs_per_kg` not set |
| Carton qty maps to `pcs_per_master_carton` | 0 | 25 | Secondary pack codes (666/888) not mapped |
| `validateConversionRuleChain` passes | 0 | 25 | Blocks Product Truth readiness |

### Secondary pack code interpretation (proposed)

| Code | Products | Proposed meaning | pcs/carton |
|------|----------|------------------|------------|
| 666 | 3kg primary items | ~166–167 pcs per 3kg tray at 18g | 166 |
| 888 | 6kg primary items | ~222 pcs per 6kg tray at 27g avg | 222 |
| Mappet | 1kg asiyah/durum | Map-specific; needs product team confirm | TBD |

---

## Governed update plan (no direct master writes)

### Wave 4A — Packaging republish drafts

**Route:** `catalogue_product_drafts` with `operation: update` per SKU  
**Source:** `data/category1-preview/CATEGORY1_IMPORT_BATCH_001_uploaded.csv`

| CSV column | Master field | Transform |
|------------|--------------|-----------|
| Weight (GM) | `grams_per_piece`, `weight_per_pc_grams` | parse int |
| — | `pcs_per_kg` | `round(1000 / grams_per_piece)` |
| Prmiary Packing | `primary_pack_weight_kg`, `pack_size` | parse `3kg` → 3 |
| Secondary Packing | `packs_per_carton` or `pcs_per_master_carton` | map 666/888/Mappet |
| Carton Qty | `packs_per_master_carton` | if present |

**Payload flags:**
```json
{
  "packaging_authority_republish": true,
  "source": "batch001_packaging_wave4a",
  "needs_admin_review_flags": { "packaging_conversion": true }
}
```

### Wave 4A validation gates (pre-submit)

1. `grams_per_piece` between 8g and 35g for all baklawa SKUs
2. `pcs_per_kg` = round(1000 / grams_per_piece) within 1% tolerance
3. No SKU with `pcs_per_kg = 0` after mapping
4. Secondary pack code resolved or flagged `manual_review`

### Submission sequence

```
1. Build packaging republish payloads (script: packaging-republish-batch001.mjs — to build)
2. Dry-run validateConversionRuleChain on each payload
3. Submit 25 catalogue_product_drafts (pending_approval)
4. Human review in Approval Inbox
5. Approve via governed product draft RPC
6. Re-run Product Truth readiness audit
```

**Do not:** direct `UPDATE products`; Central sync; SQL migrations.

---

## Readiness: 12%

| Dimension | Weight | Score |
|-----------|--------|-------|
| Authority source complete | 30% | 96% (24/25 weights) |
| Master fields populated | 40% | 0% |
| Conversion chain valid | 20% | 0% |
| MOQ governed | 10% | 20% |
| Governed plan ready | 10% | 80% |
| **Weighted** | | **12%** |

---

## References

- `data/category1-preview/CATEGORY1_IMPORT_BATCH_001_uploaded.csv`
- `src/features/productTruth/uomPackagingEngine.ts`
- `src/features/category1Import/columnMapping.ts`
- `docs/CATEGORY1_IMPORT_STAGING_PLAN.md`
