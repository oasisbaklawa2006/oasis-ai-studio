# Batch 001 Language Authority Report

**Date:** 2026-06-10  
**Program:** AI Studio Catalogue Authority Completion Wave — Workstream A  
**Scope:** Batch 001 (25 SKUs, Lebanese Baklawa / Arabic Sweets)  
**Mode:** Audit + safe draft preparation — no approvals executed in this wave

---

## Executive summary

| Metric | Value |
|--------|-------|
| Batch 001 SKUs in master | **25/25** (100%) |
| SKUs with approved aliases | **17/25** (68%) |
| SKUs with zero aliases | **8** (Wave 2C backlog) |
| Approved `product_aliases` rows (live) | **201** |
| Submit-eligible terms in authority CSV | **396** (`official_alias` + `whatsapp_keyword`) |
| Terms approved vs submit-eligible | **201/396** (50.8%) |
| Wave 2C drafts prepared (safe) | **66** (not submitted) |
| **Batch 001 language authority readiness** | **61%** |

Batch 001 has moved from anchor-only (4 SKUs) to broad coverage (17 SKUs) across Phase 1, Wave 2A, and Wave 2B. Eight SKUs remain uncovered. Wave 2C draft payloads are prepared and collision-scanned but not submitted or approved per program constraints.

---

## Approved alias inventory (live DB verified)

| SKU | Product | Approved aliases |
|-----|---------|------------------|
| OAS-AS-BKL-0001 | Cashew Kitta | 12 |
| OAS-AS-BKL-0002 | Square Baklawa | **0** |
| OAS-AS-BKL-0003 | Cashew Ring | 9 |
| OAS-AS-BKL-0004 | Cashew Rosebud | **0** |
| OAS-AS-BKL-0005 | Almond Crosole | **0** |
| OAS-AS-BKL-0006 | Cashew Pyramid | **0** |
| OAS-AS-BKL-0007 | Cashew Finger | 11 |
| OAS-AS-BKL-0008 | Date Baklawa | **0** |
| OAS-AS-BKL-0009 | Special Square Baklawa | **0** |
| OAS-AS-BKL-0010 | Pistachio Ring | 9 |
| OAS-AS-BKL-0011 | Pistachio Pyramid(Topping) | **0** |
| OAS-AS-BKL-0012 | Chocolate Pistachio Asiyah | 9 |
| OAS-AS-BKL-0013 | Chocolate Cashew Asiyah | 20 |
| OAS-AS-BKL-0014 | Mor Cashew Asiyah | 22 |
| OAS-AS-BKL-0015 | Mor Pistachio Asiyah | 11 |
| OAS-AS-BKL-0016 | Pistachio Asiyah | 7 |
| OAS-AS-BKL-0017 | Cashew Asiyah | 8 |
| OAS-AS-BKL-0018 | Diamond Pistachio | **0** |
| OAS-AS-BKL-0019 | Pistachio Pyramid | 9 |
| OAS-AS-BKL-0020 | Tart Cashew | 19 |
| OAS-AS-BKL-0021 | Mix Nut Tart | 8 |
| OAS-AS-BKL-0022 | Almond Tart | 9 |
| OAS-AS-BKL-0023 | Pistachio Tart | 5 |
| OAS-AS-BKL-0024 | Mor Pistachio Durum | 21 |
| OAS-AS-BKL-0025 | Coconut Durum | 12 |
| **Total** | **25 products** | **201** |

### Approval waves completed

| Wave | SKUs | Drafts approved | Source tag |
|------|------|-----------------|------------|
| Phase 1 | 4 | 82 | `batch001_language_phase1` |
| Wave 2A | 8 | 78 | `batch001_language_wave2a` |
| Wave 2B | 5 | 41 | `batch001_language_wave2b` |
| **Cumulative** | **17** | **201** | governed RPC only |

All approvals used `approve_catalogue_alias_draft` → `approve_catalogue_draft_internal`. No direct `product_aliases` writes.

---

## Authority source

| Asset | Path | Notes |
|-------|------|-------|
| Safe-to-draft CSV | `data/product-language-preview/batch001_language_terms_safe_to_draft.csv` | 541 total safe terms |
| Phase 1 payload | `data/product-language-preview/batch001_phase1_drafts_payload.json` | 82 drafts |
| Wave 2A payload | `data/product-language-preview/batch001_wave2a_drafts_payload.json` | 78 drafts |
| Wave 2B payload | `data/product-language-preview/batch001_wave2b_drafts_payload.json` | 41 drafts |
| Wave 2C payload (new) | `data/product-language-preview/batch001_wave2c_drafts_payload.json` | **66 drafts prepared** |
| Wave 2C collision report | `data/product-language-preview/batch001_wave2c_collision_report.json` | scan artifact |

### Term type scope (approved waves)

Only `official_alias` and `whatsapp_keyword` were submitted. Deferred by design:

