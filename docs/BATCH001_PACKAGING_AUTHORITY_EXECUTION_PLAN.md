# Batch 001 Packaging Authority — Wave 4A Execution Plan

**Date:** 2026-06-10  
**Program:** Wave 4A — Packaging Authority  
**Scope:** `OAS-AS-BKL-0001` … `OAS-AS-BKL-0025` (25 SKUs)  
**Mode:** Governed draft plan only — no direct `products` updates, no SQL, no migrations, no Central sync, no auto-approval

---

## Executive summary

| Metric | Current master | After Wave 4A (projected) |
|--------|----------------|---------------------------|
| Packaging readiness | **12%** | **~68%** (24/25 with authority applied) |
| `grams_per_piece` populated | 0/25 | 24/25 (pending approval) |
| `pcs_per_kg` valid (>0) | 0/25 | 24/25 |
| Carton hierarchy mapped | 0/25 | 24/25 |
| MOQ governed | placeholder `1` | unchanged (Wave 4B) |

**Critical blocker:** `approve_catalogue_product_draft` on Central maps identity/pricing/`pack_size` only — **does not apply packaging scalar columns** (`grams_per_piece`, `pcs_per_kg`, carton fields). Wave **4A-0** must extend approval RPC mapping before drafts will move master readiness.

---

## Packaging fields audit

### Available on `products` (Central)

| Field | DB column | Batch 001 current | Authority source |
|-------|-----------|---------------------|------------------|
| Piece weight | `grams_per_piece`, `weight_per_pc_grams` | null / null | CSV `Weight (GM)` — 24/25 |
| pcs/kg conversion | `pcs_per_kg` | 0 | `round(1000 / grams_per_piece)` |
| Primary pack weight | `primary_pack_weight_kg`, `kg_per_primary_pack` | 0 | CSV `Prmiary Packing` (3kg/6kg/1kg) |
| Primary pack label | `pack_size` | 25/25 (partial) | CSV primary packing |
| Primary pack type | *(no column)* | — | Proposed: `Tray {primary}` → payload + future `carton_type` |
| Secondary pack code | `carton_type` | null | CSV `Secondary Packing` (666/888/Mappet) |
| Secondary pack type | *(no column)* | — | Proposed in draft `packing.secondary_pack_type` |
| Retail pack qty | *(no column)* | — | Proposed: `pcs_per_primary_pack` |
| Carton qty | `packs_per_master_carton` | null | CSV `Carton Qty` — **empty all rows** |
| Pcs per primary | `pcs_per_primary_pack` | 0 | derived: `primary_kg × 1000 / weight_g` |
| Pcs per master carton | `pcs_per_master_carton` | null | derived (1 tray/SKU until carton qty known) |
| Packs per carton | `packs_per_carton` | null | default 1 |
| MOQ | `moq`, `moq_packs` | 1 / 1 (placeholder) | not in CSV — Wave 4B |

### Missing or form-only (not persisted today)

| Requested field | Status |
|-----------------|--------|
| `primary_pack_type` | Form-only in ProductEdit; not a dedicated DB column — map via `carton_type` + payload |
| `secondary_pack_type` | No DB column — store in draft payload + `carton_type` code |
| `retail_pack_qty` | No DB column — use `pcs_per_primary_pack` as B2C proxy |
| `carton_qty` | CSV column empty; `packs_per_master_carton` available when authority supplies value |

---

## Authority source

**File:** `data/category1-preview/CATEGORY1_IMPORT_BATCH_001_uploaded.csv`

| CSV column | Maps to |
|------------|---------|
| `Weight (GM)` | `grams_per_piece`, `weight_per_pc_grams` |
| `Prmiary Packing` | `primary_pack_weight_kg`, `pack_size` |
| `Secondary Packing` | `carton_type`, secondary pack interpretation |
| `Carton Qty` | `packs_per_master_carton` *(empty for all 24 rows)* |

**Gap:** SKU `OAS-AS-BKL-0025` (Coconut Durum) exists in master but has **no CSV row** — weight and pack codes missing.

---

## Secondary pack mapping (666 / 888 / Mappet)

| Code | SKUs | Primary | Proposed interpretation | `pcs_per_primary_pack` formula |
|------|------|---------|-------------------------|--------------------------------|
| **666** | 10 | 3kg | Standard 3kg production tray | `round(3000 / weight_g)` → 150–273 |
| **888** | 7 | 6kg | Standard 6kg production tray | `round(6000 / weight_g)` → 231–240 |
| **Mappet** | 8 | 1kg | 1kg map tray — **needs ops confirm** | `round(1000 / weight_g)` → 40 or 56 |

> **Note:** Codes 666/888 are tray product codes, not literal piece counts. Derived pcs counts are mathematically consistent with primary kg ÷ piece weight.

---

## Per-SKU readiness (preview generator output)

| Readiness | Count | SKUs |
|-----------|-------|------|
| **READY** | 16 | 0001–0011, 0019–0023 (666/888 clusters) |
| **REVIEW** | 8 | 0012–0018, 0024 (Mappet — confirm tray/carton hierarchy) |
| **NEEDS_HUMAN** | 1 | 0025 (missing CSV row + weight) |

Full row-level preview: `data/packaging/batch001_packaging_update_preview.csv`  
Collision/errors: `data/packaging/batch001_packaging_collision_report.json`

