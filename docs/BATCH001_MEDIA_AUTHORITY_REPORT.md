# Batch 001 Media Authority Report

**Date:** 2026-06-10  
**Program:** Product Authority Completion Wave — Workstream C  
**Scope:** Hero, gallery, thumbnail, catalogue images for all 25 Batch 001 SKUs  
**Mode:** Read-only audit

---

## Executive summary

| Asset type | Required (baklawa profile) | Present in master | Present in media drafts | Readiness |
|------------|--------------------------|-------------------|-------------------------|-----------|
| Hero / primary image | 25/25 | **0/25** | 0 | 0% |
| Gallery / pairing image | 25/25 | **0/25** | 0 | 0% |
| Close-up / thumbnail | 25/25 | **0/25** | 0 | 0% |
| Catalogue-approved set | 25/25 | **0/25** | 0 | 0% |
| **Media readiness** | | | | **0%** |

No Batch 001 product has any image URL in master. The `catalogue_media_submissions` draft table exists but contains zero rows for Batch 001 SKUs.

---

## Media profile (applies to all 25 SKUs)

Detected profile: `baklawa_small_sweets` (`mediaReadinessEngine.ts`)

| Slot | Type key | Required for catalogue | Required for Central sync |
|------|----------|------------------------|---------------------------|
| Hero | `primary_image` | Yes | Yes |
| Gallery | `pairing_image` | Yes | Yes |
| Thumbnail / detail | `close_up_image` | Yes | Yes |

Batch 001 products are Lebanese/Turkish baklawa — all map to the 3-asset minimum profile.

---

## Readiness matrix (25/25 SKUs)

| SKU | Product | `image_url` | Hero | Gallery | Thumbnail | Catalogue set | `media_status` | Profile |
|-----|---------|-------------|------|---------|-----------|---------------|----------------|---------|
| 0001 | Cashew Kitta | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0002 | Square Baklawa | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0003 | Cashew Ring | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0004 | Cashew Rosebud | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0005 | Almond Crosole | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0006 | Cashew Pyramid | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0007 | Cashew Finger | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0008 | Date Baklawa | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0009 | Special Square Baklawa | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0010 | Pistachio Ring | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0011 | Pistachio Pyramid(Topping) | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0012 | Chocolate Pistachio Asiyah | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0013 | Chocolate Cashew Asiyah | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0014 | Mor Cashew Asiyah | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0015 | Mor Pistachio Asiyah | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0016 | Pistachio Asiyah | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0017 | Cashew Asiyah | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0018 | Diamond Pistachio | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0019 | Pistachio Pyramid | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0020 | Tart Cashew | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0021 | Mix Nut Tart | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0022 | Almond Tart | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0023 | Pistachio Tart | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0024 | Mor Pistachio Durum | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |
| 0025 | Coconut Durum | null | ✗ | ✗ | ✗ | ✗ | missing | baklawa_small_sweets |

**Summary row:** 0/25 ready on every asset column.

---

## Storage and draft infrastructure

| Component | Status |
|-----------|--------|
| `products.image_url` | Column exists; all null |
| `ProductMediaUploader` | UI exists on Product Edit Media tab |
| `catalogue_media_submissions` | Table exists; 0 rows for Batch 001 |
| `catalogue_media_drafts` | Governed path per PR-06 design |
| Blob / CDN URLs | Not provisioned in source CSV |
| Catalogue Builder | Hardcodes `media_status: "approved"` — **optimistic gate bug** |

---

## Impact on downstream systems

| Consumer | Impact |
|----------|--------|
| Product Truth readiness | `media_status` blocker on all 25 |
| Catalogue Builder | Cards show no image; falsely marked publishable |
| Public catalogue (`/c/:slug`) | Product cards render without images |
| Central sync preview | `can_sync_media_to_central: false` |
| WhatsApp mini-catalogue | Text-only; no image attachments |

---

## Governed media upload plan (Wave 4B)

### Phase 1 — Hero minimum (25 SKUs)

1. Photography team delivers 1 hero image per SKU (square, min 800×800)
2. Upload via Product Edit → Media tab → `catalogue_media_drafts`
3. Set `primary_image` slot; status `pending_approval`
4. Approve via Approval Inbox → governed media draft RPC
5. Target: 25/25 hero images

### Phase 2 — Full baklawa profile (25 SKUs)

1. Add `pairing_image` + `close_up_image` per SKU
2. Approve full 3-asset set
3. Target: 25/25 catalogue-ready media sets (75 assets total)

### Phase 3 — Catalogue Builder gate fix

Remove hardcoded `media_status: "approved"` in `CatalogueBuilder.tsx` `productToForm()`.

**Estimated asset count:** 75 images minimum (3 × 25 SKUs)

---

## Readiness: 0%

Infrastructure exists; zero assets uploaded. Media is the single largest Product Truth blocker after packaging.

---

## References

- `src/features/mediaReadiness/mediaReadinessEngine.ts`
- `src/components/ProductMediaUploader.tsx`
- `src/pages/CatalogueBuilder.tsx` (optimistic gate)
- `docs/AI_STUDIO_MEDIA_AND_CATALOGUE_BUILDER_REPORT.md`