| Term type | Count in CSV | Status |
|-----------|--------------|--------|
| `official_alias` | 116 | Partially approved |
| `whatsapp_keyword` | 198 | Partially approved |
| `customer_term` | 89 | Phase 2b — not submitted |
| `search_keyword` | 24 | Phase 2b — not submitted |
| `regional_term` | 2 | Deferred for review |

---

## Remaining safe language gaps

### Wave 2C — 8 uncovered SKUs (priority)

| SKU | Product | CSV submit-eligible | Wave 2C safe drafts |
|-----|---------|---------------------|---------------------|
| OAS-AS-BKL-0002 | Square Baklawa | 8 | ~6 |
| OAS-AS-BKL-0004 | Cashew Rosebud | 16 | ~14 |
| OAS-AS-BKL-0005 | Almond Crosole | 16 | ~14 |
| OAS-AS-BKL-0006 | Cashew Pyramid | 16 | ~12 |
| OAS-AS-BKL-0008 | Date Baklawa | 12 | ~10 |
| OAS-AS-BKL-0009 | Special Square Baklawa | 8 | ~6 |
| OAS-AS-BKL-0011 | Pistachio Pyramid(Topping) | 19 | ~15 |
| OAS-AS-BKL-0018 | Diamond Pistachio | 18 | ~14 |
| **Subtotal** | **8 SKUs** | **113** | **66 safe** |

Wave 2C scan exclusions (113 raw → 66 safe):

| Exclusion | Count | Reason |
|-----------|-------|--------|
| Case-variant duplicates | 38 | Lowercase whatsapp dupes Title-case official |
| Bare generic terms | 7 | `square baklawa`, `pyramid`, `date baklawa`, etc. |
| Master cross-SKU collision | 2 | Term already owned by approved SKU |
| Cross-wave2c ambiguity | 0 | No within-batch multi-SKU conflicts |

### Covered SKUs — residual gap fill (lower priority)

On the 17 covered SKUs, waves approved high-confidence subsets. Approximately **~82** additional submit-eligible terms remain in the CSV after excluding terms already approved or blocked by collision rules. These require a **Wave 2D gap-fill** pass with per-SKU collision re-scan against the full 201-row master.

### Unsafe / do-not-approve terms

| Category | Examples | Action |
|----------|----------|--------|
| Bare family orphans | `asiyah`, `tart`, `pyramid`, `pistachio` alone | Exclude (Wave 2B precedent) |
| Bare shape terms | `square`, `square baklawa` without disambiguation | Exclude |
| Cross-SKU shared cashew terms | `cashew assiyah` on 0013 + 0014 | Approved with `clarification_required` flag |
| `customer_term` / `search_keyword` | 113 rows | Defer to Phase 2b after WhatsApp channel metadata persistence |

---

## Wave 2C preparation artifacts

Script: `scripts/execute-wave2c-language.mjs`

```bash
node scripts/execute-wave2c-language.mjs --write-json
```

Output: 66 governed draft rows in `batch001_wave2c_drafts_payload.json`. Ready for `submit-wave2c-drafts.mjs` (not yet built) and Approval Inbox review.

**Do not approve** until submit script and collision report are reviewed by product authority.

---

## Resolver coverage

| Metric | Value |
|--------|-------|
| SKUs in resolver fixture | 17/25 (68%) |
| Utterance tests | 33/33 passing |
| Audit doc | `docs/PRODUCT_RESOLVER_PROTOTYPE_AUDIT.md` |

Resolver does not yet load `term_type` or `channel_scope` from master (see `LANGUAGE_TERM_PERSISTENCE_GAP_REPORT.md`).

---

## Readiness score: 61%

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| SKU coverage | 40% | 68% | 17/25 SKUs have aliases |
| Term approval depth | 40% | 51% | 201/396 submit-eligible |
| Resolver + test coverage | 20% | 68% | 17 SKUs, 33 tests pass |
| **Weighted total** | | **61%** | |

---

## Recommended next steps (language)

1. Build `scripts/submit-wave2c-drafts.mjs` mirroring Wave 2A/2B submit pattern.
2. Review `batch001_wave2c_collision_report.json`; confirm 2 master cross-SKU exclusions.
3. Submit and approve Wave 2C (66 drafts) via governed RPC.
4. Extend resolver fixture to 25 SKUs; add utterance tests for square/date/pyramid cluster.
5. Plan Wave 2D gap-fill on covered SKUs (~82 terms) with full-master collision scan.
6. Defer `customer_term` / `search_keyword` until `term_type` persistence on `product_aliases` is resolved.

---

## References

- `docs/LANGUAGE_APPROVAL_REPORT.md` (Phase 1)
- `docs/LANGUAGE_WAVE2A_APPROVAL_REPORT.md`
- `docs/LANGUAGE_WAVE2B_APPROVAL_REPORT.md`
- `docs/BATCH001_WAVE2A_COLLISION_REPORT.md`
- `docs/BATCH001_WAVE2B_COLLISION_REPORT.md`
