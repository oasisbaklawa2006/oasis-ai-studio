# Batch 002 Launch Readiness

**Date:** 2026-06-10  
**Program:** Product Authority Completion Wave — Workstream F  
**Scope:** Product import Batch 002 — files, schema, blockers, effort, sequencing

---

## Executive summary

**Batch 002 product import is not launch-ready.** Category 1 Batch 001 (25 baklawa SKUs) is complete in master. No authority file exists for products 26–50. Language Wave 2C (the immediate "Batch 002" language work) is **complete** — all 25 SKUs now have approved aliases.

| Track | Readiness |
|-------|-----------|
| Language Wave 2C | **100%** (executed) |
| Language Wave 2D (term depth) | 67% (267/396 terms) |
| Product import Batch 002 | **18%** |
| **Combined Batch 002 readiness** | **42%** |

---

## Definitions

| Term | Meaning in this program |
|------|-------------------------|
| Batch 001 | 25 Lebanese/Turkish baklawa SKUs (`OAS-AS-BKL-0001`–`0025`) — **in master** |
| Language Wave 2C | 8 uncovered SKUs language completion — **done** |
| Product import Batch 002 | Next 25–50 **new** products from authority CSV — **not started** |

---

## Exact files required (product import Batch 002)

| File | Status | Purpose |
|------|--------|---------|
| `data/category2-preview/CATEGORY2_IMPORT_BATCH_002_authority.csv` | **MISSING** | Product master source (names, prices, weights, aliases) |
| `data/category2-preview/batch002_language_terms_safe_to_draft.csv` | **MISSING** | Language preview (post-import) |
| `scripts/validate-category2-import.mjs` | **MISSING** | Pre-staging validation |
| `scripts/execute-batch002-language.mjs` | **MISSING** | Language wave prep (after import) |
| Category 1 staging route | ✓ `/admin/import/category-1` | Reuse for Batch 002 with extended column map |
| `docs/BATCH002_IMPORT_CHECKLIST.md` | **MISSING** | Operator runbook |

### Minimum CSV columns (based on Batch 001 precedent)

| Column | Required | Maps to |
|--------|----------|---------|
| Product Name | Yes | `name` |
| SKU (or auto-assign) | Yes | `sku` |
| Category | Yes | `category` |
| UOM | Yes | `uom` |
| Selling Price B2B | Yes | `price_b2b` |
| Selling Price B2C / MRP | Yes | `mrp` |
| GST | Yes | `gst_rate` |
| Weight (GM) | Yes | `grams_per_piece` |
| Prmiary Packing | Yes | `pack_size` |
| Secondary Packing | Yes | `pcs_per_master_carton` |
| Product Aliases | Recommended | Language preview input |
| WhatsApp Keywords | Recommended | Language preview input |
| Shelf Life | Recommended | `shelf_life_days` |
| Departments | Yes | `department`, `production_department` |

---

## Exact schema required

### Master tables (read for duplicate check)

| Table | Columns used |
|-------|--------------|
| `products` | `sku`, `name`, `id` |

### Draft tables (write on staging)

| Table | Operation | Permission |
|-------|-----------|------------|
| `catalogue_product_drafts` | `create` per row | `catalogue.products.submit` |

### Not written at import

| Table | Reason |
|-------|--------|
| `products` | Master writes via approval RPC only |
| `product_aliases` | Language waves post-import |
| `product_pricing_rules` | Category 2 pricing governance |
| `catalogue_collections` | Category 3 |

### SKU pattern

```
OAS-{Division}-{Category}-{Sequence}

Batch 001: OAS-AS-BKL-0001 … 0025 (complete)
Batch 002 proposals:
  OAS-AS-BKL-0026 … 0050  (baklawa extensions)
  OAS-AS-KUN-0001 … 0025  (kunafa — if authority provides)
  OAS-AS-FUS-0001 … 0025  (fusion — if authority provides)
```

### HSN/GST defaults (Batch 001 precedent)

