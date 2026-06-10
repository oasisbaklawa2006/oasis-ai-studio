# Product Resolver Prototype Audit

**Date:** 2026-06-10  
**Module:** `src/features/productResolver/`  
**Mode:** Read-only — no order creation, no Central sync, no production writes  
**Coverage:** 12 SKUs (Phase 1 anchors + Wave 2A)

---

## Purpose

Prototype end-to-end product recognition from free-form customer text (WhatsApp-style utterances) using:

- `products.name`
- `products.sku`
- Approved `product_aliases.alias_text`
- `product_aliases.canonical_name`

---

## Architecture

```
Customer utterance
  → normalizeUtterance() [strip qty/filler, preserve SKU pattern]
  → resolveProductFromCatalog()
      ├── SKU exact match (score 1.0)
      ├── Name token overlap (≤0.92)
      └── Alias token overlap (≤0.94)
  → ambiguity check (top − second < 0.08)
  → threshold check (top < 0.72)
  → ProductResolverResult
```

### Configuration

| Parameter | Value |
|-----------|-------|
| `min_threshold` | 0.72 |
| `ambiguity_delta` | 0.08 |
| `max_candidates` | 3 |

---

## Catalog fixture

| Source | SKUs | Aliases |
|--------|------|---------|
| Phase 1 (`batch001_phase1_drafts_payload.json`) | 4 | 82 |
| Wave 2A (`batch001_wave2a_drafts_payload.json`) | 8 | 78 |
| **Combined** | **12** | **160** |

### Covered SKUs

| SKU | Product |
|-----|---------|
| OAS-AS-BKL-0001 | Cashew Kitta |
| OAS-AS-BKL-0003 | Cashew Ring |
| OAS-AS-BKL-0007 | Cashew Finger |
| OAS-AS-BKL-0010 | Pistachio Ring |
| OAS-AS-BKL-0013 | Chocolate Cashew Asiyah |
| OAS-AS-BKL-0014 | Mor Cashew Asiyah |
| OAS-AS-BKL-0017 | Cashew Asiyah |
| OAS-AS-BKL-0019 | Pistachio Pyramid |
| OAS-AS-BKL-0020 | Tart Cashew |
| OAS-AS-BKL-0021 | Mix Nut Tart |
| OAS-AS-BKL-0024 | Mor Pistachio Durum |
| OAS-AS-BKL-0025 | Coconut Durum |

---

## Utterance test audit (12-SKU catalog)

| # | Utterance | Expected | Result | Pass |
|---|-----------|----------|--------|------|
| 1 | mor kaju asiyah | OAS-AS-BKL-0014 | OAS-AS-BKL-0014 | ✓ |
| 2 | 2 mor kaju asiyah chahiye | OAS-AS-BKL-0014 | OAS-AS-BKL-0014 | ✓ |
| 3 | chocolate kaju asiyah | OAS-AS-BKL-0013 | OAS-AS-BKL-0013 | ✓ |
| 4 | tart kaju | OAS-AS-BKL-0020 | OAS-AS-BKL-0020 | ✓ |
| 5 | mor pistachio durum | OAS-AS-BKL-0024 | OAS-AS-BKL-0024 | ✓ |
| 6 | OAS-AS-BKL-0020 | OAS-AS-BKL-0020 | OAS-AS-BKL-0020 | ✓ |
| 7 | cashew kitta | OAS-AS-BKL-0001 | OAS-AS-BKL-0001 | ✓ |
| 8 | need cashew kitta | OAS-AS-BKL-0001 | OAS-AS-BKL-0001 | ✓ |
| 9 | cashew ring | OAS-AS-BKL-0003 | OAS-AS-BKL-0003 | ✓ |
| 10 | cashew finger | OAS-AS-BKL-0007 | OAS-AS-BKL-0007 | ✓ |
| 11 | pistachio ring | OAS-AS-BKL-0010 | OAS-AS-BKL-0010 | ✓ |
| 12 | OAS-AS-BKL-0017 | OAS-AS-BKL-0017 | OAS-AS-BKL-0017 | ✓ |
| 13 | need cashew asiyah | clarify | clarification_required | ✓ |
| 14 | pistachio pyramid | OAS-AS-BKL-0019 | OAS-AS-BKL-0019 | ✓ |
| 15 | mix nut tart | OAS-AS-BKL-0021 | OAS-AS-BKL-0021 | ✓ |
| 16 | coconut durum | OAS-AS-BKL-0025 | OAS-AS-BKL-0025 | ✓ |
| 17 | cashew asiyah baklawa | clarify | clarification_required | ✓ |
| 18 | kaju asiyah | clarify | clarification_required | ✓ |
| 19 | cashew nut asiyah | clarify | clarification_required | ✓ |
| 20 | cashew assiyah | clarify | clarification_required | ✓ |
| 21 | cashew high gap baklawa | clarify | clarification_required | ✓ |
| 22 | cashew box | clarify | clarification_required | ✓ |
| 23 | random sweet | clarify | clarification_required | ✓ |

### Readiness score: **100%** (23/23 utterance tests)

---

## Unit test results

```
src/features/productResolver/productResolver.test.ts — 6/6 pass
```

---

## Behaviour verified

### Wave 2A unambiguous resolution

Product-specific keywords (`cashew kitta`, `pistachio pyramid`, `coconut durum`, etc.) resolve to the correct Wave 2A SKU with confidence ≥ 0.72.

### Cross-generation asiyah handling

- `OAS-AS-BKL-0017` → direct SKU match (1.0 confidence)
- `need cashew asiyah` / `cashew asiyah baklawa` / `kaju asiyah` / `cashew nut asiyah` → clarification (asiyah family spans 0013, 0014, 0017)
- `cashew assiyah` → clarification (Phase 1 shared terms on 0013, 0014)

### Phase 1 regression

All Phase 1 anchor utterance tests continue to pass with Wave 2A aliases in catalog.

---

## Gaps and limitations (prototype)

| Gap | Impact | Next action |
|-----|--------|-------------|
| No `term_type` weighting | WhatsApp keywords not boosted | Add channel-scoped scoring |
| Case-sensitive alias rows | Duplicate match paths | Normalize at approve |
| Token overlap only | No fuzzy typo matching | Add trigram/Levenshtein |
| 12/25 Batch 001 SKUs | Remainder unresolved | Batch 002 approval wave |
| Bare `kaju asiyah` ambiguous | Requires clarification | Expected; prefixed forms safer |

---

## Resolver readiness score

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Utterance test pass rate | 100% | 40% | 40 |
| Unit test pass rate | 100% | 20% | 20 |
| Ambiguity handling | 100% | 20% | 20 |
| SKU safety | 100% | 10% | 10 |
| Production gaps (term_type, fuzzy, full catalog) | 48% | 10% | 4.8 |

### **Overall resolver readiness: 94.8/100**

Suitable for **12-SKU prototype** with human clarification fallback. Not yet production-ready for full Batch 001 catalog.

---

## Constraints confirmed

| Constraint | Status |
|------------|--------|
| Read-only | Yes |
| No order creation | Yes |
| No Central sync | Yes |
| No production write path | Yes |

---

*Audit script: `node scripts/run-resolver-prototype-audit.mjs`*
