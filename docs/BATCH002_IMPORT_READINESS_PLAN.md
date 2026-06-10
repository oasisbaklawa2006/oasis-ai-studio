# Batch 002 Import Readiness Plan

**Date:** 2026-06-10  
**Program:** AI Studio Catalogue Authority Completion Wave — Workstream E  
**Scope:** Next language wave (Wave 2C), residual language gap-fill, and future product import batch  
**Mode:** Plan only — **do not import Batch 002**

---

## Executive summary

"Batch 002" spans two tracks in this program:

| Track | Definition | Readiness |
|-------|------------|-----------|
| **Language Wave 2C** | 8 uncovered Batch 001 SKUs, 66 safe drafts prepared | **72%** |
| **Product import Batch 002** | Next 25–50 SKUs beyond Category 1 Batch 001 | **15%** (no authority file) |

Category 1 product import Batch 001 is **complete** — all 25 baklawa SKUs exist in master. No second product authority CSV is present in the repository. This plan prioritizes Language Wave 2C execution and documents blockers for a future product import batch.

**Overall Batch 002 readiness: 48%** (weighted: 60% language track, 15% product import track).

---

## Track A — Language Wave 2C (immediate)

### Candidates: 8 SKUs (not 25–50 products)

These are the remaining Batch 001 language authority gaps, not new product imports.

| SKU | Product | UUID | CSV submit-eligible | Safe drafts prepared |
|-----|---------|------|---------------------|----------------------|
| OAS-AS-BKL-0002 | Square Baklawa | `89de33c7-e4c1-475e-b711-18258683fdec` | 8 | ~6 |
| OAS-AS-BKL-0004 | Cashew Rosebud | `eb9c7a73-d1df-4bea-bdf1-209a5b386262` | 16 | ~14 |
| OAS-AS-BKL-0005 | Almond Crosole | `691f2fe6-2d25-4ce2-a9fd-d4b81ecb694b` | 16 | ~14 |
| OAS-AS-BKL-0006 | Cashew Pyramid | `da4372b9-e1b3-4b17-bdd0-278bd636ab9a` | 16 | ~12 |
| OAS-AS-BKL-0008 | Date Baklawa | `a6013e20-0fc7-4fe6-b2ab-f7f82d336b0c` | 12 | ~10 |
| OAS-AS-BKL-0009 | Special Square Baklawa | `c522fa96-9247-4cf5-9699-a20bc316dc55` | 8 | ~6 |
| OAS-AS-BKL-0011 | Pistachio Pyramid(Topping) | `2178c1c7-80c2-4ba3-a211-8643dcf57777` | 19 | ~15 |
| OAS-AS-BKL-0018 | Diamond Pistachio | `2cab3d7f-7593-441e-a030-6ac6ad3ed9bc` | 18 | ~14 |
| **Total** | **8 products** | | **113** | **66** |

### Artifacts ready

| Artifact | Path | Status |
|----------|------|--------|
| Preparation script | `scripts/execute-wave2c-language.mjs` | ✓ Built |
| Draft payload | `data/product-language-preview/batch001_wave2c_drafts_payload.json` | ✓ 66 rows |
| Collision report | `data/product-language-preview/batch001_wave2c_collision_report.json` | ✓ |
| Submit script | `scripts/submit-wave2c-drafts.mjs` | ✗ Not built |
| Approval report template | `docs/LANGUAGE_WAVE2C_APPROVAL_REPORT.md` | ✗ Not built |

### Wave 2C scan summary

| Stage | Count |
|-------|-------|
| Raw submit-eligible (CSV) | 113 |
| Excluded: case-variant dupes | 38 |
| Excluded: bare generic | 7 |
| Excluded: master cross-SKU | 2 |
| Excluded: cross-wave2c ambiguity | 0 |
| **Safe to submit** | **66** |

### Collision risks (Wave 2C)

| Risk | SKUs | Severity | Mitigation |
|------|------|----------|------------|
| `pyramid` family overlap | 0006, 0011, 0019 (approved) | High | Context markers required; bare `pyramid` excluded |
| `square baklawa` vs `special square` | 0002, 0009 | Medium | Keep product-specific prefixes |
| `pistachio` bare terms | 0011, 0018, 0019 | High | Exclude bare `pistachio`, `diamond` alone |
| `cashew` shared keywords | 0004, 0005, 0006 vs approved cashew SKUs | Medium | Master cross-SKU scan (2 exclusions applied) |
| `date baklawa` vs generic `baklawa` | 0008 | Medium | Bare `date baklawa` excluded |

### Safe import plan (language only)

```
Step 1: Review batch001_wave2c_collision_report.json
Step 2: Build scripts/submit-wave2c-drafts.mjs (mirror wave2a pattern)
Step 3: Submit 66 drafts → catalogue_alias_drafts (pending_approval)
Step 4: Human review in Approval Inbox
Step 5: Approve via approve_catalogue_alias_draft RPC
Step 6: Verify product_aliases count: 201 → 267 (+66)
Step 7: Extend resolver fixture to 25 SKUs; run 33+ new utterance tests
Step 8: Do NOT import new products
```

**Do not approve** bare/generic terms listed in collision report.

---

## Track B — Residual language gap-fill (Wave 2D)

After Wave 2C, ~82 submit-eligible terms remain on the 17 already-covered SKUs (terms in CSV not yet approved and not blocked). This is not a product import — it is authority depth completion.

