# Batch 001 Wave 2A — Collision Report

**Date:** 2026-06-10  
**Input:** `batch001_language_terms_safe_to_draft.csv` (8 Wave 2A SKUs)  
**Term types:** `official_alias`, `whatsapp_keyword`  
**Safety bucket:** `SAFE_TO_DRAFT` only

---

## Summary

| Stage | Count |
|-------|-------|
| Raw CSV rows (filtered) | 127 |
| Excluded — bare generic | 0 |
| Excluded — case-variant duplicate | 46 |
| Excluded — Phase 1 cross-SKU collision | 3 |
| Excluded — cross-Wave 2A ambiguity | 0 |
| Excluded — already approved (same product) | 0 |
| **Final drafts submitted** | **78** |

---

## Phase 1 cross-SKU collisions (excluded)

These terms on **OAS-AS-BKL-0017 Cashew Asiyah** would have collided with approved Phase 1 aliases on Chocolate Cashew Asiyah (0013) and Mor Cashew Asiyah (0014):

| Term | Existing on |
|------|-------------|
| Cashew Assiyah | OAS-AS-BKL-0013, OAS-AS-BKL-0014 |
| Cashew High Jump Baklawa | OAS-AS-BKL-0013, OAS-AS-BKL-0014 |
| Cashew High Gap Baklawa | OAS-AS-BKL-0013, OAS-AS-BKL-0014 |

**Decision:** Excluded from Wave 2A submission. Phase 1 approved aliases remain authoritative for these shared terms; resolver returns `clarification_required: true`.

---

## Case-variant duplicates (excluded)

When both Title-case `official_alias` and lowercase `whatsapp_keyword` share the same normalized text for the same product, the first encountered row is kept and subsequent case variants are dropped.

**Total excluded:** 46

Examples:

| SKU | Excluded term | Reason |
|-----|---------------|--------|
| OAS-AS-BKL-0001 | kaju kitta | Dupe of Kaju Kitta |
| OAS-AS-BKL-0003 | cashew ring | Dupe of Cashew Ring |
| OAS-AS-BKL-0007 | cashew finger | Dupe of Cashew Finger |
| OAS-AS-BKL-0010 | pistachio ring | Dupe of Pistachio Ring |
| OAS-AS-BKL-0017 | cashew asiyah | Dupe of kept official form |
| OAS-AS-BKL-0019 | pistachio pyramid | Dupe of Pistachio Pyramid |
| OAS-AS-BKL-0021 | mix nut tart | Dupe of Mix Nut Tart |
| OAS-AS-BKL-0025 | coconut durum | Dupe of Coconut Durum |

Prefixed WhatsApp forms (`need cashew kitta`, `send cashew asiyah`, etc.) were **not** duplicates and were kept.

---

## Bare generic scan

**Result: PASS — 0 exclusions**

No submitted term matched the bare-generic blocklist (`kitta`, `ring`, `finger`, `asiyah`, `pyramid`, `tart`, `durum`, `coconut`, `cashew`, `kaju`, `pista`, `baklawa`, etc.) without sufficient SKU context.

---

## Cross-Wave 2A ambiguity scan

**Result: PASS — 0 exclusions**

After deduplication, no normalized term appeared on more than one Wave 2A SKU.

---

## Ambiguous terms intentionally kept out

| Category | Terms |
|----------|-------|
| Phase 1 collision | Cashew Assiyah, Cashew High Jump Baklawa, Cashew High Gap Baklawa |
| Bare asiyah variants | Bare `cashew asiyah`, `kaju asiyah` whatsapp keywords (prefixed forms kept) |

---

## Machine-readable output

Full exclusion lists: `data/product-language-preview/batch001_wave2a_collision_report.json`

Reproduce:

```bash
node scripts/execute-wave2a-language.mjs --write-json
```
