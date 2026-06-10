# Batch 001 Wave 2B — Collision Report

**Date:** 2026-06-10  
**Cluster:** Asiyah/Tart ambiguity family  
**Input:** `batch001_language_terms_safe_to_draft.csv` (5 Wave 2B SKUs)  
**Term types:** `official_alias`, `whatsapp_keyword`  
**Safety bucket:** `SAFE_TO_DRAFT` only

---

## Summary

| Stage | Count |
|-------|-------|
| Raw CSV rows (filtered) | 74 |
| Excluded — bare term | 4 |
| Excluded — insufficient context | 6 |
| Excluded — case-variant duplicate | 23 |
| Excluded — Phase 1 + Wave 2A cross-SKU | 0 |
| Excluded — cross-Wave 2B ambiguity | 0 |
| Excluded — already approved (same product) | 0 |
| **Final drafts submitted** | **41** |

---

## Bare-term exclusions

Per Wave 2B strict rules, these exact bare forms were blocked:

| Term | SKU |
|------|-----|
| Pista Asiyah | OAS-AS-BKL-0016 |
| pistachio asiyah | OAS-AS-BKL-0016 |
| pista asiyah | OAS-AS-BKL-0016 |
| pistachio tart | OAS-AS-BKL-0023 |

**Bare blocklist applied:** `asiyah`, `assiyah`, `high jump`, `pistachio asiyah`, `tart`, `pistachio tart`, `almond`, `pistachio`, `baklava`, `baklawa`

---

## Insufficient-context exclusions

| Term | SKU | Reason |
|------|-----|--------|
| Pistachio Asiyah Baklawa | 0016 | excluded — natural asiyah baklawa forms deferred |
| pistachio asiyah baklawa | 0016 | excluded — same |
| Pista Tart | 0023 | bare tart family |
| Pistachio Baklawa Tart | 0023 | ambiguous tart cluster |
| need pistachio tart | 0023 | bare pistachio tart prefix |
| send pistachio tart | 0023 | bare pistachio tart prefix |

*Note:* `need pistachio asiyah` / `send pistachio asiyah` on 0016 were approved as prefixed WhatsApp forms with single-SKU ownership.

---

## Case-variant duplicates (excluded)

**Total excluded:** 23

Examples:

| SKU | Excluded term | Kept canonical |
|-----|---------------|----------------|
| 0012 | chocolate pista asiyah | Chocolate Pista Asiyah |
| 0015 | mor pista asiyah | Mor Pista Asiyah |
| 0015 | mor pistachio asiyah baklawa | Mor Pistachio Asiyah Baklawa |
| 0016 | pistachio nut asiyah (lowercase dupe) | Pistachio Nut Asiyah |
| 0022 | badam tart | Badam Tart |
| 0022 | almond tart (whatsapp dupe) | official + prefixed forms |
| 0023 | pistachio tart baklawa | Pistachio Tart Baklawa |

---

## Prior-wave collision scan (Phase 1 + Wave 2A)

**Result: PASS — 0 exclusions**

No final Wave 2B term normalized to the same key as an alias on a different SKU in the 160-alias prior catalog.

---

## Cross-Wave 2B ambiguity scan

**Result: PASS — 0 exclusions**

No normalized term appeared on more than one Wave 2B SKU after deduplication. Chocolate/Mor/Natural asiyah lines and Almond/Pistachio tart lines remain distinct.

---

## Ambiguous terms intentionally kept out

| Family | Excluded patterns |
|--------|-------------------|
| Asiyah | bare `pistachio asiyah`, `pista asiyah`, `asiyah`, `assiyah` |
| Tart | bare `pistachio tart`, `pista tart`, `tart` |
| High jump | `high jump`, `high jump sweet`, `high jump baklawa` |
| Single nut | bare `almond`, bare `pistachio` |
| Baklawa | bare `baklava`, `baklawa` |

---

## Machine-readable output

Full exclusion lists: `data/product-language-preview/batch001_wave2b_collision_report.json`

Reproduce:

```bash
node scripts/execute-wave2b-language.mjs --write-json
```