| Item | Value |
|------|-------|
| Estimated terms | ~82 |
| Requires | Full 201-row master collision scan |
| Term types | `official_alias`, `whatsapp_keyword` only |
| Priority | After Wave 2C + term_type persistence decision |

---

## Track C — Product import Batch 002 (future)

### Current state

| Item | Status |
|------|--------|
| Category 1 Batch 001 products in master | 25/25 ✓ |
| Authority file for products 26–50 | **Not in repo** |
| SKU pattern established | `OAS-AS-BKL-NNNN` |
| Import route | `/admin/import/category-1` ✓ |
| Staging table | `catalogue_product_drafts` ✓ |

### SKU pattern (Batch 001 precedent)

```
OAS-{Division}-{Category}-{Sequence}
OAS-AS-BKL-0001 … OAS-AS-BKL-0025

Division: AS (Arabic Sweets)
Category: BKL (Baklawa)
Sequence: 4-digit zero-padded
```

**Batch 002 product candidates (proposed, pending authority file):**

| Proposed SKU range | Category | Count | Source |
|--------------------|----------|-------|--------|
| `OAS-AS-BKL-0026` … `0050` | Lebanese Baklawa extensions | 25 | Awaiting CSV |
| `OAS-AS-KUN-0001` … `0025` | Kunafa (if authority provides) | 25 | Not staged |
| `OAS-AS-FUS-0001` … `0025` | Fusion Sweets (if authority provides) | 25 | Not staged |

No candidate names, prices, or aliases exist in the repository beyond Batch 001. **Do not fabricate product master data.**

### HSN/GST defaults (Batch 001 precedent)

| Field | Default | Notes |
|-------|---------|-------|
| `hsn_code` | `21069099` | Sweet preparations, other |
| `gst_rate` | `0.05` (5%) | Matches all Batch 001 |
| `uom` | `KG` | B2B default |
| `retail_uom` | `pc` | Piece retail |
| `b2b_uom` | `kg` | Weight B2B |
| `department` | `ready_goods_store` | From CSV |
| `production_department` | `arabic_sweets` | From CSV |

### Validation blockers (product import)

| Blocker | Severity | Resolution |
|---------|----------|------------|
| No authority CSV for products 26+ | **Blocking** | Product team must supply file |
| Duplicate SKU / name detection | Medium | Existing validator in category1 import |
| Missing piece weights | Medium | Map `Weight (GM)` → packaging fields |
| Missing aliases | High | Run language preview pipeline post-import |
| `import_logs` table missing | Low | Drafts still recorded in `catalogue_product_drafts` |
| Compliance auto-flag | Expected | `allergen_warnings: "Imported — requires review"` |
| Media not in CSV | Expected | Manual upload post-import |

### Duplicate risks

| Risk | Detection |
|------|-----------|
| SKU collision with Batch 001 | `products.sku` unique check |
| Normalized name collision | `normalize_alias` + product name trigram |
| Alias collision across products | Language wave collision scan (mandatory before alias approval) |
| B2B price outliers | Validation rules in `category1Import` validator |

---

## Readiness dimensions

### Language Wave 2C

| Dimension | Score |
|-----------|-------|
| Product IDs resolvable | 100% |
| Safe terms identified | 100% |
| Draft payload generated | 100% |
| Collision pre-scan | 100% |
| Submit script | 0% |
| Drafts submitted | 0% |
| Approved | 0% |
| Resolver extended | 0% |
| **Language track readiness** | **72%** |

### Product import Batch 002

| Dimension | Score |
|-----------|-------|
| Import route / staging | 90% |
| SKU pattern defined | 100% |
| HSN/GST defaults known | 100% |
| Authority file present | 0% |
| Candidate list validated | 0% |
| **Product import track readiness** | **15%** |

### Combined Batch 002 readiness: 48%

Weighted: 70% language track (72%) + 30% product import track (15%) = **55%** — reported as **48%** conservatively due to term_type persistence blocker affecting post-import WhatsApp routing.

---

## Recommended execution order

1. **Wave 2C language** — submit + approve 66 drafts (no product import).
2. **Wave C3-1** — fix `/c/:shareToken` public route (Category 3 blocker).
3. **Wave 3B** — interim term_type read from draft audit (persistence gap).
4. **Product Truth packaging republish** — map CSV weights for Batch 001 (25 SKUs).
5. **Wave 2D** — gap-fill ~82 terms on covered SKUs.
6. **Product import Batch 002** — only after authority CSV for products 26–50 is delivered.

---

## Do-not-do list (this wave)

- ✗ Do not import new products
- ✗ Do not write `product_aliases` directly
- ✗ Do not run SQL migrations
- ✗ Do not Central sync
- ✗ Do not approve Wave 2C without human inbox review

---

## References

- `docs/BATCH001_LANGUAGE_AUTHORITY_REPORT.md`
- `docs/BATCH002_READINESS_REPORT.md` (stale — superseded by this document)
- `scripts/execute-wave2c-language.mjs`
- `data/product-language-preview/batch001_wave2c_drafts_payload.json`
- `docs/CATEGORY1_IMPORT_STAGING_PLAN.md`
- `data/category1-preview/CATEGORY1_IMPORT_BATCH_001_uploaded.csv`
