# Batch 001 Language Coverage Report (Final)

**Date:** 2026-06-10  
**Program:** Product Authority Completion Wave — Workstream A  
**Wave executed:** Wave 2C (66 governed drafts submitted + approved)

---

## Executive summary

| Metric | Before Wave 2C | After Wave 2C |
|--------|----------------|---------------|
| SKUs with approved aliases | 17/25 (68%) | **25/25 (100%)** |
| SKUs with zero aliases | 8 | **0** |
| Total `product_aliases` (Batch 001 SKUs) | 201 | **267** |
| New aliases (Wave 2C) | — | **+66** |
| Submit-eligible terms approved | 201/396 (51%) | **267/396 (67%)** |
| **Batch 001 language SKU coverage** | | **100%** |
| **Batch 001 language authority readiness** | 61% | **83%** |

Wave 2C completed Batch 001 language SKU coverage. All 25 products now have governed approved aliases. Term depth remains at 67% of submit-eligible authority (129 terms deferred by collision rules or Wave 2D gap-fill).

---

## Wave 2C execution record

| Step | Result |
|------|--------|
| Collision report reviewed | `batch001_wave2c_collision_report.json` — 7 bare generic, 2 master cross-SKU, 38 case dupes excluded |
| Drafts submitted | 66 → `catalogue_alias_drafts` |
| Drafts approved | 66/66 via `approve_catalogue_alias_draft` |
| Rejected | 0 |
| Direct `product_aliases` writes | 0 |
| Source tag | `batch001_language_wave2c` |

### Pre-approval exclusions (from collision scan)

| Exclusion type | Count | Examples |
|----------------|-------|----------|
| Bare generic | 7 | `square baklawa`, `date baklava`, `almond crosole` |
| Master cross-SKU | 2 | `Pistachio Pyramid Baklawa` → owned by 0019 |
| Case-variant dupes | 38 | Lowercase whatsapp dupes Title-case official |
| Cross-wave2c ambiguity | 0 | — |

---

## Final per-SKU alias inventory (live DB)

| SKU | Product | Aliases |
|-----|---------|---------|
| OAS-AS-BKL-0001 | Cashew Kitta | 12 |
| OAS-AS-BKL-0002 | Square Baklawa | **4** |
| OAS-AS-BKL-0003 | Cashew Ring | 9 |
| OAS-AS-BKL-0004 | Cashew Rosebud | **10** |
| OAS-AS-BKL-0005 | Almond Crosole | **9** |
| OAS-AS-BKL-0006 | Cashew Pyramid | **10** |
| OAS-AS-BKL-0007 | Cashew Finger | 11 |
| OAS-AS-BKL-0008 | Date Baklawa | **6** |
| OAS-AS-BKL-0009 | Special Square Baklawa | **6** |
| OAS-AS-BKL-0010 | Pistachio Ring | 9 |
| OAS-AS-BKL-0011 | Pistachio Pyramid(Topping) | **10** |
| OAS-AS-BKL-0012 | Chocolate Pistachio Asiyah | 9 |
| OAS-AS-BKL-0013 | Chocolate Cashew Asiyah | 20 |
| OAS-AS-BKL-0014 | Mor Cashew Asiyah | 22 |
| OAS-AS-BKL-0015 | Mor Pistachio Asiyah | 11 |
| OAS-AS-BKL-0016 | Pistachio Asiyah | 7 |
| OAS-AS-BKL-0017 | Cashew Asiyah | 8 |
| OAS-AS-BKL-0018 | Diamond Pistachio | **11** |
| OAS-AS-BKL-0019 | Pistachio Pyramid | 9 |
| OAS-AS-BKL-0020 | Tart Cashew | 19 |
| OAS-AS-BKL-0021 | Mix Nut Tart | 8 |
| OAS-AS-BKL-0022 | Almond Tart | 9 |
| OAS-AS-BKL-0023 | Pistachio Tart | 5 |
| OAS-AS-BKL-0024 | Mor Pistachio Durum | 21 |
| OAS-AS-BKL-0025 | Coconut Durum | 12 |
| **Total** | **25 products** | **267** |

### Wave 2C SKUs (newly covered)

| SKU | Wave 2C aliases added |
|-----|----------------------|
| OAS-AS-BKL-0002 | 4 |
| OAS-AS-BKL-0004 | 10 |
| OAS-AS-BKL-0005 | 9 |
| OAS-AS-BKL-0006 | 10 |
| OAS-AS-BKL-0008 | 6 |
| OAS-AS-BKL-0009 | 6 |
| OAS-AS-BKL-0011 | 10 |
| OAS-AS-BKL-0018 | 11 |

---

## Cumulative approval waves

| Wave | SKUs | Drafts approved | Cumulative SKUs |
|------|------|-----------------|-----------------|
| Phase 1 | 4 | 82 | 4 |
| Wave 2A | 8 | 78 | 12 |
| Wave 2B | 5 | 41 | 17 |
| **Wave 2C** | **8** | **66** | **25** |
| **Total** | **25 unique** | **267 live rows** | **100%** |

---

## Remaining language gap (Wave 2D)

| Item | Value |
|------|-------|
| Submit-eligible terms in CSV | 396 |
| Approved | 267 |
| Remaining | **129** |
| Cause | Case dupes, collision exclusions, uncovered whatsapp variants on already-covered SKUs |
| Term types deferred | `customer_term` (89), `search_keyword` (24), `regional_term` (2) |

---

## Artifacts

| File | Purpose |
|------|---------|
| `scripts/execute-wave2c-language.mjs` | Collision scan + payload generation |
| `scripts/submit-wave2c-drafts.mjs` | Governed draft insert SQL generator |
| `data/product-language-preview/batch001_wave2c_drafts_payload.json` | 66 draft rows |
| `data/product-language-preview/batch001_wave2c_collision_report.json` | Pre-submit scan |

---

## Readiness: 83%

| Dimension | Weight | Score |
|-----------|--------|-------|
| SKU coverage (25/25) | 50% | 100% |
| Term approval depth (267/396) | 30% | 67% |
| Resolver test coverage (17/25 SKUs) | 20% | 68% |
| **Weighted** | | **83%** |

**Next:** Extend resolver fixture to 25 SKUs; plan Wave 2D gap-fill for remaining 129 submit-eligible terms.
