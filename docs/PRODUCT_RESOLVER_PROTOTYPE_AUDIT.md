# Product Resolver Prototype Audit

**Date:** 2026-06-10  
**Module:** `src/features/productResolver/`  
**Mode:** Read-only — no order creation, no Central sync, no production writes  
**Coverage:** 17 SKUs (Phase 1 + Wave 2A + Wave 2B)

---

## Catalog fixture

| Source | SKUs | Aliases |
|--------|------|---------|
| Phase 1 | 4 | 82 |
| Wave 2A | 8 | 78 |
| Wave 2B | 5 | 41 |
| **Combined** | **17** | **201** |

### Covered SKUs

| SKU | Product |
|-----|---------|
| OAS-AS-BKL-0001 | Cashew Kitta |
| OAS-AS-BKL-0003 | Cashew Ring |
| OAS-AS-BKL-0007 | Cashew Finger |
| OAS-AS-BKL-0010 | Pistachio Ring |
| OAS-AS-BKL-0012 | Chocolate Pistachio Asiyah |
| OAS-AS-BKL-0013 | Chocolate Cashew Asiyah |
| OAS-AS-BKL-0014 | Mor Cashew Asiyah |
| OAS-AS-BKL-0015 | Mor Pistachio Asiyah |
| OAS-AS-BKL-0016 | Pistachio Asiyah |
| OAS-AS-BKL-0017 | Cashew Asiyah |
| OAS-AS-BKL-0019 | Pistachio Pyramid |
| OAS-AS-BKL-0020 | Tart Cashew |
| OAS-AS-BKL-0021 | Mix Nut Tart |
| OAS-AS-BKL-0022 | Almond Tart |
| OAS-AS-BKL-0023 | Pistachio Tart |
| OAS-AS-BKL-0024 | Mor Pistachio Durum |
| OAS-AS-BKL-0025 | Coconut Durum |

---

## Utterance test audit (17-SKU catalog)

| # | Utterance | Expected | Pass |
|---|-----------|----------|------|
| 1–6 | Phase 1 anchors (mor kaju asiyah, tart kaju, etc.) | Respective SKUs | ✓ |
| 7–15 | Wave 2A (cashew kitta, pistachio pyramid, etc.) | Respective SKUs / clarify | ✓ |
| 16 | chocolate pistachio asiyah | OAS-AS-BKL-0012 | ✓ |
| 17 | mor pistachio asiyah | OAS-AS-BKL-0015 | ✓ |
| 18 | beetroot pistachio asiyah | OAS-AS-BKL-0015 | ✓ |
| 19 | OAS-AS-BKL-0016 | OAS-AS-BKL-0016 | ✓ |
| 20 | almond tart | OAS-AS-BKL-0022 | ✓ |
| 21 | need almond tart | OAS-AS-BKL-0022 | ✓ |
| 22 | pistachio nut tart | OAS-AS-BKL-0023 | ✓ |
| 23 | need pistachio asiyah | clarify | ✓ |
| 24 | pistachio asiyah | clarify | ✓ |
| 25 | pistachio tart | OAS-AS-BKL-0023 | ✓ |
| 26–29 | Safety (cashew assiyah, cashew box, random sweet) | clarify | ✓ |

### Readiness score: **100%** (33/33 utterance tests)

---

## Wave 2B behaviour verified

- **Chocolate/Mor disambiguation:** `chocolate pistachio asiyah` → 0012; `mor pistachio asiyah` / `beetroot pistachio asiyah` → 0015
- **Tart cluster:** `almond tart` → 0022; `pistachio nut tart` → 0023; bare `pistachio tart` resolves via product name (bare alias withheld)
- **Asiyah cluster safety:** bare `pistachio asiyah` and `need pistachio asiyah` → clarification across 0012/0015/0016

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
