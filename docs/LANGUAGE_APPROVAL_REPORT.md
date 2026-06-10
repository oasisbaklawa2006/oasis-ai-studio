# Language Approval Report — Batch 001 Phase 1

**Date:** 2026-06-10  
**Program:** Phase 1 Language Approval + Resolver Prototype  
**Source tag:** `batch001_language_phase1`

---

## Executive summary

| Metric | Result |
|--------|--------|
| Drafts reviewed | **82** |
| Drafts approved | **82** |
| Drafts rejected | **0** |
| `product_aliases` before | **19** |
| `product_aliases` after | **101** |
| New alias rows | **+82** |
| Approval path | `approve_catalogue_alias_draft` → `approve_catalogue_draft_internal` |

All 82 Phase 1 anchor language drafts were approved via the governed catalogue approval RPC. No direct `product_aliases` inserts were used.

---

## Scope approved

| SKU | Product | Aliases approved |
|-----|---------|------------------|
| OAS-AS-BKL-0013 | Chocolate Cashew Asiyah | 20 |
| OAS-AS-BKL-0014 | Mor Cashew Asiyah | 22 |
| OAS-AS-BKL-0020 | Tart Cashew | 19 |
| OAS-AS-BKL-0024 | Mor Pistachio Durum | 21 |
| **Total** | **4 products** | **82** |

### Term type breakdown (from draft payload)

| Term type | Count |
|-----------|-------|
| `official_alias` | 32 |
| `whatsapp_keyword` | 50 |

---

## Pre-approval scans

### 1. Duplicate scan (within batch)

**Result: PASS — 0 duplicate draft rows**

No identical `(alias_text, product_id, term_type)` combinations appeared more than once in the pending batch.

### 2. Collision scan (against existing `product_aliases`)

**Result: PASS — 0 cross-product collisions**

No draft `alias_text` matched an existing `product_aliases` row linked to a **different** `product_id`.

| Check | Count |
|-------|-------|
| Cross-product text collisions | 0 |
| Same-product duplicates (skip-safe) | 0 |

### 3. Cross-SKU ambiguity scan

**Result: WARN — 3 shared terms across 2 products (expected, not blocking)**

These terms intentionally appear on both Chocolate Cashew Asiyah (0013) and Mor Cashew Asiyah (0014) per source authority data:

| Normalized term | Products |
|-----------------|----------|
| `cashew assiyah` | Chocolate Cashew Asiyah, Mor Cashew Asiyah |
| `cashew high gap baklawa` | Chocolate Cashew Asiyah, Mor Cashew Asiyah |
| `cashew high jump baklawa` | Chocolate Cashew Asiyah, Mor Cashew Asiyah |

**Decision:** Approved with ambiguity flag. Resolver prototype must return `clarification_required: true` for these utterances (verified in Track B).

### 4. Product ID validation

All 82 drafts reference valid `product_id` UUIDs for existing Batch 001 products.

---

## Approval decision

| Gate | Status |
|------|--------|
| C1 — Term class review | Pass (official_alias + whatsapp_keyword only) |
| C2 — Cross-product collision | Pass (no conflicts with existing master) |
| C4 — Batch sequence | Pass (Phase 1 anchor SKUs) |
| Cross-SKU ambiguity | Warn — runtime clarification required |

**Verdict: SAFE TO APPROVE** — batch approved in full.

---

## Post-approval `product_aliases` state

### Counts by anchor SKU

| SKU | `product_aliases` rows |
|-----|------------------------|
| OAS-AS-BKL-0013 | 20 |
| OAS-AS-BKL-0014 | 22 |
| OAS-AS-BKL-0020 | 19 |
| OAS-AS-BKL-0024 | 21 |

### Sample approved entries

| alias_text | canonical_name | sku |
|------------|----------------|-----|
| chocolate kaju asiyah | Chocolate Cashew Asiyah | OAS-AS-BKL-0013 |
| mor kaju asiyah | Mor Cashew Asiyah | OAS-AS-BKL-0014 |
| tart kaju | Tart Cashew | OAS-AS-BKL-0020 |
| mor pistachio durum | Mor Pistachio Durum | OAS-AS-BKL-0024 |
| cashew assiyah | Chocolate Cashew Asiyah | OAS-AS-BKL-0013 |
| cashew assiyah | Mor Cashew Asiyah | OAS-AS-BKL-0014 |

### Draft status

| Status | Count |
|--------|-------|
| `approved` | 82 |
| `pending_approval` | 0 |

---

## Known limitations

1. **Term metadata not persisted** — `term_type` and `channel_scope` remain in draft payload JSON only; `product_aliases` stores `alias_text`, `canonical_name`, `product_id`.
2. **Case-variant duplicates** — Some terms appear in both Title Case and lowercase as separate rows (e.g. `Cashew Assiyah` / `cashew assiyah`). Resolver should normalize before matching.
3. **Shared ambiguous terms** — 3 cross-SKU collisions require clarification workflow at runtime.

---

## Governance confirmation

| Constraint | Status |
|------------|--------|
| Used `approve_catalogue_alias_draft` RPC | Yes |
| Direct `product_aliases` INSERT bypass | No |
| Central sync | No |
| SQL migrations | No |
| Order creation | No |

---

*Generated as part of Phase 1 Language Approval + Resolver Prototype Program.*
