# Batch 002 Readiness Report

**Date:** 2026-06-10  
**Definition:** Language Phase 2 — remaining **21 Batch 001 SKUs** (excluding 4 Phase 1 anchors)  
**Scope:** Assessment only — no approvals, no product imports

---

## Executive summary

| Metric | Value |
|--------|-------|
| SKUs in Batch 002 | **21** |
| Safe-to-draft language terms | **429** |
| Terms submitted as drafts | **0** |
| Terms approved | **0** |
| Products in master DB | **21/21** (100%) |
| **Batch 002 readiness score** | **62/100** |

Batch 002 is **preview-ready** but **not submission-ready** until collision pre-scan and submit script are extended from Phase 1 pattern.

---

## Batch 002 SKU list

| SKU | Product | Safe terms | Approved aliases |
|-----|---------|------------|------------------|
| OAS-AS-BKL-0001 | Cashew Kitta | 25 | 0 |
| OAS-AS-BKL-0002 | Square Baklawa | 12 | 0 |
| OAS-AS-BKL-0003 | Cashew Ring | 19 | 0 |
| OAS-AS-BKL-0004 | Cashew Rosebud | 20 | 0 |
| OAS-AS-BKL-0005 | Almond Crosole | 19 | 0 |
| OAS-AS-BKL-0006 | Cashew Pyramid | 19 | 0 |
| OAS-AS-BKL-0007 | Cashew Finger | 22 | 0 |
| OAS-AS-BKL-0008 | Date Baklawa | 17 | 0 |
| OAS-AS-BKL-0009 | Special Square Baklawa | 13 | 0 |
| OAS-AS-BKL-0010 | Pistachio Ring | 19 | 0 |
| OAS-AS-BKL-0011 | Pistachio Pyramid(Topping) | 25 | 0 |
| OAS-AS-BKL-0012 | Chocolate Pistachio Asiyah | 21 | 0 |
| OAS-AS-BKL-0015 | Mor Pistachio Asiyah | 23 | 0 |
| OAS-AS-BKL-0016 | Pistachio Asiyah | 20 | 0 |
| OAS-AS-BKL-0017 | Cashew Asiyah | 26 | 0 |
| OAS-AS-BKL-0018 | Diamond Pistachio | 23 | 0 |
| OAS-AS-BKL-0019 | Pistachio Pyramid | 17 | 0 |
| OAS-AS-BKL-0021 | Mix Nut Tart | 21 | 0 |
| OAS-AS-BKL-0022 | Almond Tart | 20 | 0 |
| OAS-AS-BKL-0023 | Pistachio Tart | 22 | 0 |
| OAS-AS-BKL-0025 | Coconut Durum | 26 | 0 |

---

## Term type breakdown (Batch 002 safe-to-draft)

| Term type | Count | Phase 2 submit? |
|-----------|-------|-----------------|
| `official_alias` | 116 | Yes |
| `whatsapp_keyword` | 198 | Yes |
| `customer_term` | 89 | Phase 2b |
| `search_keyword` | 24 | Phase 2b |
| `regional_term` | 2 | Defer (review) |
| **Total** | **429** | |

Source: `data/product-language-preview/batch001_language_terms_safe_to_draft.csv`

---

## Readiness dimensions

| Dimension | Status | Score |
|-----------|--------|-------|
| Product master exists (21 SKUs) | ✓ All in `products` | 100% |
| Language preview generated | ✓ 429 safe terms | 100% |
| Product IDs resolvable | ✓ UUIDs in DB | 100% |
| Phase 1 anchors stable | ✓ 82 approved | 100% |
| Submit script for Batch 002 | ✗ Not built | 0% |
| Drafts submitted | ✗ 0/429 | 0% |
| Cross-SKU collision pre-scan | ✗ Not run on full 21 SKUs | 30% |
| Resolver coverage | ✗ 4/25 SKUs only | 16% |
| Category 1 import staging | ✓ Products already master | 80% |

### Weighted readiness: **62/100**

---

## Predicted collision risks (Batch 002)

Based on Phase 1 patterns and product naming overlap:

| Risk area | SKUs affected | Severity |
|-----------|---------------|----------|
| Shared `asiyah` family terms | 0012, 0015, 0016, 0017 + Phase 1 | High |
| Shared `pistachio` / `pista` keywords | 0010–0012, 0015–0019, 0023–0024 | High |
| Shared `cashew` / `kaju` keywords | 0001–0007, 0013–0014, 0017, 0020 | High |
| Shared `pyramid` terms | 0006, 0011, 0019 | Medium |
| Shared `tart` terms | 0020–0023 | Medium |
| `mor` prefix overlap | 0014 (approved), 0015, 0024 (approved) | Medium |

**Recommendation:** Run automated cross-SKU ambiguity scan on all 429 terms before draft submission. Expect **15–25%** of whatsapp_keywords to trigger clarification at runtime.

---

## Category 1 import status

| Check | Status |
|-------|--------|
| Batch 001 products in `products` | 25/25 present |
| New product import required | No |
| `catalogue_product_drafts` needed | No (master exists) |
| Language draft path needed | Yes — `catalogue_alias_drafts` only |

Batch 002 is a **language expansion wave**, not a product master import wave.

---

## Prerequisites before Batch 002 execution

| # | Action | Owner |
|---|--------|-------|
| 1 | Extend `submit-batch001-language-phase1.mjs` → `submit-batch002-language.mjs` | AI Studio |
| 2 | Run collision/duplicate/ambiguity scans on 429 terms | Governance |
| 3 | Submit drafts only (no approve until scan pass) | Contributor |
| 4 | Rich alias approval cards with term_type visible | AI Studio |
| 5 | Expand resolver test suite to full 25 SKUs | AI Studio |

---

## Recommended execution wave

### Wave 2A — High-traffic baklawa (8 SKUs, ~155 terms)

Submit `official_alias` + `whatsapp_keyword` for:

- OAS-AS-BKL-0001 Cashew Kitta
- OAS-AS-BKL-0003 Cashew Ring
- OAS-AS-BKL-0007 Cashew Finger
- OAS-AS-BKL-0010 Pistachio Ring
- OAS-AS-BKL-0017 Cashew Asiyah
- OAS-AS-BKL-0019 Pistachio Pyramid
- OAS-AS-BKL-0021 Mix Nut Tart
- OAS-AS-BKL-0025 Coconut Durum

### Wave 2B — Asiyah / tart cluster (7 SKUs, ~134 terms)

- 0012, 0015, 0016, 0020, 0022, 0023 + collision review with Phase 1

### Wave 2C — Remaining + customer/search terms (6 SKUs + term types)

- 0002, 0004, 0005, 0006, 0008, 0009, 0011, 0018
- Add `customer_term` + `search_keyword` after Wave 2A/B stable

---

## Constraints confirmed

| Constraint | Status |
|------------|--------|
| No approvals in this assessment | Yes |
| No product imports | Yes |
| No Central sync | Yes |
| No SQL migrations | Yes |

---

*Batch 002 = Language Phase 2 for remaining 21 OAS-AS-BKL SKUs from Batch 001 authority set.*
