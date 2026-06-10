# Language Approval Report — Batch 001 Wave 2B

**Date:** 2026-06-10  
**Program:** Product Language Wave 2B Execution (Asiyah/Tart ambiguity cluster)  
**Source tag:** `batch001_language_wave2b`

---

## Executive summary

| Metric | Result |
|--------|--------|
| Drafts submitted | **41** |
| Drafts approved | **41** |
| Drafts rejected | **0** |
| `product_aliases` before | **179** |
| `product_aliases` after | **220** |
| New alias rows | **+41** |
| Covered SKUs (Phase 1 + Wave 2A + 2B) | **17** |
| Approval path | `approve_catalogue_alias_draft` → governed RPC |

All 41 Wave 2B language drafts were submitted to `catalogue_alias_drafts` and approved via `approve_catalogue_alias_draft`. No direct `product_aliases` inserts were used.

---

## Scope approved

### Wave 2B (5 new SKUs)

| SKU | Product | Aliases approved |
|-----|---------|------------------|
| OAS-AS-BKL-0012 | Chocolate Pistachio Asiyah | 9 |
| OAS-AS-BKL-0015 | Mor Pistachio Asiyah | 11 |
| OAS-AS-BKL-0016 | Pistachio Asiyah | 7 |
| OAS-AS-BKL-0022 | Almond Tart | 9 |
| OAS-AS-BKL-0023 | Pistachio Tart | 5 |
| **Wave 2B subtotal** | **5 products** | **41** |

### Term type breakdown (Wave 2B payload)

| Term type | Count |
|-----------|-------|
| `official_alias` | 23 |
| `whatsapp_keyword` | 18 |

**Scope filter:** `official_alias` and `whatsapp_keyword` only, `SAFE_TO_DRAFT` bucket only.

---

## Pre-approval scans

### 1. Duplicate scan (within batch)

**Result: PASS — 23 case-variant duplicates excluded**

### 2. Bare-term exclusion

**Result: PASS — 4 bare terms excluded**

| Term | SKU | Reason |
|------|-----|--------|
| Pista Asiyah | 0016 | bare asiyah family |
| pistachio asiyah | 0016 | bare pistachio asiyah |
| pista asiyah | 0016 | bare pistachio asiyah |
| pistachio tart | 0023 | bare pistachio tart |

### 3. Context gate

**Result: PASS — 6 terms excluded for insufficient disambiguation context (all OAS-AS-BKL-0023)**

| Term | Reason |
|------|--------|
| Pista Tart | bare tart family |
| Pistachio Baklawa Tart | ambiguous tart cluster |
| pista tart | bare tart family |
| pistachio baklawa tart | ambiguous tart cluster |
| need pistachio tart | bare pistachio tart prefix |
| send pistachio tart | bare pistachio tart prefix |

### 4. Cross-SKU collision (Phase 1 + Wave 2A)

**Result: PASS — 0 prior-wave collisions**

No normalized term in the final batch matched an alias already owned by a different SKU in Phase 1 or Wave 2A.

### 5. Cross-Wave 2B ambiguity

**Result: PASS — 0 cross-SKU collisions within Wave 2B batch**

Chocolate/Mor/Natural pistachio asiyah variants and almond vs pistachio tart families remain SKU-distinct after normalization.

---

## Ambiguous terms kept out

| Category | Terms kept out |
|----------|----------------|
| Bare asiyah | `asiyah`, `assiyah`, `pistachio asiyah`, `pista asiyah` |
| Bare tart | `tart`, `pistachio tart` (whatsapp), `pista tart` |
| Bare nuts | `almond`, `pistachio` (single-token) |
| Bare baklawa | `baklava`, `baklawa` |
| High jump | `high jump` variants |
| Under-context tart | `need pistachio tart`, `send pistachio tart`, `pistachio baklawa tart` |

Prefixed and fully-qualified forms retained (e.g. `chocolate pistachio asiyah`, `mor pistachio asiyah`, `almond tart`, `pistachio nut tart`, `need pistachio asiyah` on 0016 only).

---

## Artifacts

| File | Purpose |
|------|---------|
| `scripts/execute-wave2b-language.mjs` | Scan, filter, build draft payloads |
| `scripts/submit-wave2b-drafts.mjs` | Ephemeral insert SQL generator (stdout only) |
| `data/product-language-preview/batch001_wave2b_drafts_payload.json` | 41 reproducible draft rows |
| `data/product-language-preview/batch001_wave2b_collision_report.json` | Machine-readable scan results |
| `docs/BATCH001_WAVE2B_COLLISION_REPORT.md` | Human-readable collision report |

---

## Validation

| Check | Result |
|-------|--------|
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `npm test` | Pass |
| Resolver utterance audit (17 SKUs) | 33/33 (100%) |
| `catalogue_alias_drafts` status | 41 approved |

---

## Constraints confirmed

| Constraint | Status |
|------------|--------|
| Safe-to-draft terms only | Yes |
| Governed draft path only | Yes |
| No SQL migrations | Yes |
| No Central sync | Yes |
| No product data changes | Yes |
| No order creation | Yes |

---

*Reproduce scan: `node scripts/execute-wave2b-language.mjs --write-json`*