| Field | Default |
|-------|---------|
| `hsn_code` | `21069099` |
| `gst_rate` | `0.05` |
| `uom` | `KG` |
| `retail_uom` | `pc` |
| `b2b_uom` | `kg` |
| `allergen_warnings` | `Imported — requires review` |

---

## Exact blockers

| # | Blocker | Severity | Owner |
|---|---------|----------|-------|
| 1 | No Batch 002 authority CSV | **Blocking** | Product team |
| 2 | Packaging fields not mapped on Batch 001 (precedent risk) | High | Engineering — fix Batch 001 first |
| 3 | No media on any SKU (import will repeat gap) | High | Ops / photography |
| 4 | `term_type` not persisted on `product_aliases` | High | Engineering — Wave 4E |
| 5 | Category 3 public share broken | Medium | Engineering — Wave 4C |
| 6 | No `product_truth_snapshot` persistence | Medium | Engineering — Wave 4D |
| 7 | Compliance not approved on Batch 001 | Medium | Product authority |
| 8 | `import_logs` table missing | Low | Deferred |
| 9 | No Batch 002 validation script | Medium | Engineering |
| 10 | Language preview pipeline not run for new SKUs | Medium | Post-import step |

---

## Expected effort (technical)

| Work package | Components | Dependencies |
|--------------|------------|--------------|
| Authority file delivery | CSV from product team | Business input |
| Import validator extension | `category1Import` column map + SKU range check | Authority file |
| Staging submit (25–50 rows) | Reuse `/admin/import/category-1` | Validator |
| Approval (25–50 drafts) | Approval Inbox | Human review |
| Packaging mapping fix | Apply Batch 001 lesson to import mapper | Validator update |
| Language preview generation | New script from aliases column | Post-import |
| Language wave execution | Governed draft + approve pattern | Preview |
| Media upload (25–50 SKUs) | 75–150 images minimum | Photography |
| Product Truth snapshot baseline | Per SKU after packaging + media | Waves 4A–4D |

---

## Import sequencing (recommended)

```
Phase 0 — Batch 001 completion (prerequisite)
  ✓ Language Wave 2C (done)
  → Packaging republish Wave 4A (25 SKUs)
  → Media upload Wave 4B (25 SKUs)
  → Compliance approval (25 SKUs)

Phase 1 — Batch 002 preparation
  1. Product team delivers CATEGORY2_IMPORT_BATCH_002_authority.csv
  2. Engineering extends validator + SKU auto-assign (0026+)
  3. Dry-run duplicate scan against existing 25 SKUs
  4. Collision scan on proposed aliases vs 267 existing

Phase 2 — Batch 002 staging (do not skip)
  5. Submit 25–50 catalogue_product_drafts (pending_approval)
  6. Human approval via Inbox
  7. Verify packaging fields mapped (grams_per_piece, pcs_per_kg)
  8. Set allergen_warnings = "Imported — requires review"

Phase 3 — Batch 002 authority completion
  9. Generate language preview CSV
  10. Execute language wave (governed drafts)
  11. Media upload (3 assets × N SKUs)
  12. Compliance review queue
  13. Product Truth snapshot baseline per SKU

Phase 4 — Catalogue (Category 3)
  14. Fix public collection resolver (Wave 4C)
  15. Create first publishable collection

DO NOT: import Batch 002 before Batch 001 packaging + media waves complete.
```

---

## Readiness: 42%

| Track | Weight | Score |
|-------|--------|-------|
| Language (Wave 2C complete) | 30% | 100% |
| Language depth (Wave 2D) | 10% | 67% |
| Product import infrastructure | 20% | 80% |
| Authority file | 25% | 0% |
| Batch 001 prerequisite completion | 15% | 25% |
| **Weighted** | | **42%** |

---

## References

- `docs/BATCH001_LANGUAGE_COVERAGE_REPORT.md`
- `docs/BATCH001_PACKAGING_AUTHORITY_REPORT.md`
- `docs/CATEGORY1_IMPORT_STAGING_PLAN.md`
- `data/category1-preview/CATEGORY1_IMPORT_BATCH_001_uploaded.csv`
