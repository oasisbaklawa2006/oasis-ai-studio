# AI Studio 5-SKU Pilot Readiness Dashboard

_Date: 2026-03-13 · Sprint: 5-SKU Pilot Remediation · Workstream 6_

## Live dashboard

**Route:** `/testing/pilot-readiness`  
**Code:** `src/pages/PilotReadinessDashboard.tsx`  
**Evaluator:** `src/features/productAuthority/pilotReadiness.ts` → `evaluateAllPilotSkus()`

Also linked from **Testing** checklist page.

## Dimensions per SKU

| Dimension | Pass criteria | Source |
|-----------|---------------|--------|
| Structured SKU | `OAS-…` format, not `DRAFT-*` | `skuGuard` |
| Schema save | Payload maps to Studio columns; required fields present | `productSchemaAdapter` |
| HSN/GST | Both `hsn_code` and `gst_rate` on row | `products` |
| Packaging | `approximate_piece_weight_g` > 0 AND `pieces_per_kg` > 0 | `products` |
| Hero image | `resolveProductHeroUrl` non-empty | `products` |
| Square image | `product_media` type ∈ square/white/hero | `product_media` |
| Alias term types | ≥3 active aliases (partial until term_type migration) | `product_aliases` |
| Resolver collisions | **unknown** — inbox not in sprint | — |
| Approval RPC | **unknown** — verify in Supabase | — |
| **Ready** | Gate: structured SKU + schema + HSN/GST + packaging + hero + ≥1 alias + row exists | Composite |

## Pilot SKUs

| SKU | Label |
|-----|-------|
| OAS-AS-BKL-0024 | Mor Pistachio Durum |
| OAS-AS-BKL-0020 | Tart Cashew |
| OAS-AS-BKL-0001 | Cashew Kitta |
| OAS-AS-BKL-0025 | Coconut Durum |
| OAS-AS-BKL-0007 | Cashew Finger |

## Global media bucket row

Dashboard header shows `probeProductMediaBucket()` status and readiness **%** (`ready/total`).

## Static snapshot (pre-data sprint — expected)

Based on Batch 001 audit (`AI_STUDIO_PRODUCT_AUTHORITY_MISSING_POINTS_AUDIT.md`):

| SKU | Expected structured SKU | HSN/GST | Packaging | Hero | Square | Ready |
|-----|-------------------------|---------|-----------|------|--------|-------|
| 0024 | pass (if rows exist) | partial | fail | fail | fail | **blocked** |
| 0020 | pass | partial | fail | fail | fail | **blocked** |
| 0001 | pass | partial | fail | fail | fail | **blocked** |
| 0025 | pass | partial | fail | fail | fail | **blocked** |
| 0007 | pass | partial | fail | fail | fail | **blocked** |

**Expected readiness % before ops data work: 0–20%** (schema/code path only).

Refresh live dashboard after:

1. Packaging grams/pcs apply
2. Hero uploads per SKU
3. HSN/GST compliance approve
4. Alias seeding (≥3 per SKU)

## Deep links

Each SKU card links to `/products/{id}` when row found.

## P0 code fixes enabling dashboard

- Schema write contract (save no longer fails on column mismatch)
- SKU guard (no DRAFT create)
- Media probe + dual hero URL
- Alias insert schema fix

## Remaining owner/ops actions

| ID | Action |
|----|--------|
| P0-02 | Packaging data for 5 SKUs |
| P0-03 | Hero media upload |
| P0-04 | Confirm `product-media` bucket |
| P0-05 | term_type migration (post-pilot) |
| P0-06 | `search_products_with_aliases` RPC |
| P0-08 | HSN/GST approve on rows |
| P0-12 | Verify approve/reject RPCs |

## GO criteria (from rectification backlog)

- [ ] 5 structured SKUs
- [ ] HSN + GST on each
- [ ] grams_per_piece + pcs_per_kg on each
- [ ] Hero + synced image_url
- [ ] ≥3 aliases in DB per SKU
- [ ] Resolver tests pass
- [ ] Readiness ≥6/8 dimensions per SKU

**Current sprint:** Code path **GO** for authoring; data plane **NO-GO** until ops complete above.
