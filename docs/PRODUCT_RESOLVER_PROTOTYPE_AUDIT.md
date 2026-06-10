# Product Resolver Prototype Audit

**Date:** 2026-06-10  
**Module:** `src/features/productResolver/`  
**Mode:** Read-only — no order creation, no Central sync, no production writes

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

### Output contract

```typescript
{
  input: string;
  normalized_text: string;
  matched_sku: string | null;
  matched_product: string | null;
  matched_product_id: string | null;
  confidence: number;
  clarification_required: boolean;
  candidates: ResolverCandidate[];  // max 3
}
```

### Configuration

| Parameter | Value |
|-----------|-------|
| `min_threshold` | 0.72 |
| `ambiguity_delta` | 0.08 |
| `max_candidates` | 3 |

---

## Files delivered

| File | Role |
|------|------|
| `src/features/productResolver/types.ts` | Types + default config |
| `src/features/productResolver/normalizeUtterance.ts` | Text normalization |
| `src/features/productResolver/resolveProduct.ts` | Core resolver (pure, injectable catalog) |
| `src/features/productResolver/loadResolverCatalog.ts` | Read-only Supabase catalog loader |
| `src/features/productResolver/productResolver.test.ts` | Unit tests |
| `scripts/run-resolver-prototype-audit.mjs` | Utterance audit runner |

---

## Utterance test audit (Phase 1 anchor catalog)

**Fixture:** 82 approved aliases across 4 anchor SKUs from `batch001_phase1_drafts_payload.json`

| # | Utterance | Expected | Result | Pass |
|---|-----------|----------|--------|------|
| 1 | mor kaju asiyah | OAS-AS-BKL-0014 | OAS-AS-BKL-0014 (0.94) | ✓ |
| 2 | 2 mor kaju asiyah chahiye | OAS-AS-BKL-0014 | OAS-AS-BKL-0014 (0.94) | ✓ |
| 3 | chocolate kaju asiyah | OAS-AS-BKL-0013 | OAS-AS-BKL-0013 (0.94) | ✓ |
| 4 | tart kaju | OAS-AS-BKL-0020 | OAS-AS-BKL-0020 (0.94) | ✓ |
| 5 | mor pistachio durum | OAS-AS-BKL-0024 | OAS-AS-BKL-0024 (0.94) | ✓ |
| 6 | OAS-AS-BKL-0020 | OAS-AS-BKL-0020 | OAS-AS-BKL-0020 (1.00) | ✓ |
| 7 | cashew assiyah | clarify | clarification_required | ✓ |
| 8 | cashew high gap baklawa | clarify | clarification_required | ✓ |
| 9 | cashew box | clarify | clarification_required | ✓ |
| 10 | random sweet | clarify | clarification_required | ✓ |

### Readiness score: **100%** (10/10 utterance tests)

---

## Unit test results

```
src/features/productResolver/productResolver.test.ts — 6/6 pass
```

Coverage:
- Filler/quantity stripping
- Unambiguous keyword resolution
- SKU direct match
- Cross-SKU ambiguity flagging
- Vague utterance handling
- Empty input handling

---

## Behaviour verified

### Unambiguous resolution

Customer text with product-specific keywords resolves to a single SKU with confidence ≥ 0.72 and `clarification_required: false`.

### Ambiguity detection

Shared terms (`cashew assiyah`, `cashew high gap baklawa`) correctly return:
- `clarification_required: true`
- `matched_sku: null`
- 2+ candidates with tied confidence (0.94)

### SKU preservation

SKU-pattern input (`OAS-AS-BKL-0020`) bypasses quantity stripping and resolves with confidence 1.0.

### Vague input safety

`cashew box` and `random sweet` do not silently resolve to a wrong product.

---

## Gaps and limitations (prototype)

| Gap | Impact | Phase 2 action |
|-----|--------|----------------|
| No `term_type` weighting | WhatsApp keywords not boosted over official aliases | Add channel-scoped scoring |
| Case-sensitive alias rows in DB | Duplicate match paths for Title/lowercase | Normalize at approve or dedupe |
| No live DB integration test | Catalog loader untested against production in CI | Add integration test with SKU filter |
| Token overlap only | No trigram/fuzzy for typos | Add pg_trgm or Levenshtein |
| 4-SKU scope only | Cannot resolve Batch 001 remainder | Expand after Batch 002 approval |
| No quantity extraction output | Qty stripped but not returned | Add `extracted_quantity` field |

---

## Resolver readiness score

| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Utterance test pass rate | 100% | 40% | 40 |
| Unit test pass rate | 100% | 20% | 20 |
| Ambiguity handling | 100% | 20% | 20 |
| SKU safety | 100% | 10% | 10 |
| Production gaps (term_type, fuzzy, full catalog) | 40% | 10% | 4 |

### **Overall resolver readiness: 94/100**

Suitable for **Phase 1 anchor SKU prototype** with human clarification fallback. Not yet production-ready for full Batch 001 catalog.

---

## Constraints confirmed

| Constraint | Status |
|------------|--------|
| Read-only | Yes — no writes |
| No order creation | Yes |
| No Central sync | Yes |
| No production write path | Yes |

---

*Audit script: `node scripts/run-resolver-prototype-audit.mjs`*
