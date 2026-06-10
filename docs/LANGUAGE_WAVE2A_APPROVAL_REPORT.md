# Language Approval Report — Batch 001 Wave 2A

**Date:** 2026-06-10  
**Program:** Product Language Wave 2A Execution  
**Source tag:** `batch001_language_wave2a`

---

## Executive summary

| Metric | Result |
|--------|--------|
| Drafts submitted | **78** |
| Drafts approved | **78** |
| Drafts rejected | **0** |
| `product_aliases` before | **101** |
| `product_aliases` after | **179** |
| New alias rows | **+78** |
| Covered SKUs (Phase 1 + Wave 2A) | **12** |
| Approval path | `approve_catalogue_alias_draft` → governed RPC |

All 78 Wave 2A language drafts were submitted to `catalogue_alias_drafts` and approved via `approve_catalogue_alias_draft`. No direct `product_aliases` inserts were used.

---

## Scope approved

### Wave 2A (8 new SKUs)

| SKU | Product | Aliases approved |
|-----|---------|------------------|
| OAS-AS-BKL-0001 | Cashew Kitta | 12 |
| OAS-AS-BKL-0003 | Cashew Ring | 9 |
| OAS-AS-BKL-0007 | Cashew Finger | 11 |
| OAS-AS-BKL-0010 | Pistachio Ring | 9 |
| OAS-AS-BKL-0017 | Cashew Asiyah | 8 |
| OAS-AS-BKL-0019 | Pistachio Pyramid | 9 |
| OAS-AS-BKL-0021 | Mix Nut Tart | 8 |
| OAS-AS-BKL-0025 | Coconut Durum | 12 |
| **Wave 2A subtotal** | **8 products** | **78** |

### Combined coverage (Phase 1 anchors + Wave 2A)

| SKU | Product | Total aliases |
|-----|---------|---------------|
| OAS-AS-BKL-0001 | Cashew Kitta | 12 |
| OAS-AS-BKL-0003 | Cashew Ring | 9 |
| OAS-AS-BKL-0007 | Cashew Finger | 11 |
| OAS-AS-BKL-0010 | Pistachio Ring | 9 |
| OAS-AS-BKL-0013 | Chocolate Cashew Asiyah | 20 |
| OAS-AS-BKL-0014 | Mor Cashew Asiyah | 22 |
| OAS-AS-BKL-0017 | Cashew Asiyah | 8 |
| OAS-AS-BKL-0019 | Pistachio Pyramid | 9 |
| OAS-AS-BKL-0020 | Tart Cashew | 19 |
| OAS-AS-BKL-0021 | Mix Nut Tart | 8 |
| OAS-AS-BKL-0024 | Mor Pistachio Durum | 21 |
| OAS-AS-BKL-0025 | Coconut Durum | 12 |
| **Total** | **12 products** | **160** |

### Term type breakdown (Wave 2A payload)

| Term type | Count |
|-----------|-------|
| `official_alias` | 47 |
| `whatsapp_keyword` | 31 |

**Scope filter:** `official_alias` and `whatsapp_keyword` only. `customer_term` and `search_keyword` rows were excluded per program rules.

---

## Pre-approval scans

### 1. Duplicate scan (within batch)

**Result: PASS — 46 case-variant duplicates excluded**

Lowercase `whatsapp_keyword` rows that duplicated an already-kept Title-case `official_alias` (same normalized text + product) were dropped before submission.

| Exclusion | Count |
|-----------|-------|
| Case-variant duplicates | 46 |

### 2. Collision scan (against existing `product_aliases` / Phase 1)

**Result: PASS — 3 Phase 1 cross-SKU collisions excluded**

| Term (OAS-AS-BKL-0017) | Conflict with Phase 1 |
|------------------------|----------------------|
| Cashew Assiyah | OAS-AS-BKL-0013, OAS-AS-BKL-0014 |
| Cashew High Jump Baklawa | OAS-AS-BKL-0013, OAS-AS-BKL-0014 |
| Cashew High Gap Baklawa | OAS-AS-BKL-0013, OAS-AS-BKL-0014 |

Transliteration normalization (`assiyah` → `asiyah`) applied during scan.

### 3. Cross-Wave 2A ambiguity scan

**Result: PASS — 0 cross-SKU collisions within Wave 2A batch**

No normalized term mapped to more than one Wave 2A SKU after deduplication.

### 4. Bare generic exclusion

**Result: PASS — 0 bare generic terms submitted**

Terms like bare `kitta`, `ring`, `finger`, `asiyah`, `pyramid`, `tart`, `durum`, `coconut` were blocked by the bare-generic filter. Prefixed variants (e.g. `cashew kitta`, `need cashew asiyah`) were kept.

---

## Ambiguous terms kept out

| Term | SKU | Reason |
|------|-----|--------|
| Cashew Assiyah | 0017 | Phase 1 cross-SKU (0013, 0014) |
| Cashew High Jump Baklawa | 0017 | Phase 1 cross-SKU (0013, 0014) |
| Cashew High Gap Baklawa | 0017 | Phase 1 cross-SKU (0013, 0014) |
| Bare `cashew asiyah` (whatsapp) | 0017 | Case dupe; prefixed WhatsApp forms kept instead |
| Bare `kaju asiyah` (whatsapp) | 0017 | Case dupe of kept official alias |

Resolver correctly flags bare `kaju asiyah` as clarification-required across 0013/0014/0017.

---

## Artifacts

| File | Purpose |
|------|---------|
| `scripts/execute-wave2a-language.mjs` | Scan, filter, build draft payloads |
| `scripts/submit-wave2a-drafts.mjs` | Ephemeral insert SQL generator (stdout only) |
| `data/product-language-preview/batch001_wave2a_drafts_payload.json` | 78 reproducible draft rows |
| `data/product-language-preview/batch001_wave2a_collision_report.json` | Machine-readable scan results |
| `docs/BATCH001_WAVE2A_COLLISION_REPORT.md` | Human-readable collision report |

---

## Validation

| Check | Result |
|-------|--------|
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `npm test` | Pass |
| Resolver utterance audit (12 SKUs) | 23/23 (100%) |
| `catalogue_alias_drafts` status | 78 approved |

---

## Constraints confirmed

| Constraint | Status |
|------------|--------|
| Safe-to-draft terms only | Yes |
| Governed draft path only | Yes — no direct `product_aliases` writes |
| No SQL migrations | Yes |
| No Central sync | Yes |
| No product data changes | Yes |
| No order creation | Yes |

---

*Reproduce scan: `node scripts/execute-wave2a-language.mjs --write-json`*
