# Media Authority Mapping

_Date: 2026-03-13 · Sprint: Product Authority Reconciliation_

## Problem

Uploader taxonomy (`product_media.type`) and Product Truth readiness taxonomy (`MediaAssetType`) were incompatible. Only hero was recognized; lifestyle mapped incorrectly to pairing.

## Authoritative mapping

Single source: `MEDIA_UPLOADER_TO_READINESS` in `readinessProfiles.ts`

| Uploader type (`product_media.type`) | Readiness slot | Required (Baklawa) |
|-----------------------------------|----------------|---------------------|
| `hero_image` | `primary_image` | **Yes** |
| `white_background`, `square_image` | `catalogue_image` | **Yes** |
| `closeup`, `detail_image` | `close_up_image` | **Yes** |
| `lifestyle`, `lifestyle_image` | `pairing_image` | Optional (Baklawa) |
| `side_angle`, `top_angle`, `45_angle` | `secondary_angle` | Optional |
| `hamper_open`, `hamper_closed` | `lifestyle_variant` | Profile-specific |
| `label_image` | `packaging_reference` | Profile-specific |
| `source_pdf_page` | `source_reference` | Reference only |
| `raw_photo` | `secondary_image` | Optional |

## Profile requirements

Defined in `readinessProfiles.ts` → consumed by `mediaReadinessEngine.ts`.

### Baklawa (`baklawa_small_sweets`)

**Required:** hero, white background, closeup  
**Optional:** lifestyle, angle shots

## Data flow

```
ProductMediaUploader → product_media table
ProductEdit.loadProductMedia() → productMediaRows
mediaAssetsFromProductMedia() → MediaAsset[]
MediaReadinessPanel / productTruthInputFromForm → evaluateMediaReadiness()
```

## Status mapping

| `product_media.status` | Readiness status | UI label |
|------------------------|------------------|----------|
| `approved` | `approved` | approved |
| `raw`, `pending` | `pending_approval` | **draft pending approval** |
| (absent) | — | missing |

## Tests

- `mediaAssetsFromForm.test.ts` — four upload types map correctly
- `mediaReadinessEngine.test.ts` — Baklawa requires catalogue_image not lifestyle
- `productTruthAuthority.test.ts` — all four assets participate in readiness