---

## Weight consistency

| Check | Pass | Fail |
|-------|------|------|
| `pcs_per_kg × weight_g ≈ 1000g` (±10g) | 24 | 1 (0025) |
| Primary kg parses from CSV | 24 | 1 (0025) |
| Secondary code recognized | 24 | 1 (0025) |
| `validateConversionRuleChain` (preview) | 24 | 1 (0025) |
| Carton qty present | 0 | 25 (all empty in CSV) |

---

## Governed draft update path

### Draft submission: **YES**

| Item | Detail |
|------|--------|
| Table | `catalogue_product_drafts` |
| Operation | `update` |
| `target_record_id` | Existing product UUID per SKU |
| Payload shape | `data/packaging/batch001_packaging_drafts_payload.json` (24 drafts) |
| Submit mechanism | `submitCatalogueDraft({ draftType: "product", operation: "update", ... })` or governed insert script (dry-run default) |
| Auto-approve | **NO** — human Approval Inbox only |

### Draft approval applies packaging scalars: **NO** (blocker)

Live Central `approve_catalogue_draft_internal` product branch UPDATE sets:

- `name`, `category`, `pricing`, `uom`, `pack_size` (from `packing.pack_preview` / `primary_pack_type`)

It does **not** set:

- `grams_per_piece`, `weight_per_pc_grams`, `pcs_per_kg`
- `primary_pack_weight_kg`, `kg_per_primary_pack`
- `carton_type`, `pcs_per_primary_pack`, `pcs_per_master_carton`, `packs_per_*`

**Wave 4A-0 (prerequisite):** Extend `approve_catalogue_draft_internal` product UPDATE branch to map `payload.packing.packaging_scalars` and `payload.uom` weight fields. Governed migration only — out of scope for this execution plan commit.

---

## Recommended approval batches

Execute **after** Wave 4A-0 RPC extension. Do not submit until mapping is verified on staging.

| Batch | SKUs | Count | Gate |
|-------|------|-------|------|
| **4A-1** | 0001–0005, 0007–0010 | 10 | 3kg / 666 — READY |
| **4A-2** | 0006, 0011, 0019–0023 | 7 | 6kg / 888 — READY |
| **4A-3** | 0012–0018 | 7 | 1kg / Mappet — after ops confirms tray hierarchy |
| **4A-4** | 0024 | 1 | 1kg / Mappet durum — confirm 56 pcs/tray |
| **4A-5** | 0025 | 1 | After authority row added (suggest 18g like 0024, 1kg Mappet) |

**Suggested human review order:** 4A-1 → 4A-2 → 4A-3 → 4A-4 → 4A-5

---

## Execution sequence

```
Wave 4A-0  Extend approve_catalogue_product_draft packaging scalar mapping (governed migration)
Wave 4A-1  node scripts/generate-batch001-packaging-preview.mjs  (regenerate preview)
Wave 4A-2  Dry-run validate all 24 payloads; confirm no duplicate pending drafts
Wave 4A-3  Submit catalogue_product_drafts (operation=update) — batches 4A-1..4A-4
Wave 4A-4  Human approve in Approval Inbox (no auto-approve)
Wave 4A-5  Re-run Product Truth readiness + packaging audit
Wave 4A-6  Add CSV row for 0025; submit batch 4A-5
```

**Do not:** `UPDATE products` directly; run SQL insert batches without review; enable Central sync; auto-approve.

---

## Artifacts delivered

| Artifact | Path |
|----------|------|
| Update preview CSV | `data/packaging/batch001_packaging_update_preview.csv` |
| Collision / error report | `data/packaging/batch001_packaging_collision_report.json` |
| Draft payload preview (24 SKUs) | `data/packaging/batch001_packaging_drafts_payload.json` |
| Generator script | `scripts/generate-batch001-packaging-preview.mjs` |

---

## SKUs ready vs needing human input

### Ready for governed update (16)

`OAS-AS-BKL-0001`, `0002`, `0003`, `0004`, `0005`, `0006`, `0007`, `0008`, `0009`, `0010`, `0011`, `0019`, `0020`, `0021`, `0022`, `0023`

### Review before submit (8) — Mappet cluster

`OAS-AS-BKL-0012`–`0018`, `0024`

### Needs human input (1)

`OAS-AS-BKL-0025` — add authority CSV row with Weight (GM), primary `1kg`, secondary `Mappet`

---

## Projected readiness lift

| Dimension | Before | After 4A (24 SKUs approved) |
|-----------|--------|----------------------------|
| Piece weight authority | 0% | 96% |
| pcs/kg conversion | 0% | 96% |
| Primary pack mapped | 40% | 96% |
| Secondary/carton hierarchy | 0% | 80% (carton qty still empty) |
| MOQ governed | 20% | 20% |
| **Weighted packaging readiness** | **12%** | **~68%** |

---

## References

- `docs/BATCH001_PACKAGING_AUTHORITY_REPORT.md` (Workstream B baseline)
- `src/features/productTruth/uomPackagingEngine.ts` — `validateConversionRuleChain`
- `src/features/category1Import/buildDraftPayload.ts` — draft payload shape
- `scripts/supabase/PR06C1_central_tag_alias_approve_mapping.sql` — current approval mapping
- Live Central `approve_catalogue_draft_internal` (audited 2026-06-10)
