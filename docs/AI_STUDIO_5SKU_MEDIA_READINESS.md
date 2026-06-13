# AI Studio 5-SKU Media Readiness

_Date: 2026-03-13 · Sprint: 5-SKU Pilot Remediation · Workstream 3_

## Bucket expectation

| App | Bucket | Migration in AI Studio repo |
|-----|--------|----------------------------|
| **AI Studio** | `product-media` | Yes — `20260506093134` (public read, team write) |
| **Central** (read-only ref) | `product-images` | No migration in Central repo |

Constant: `AI_STUDIO_MEDIA_BUCKET = "product-media"` (`src/lib/productImage.ts`).

## Upload path

```
products/{sku|id}/raw/{timestamp}-{filename}
```

Fast Create staging path: `products/fast-create/{uuid}/raw/…`

Public URL: `supabase.storage.from("product-media").getPublicUrl(path)`.

## Hero dual-write (Central compat)

On every hero write:

| Column | Owner |
|--------|-------|
| `hero_image_url` | AI Studio canonical |
| `image_url` | Central B2B catalogue (when column exists on shared DB) |

Helpers: `resolveProductHeroUrl()` (read), `heroUrlWritePayload()` (write).

**ProductEdit** displays hero via `resolveProductHeroUrl({ hero_image_url, image_url })`.

## Readiness probe

`src/features/productAuthority/mediaReadiness.ts`:

| Function | Behavior |
|----------|----------|
| `probeProductMediaBucket()` | Read-only `storage.list` — no upload |
| `evaluatePilotMediaForProduct()` | Hero URL + `product_media` types |

### Square / white-background check

Present if `product_media.type` is one of: `square_image`, `white_background`, `hero_image`.

## Per-pilot-SKU checklist (live)

Use **Testing → 5-SKU Pilot Readiness** (`/testing/pilot-readiness`) or `evaluateAllPilotSkus()`.

| SKU | Hero present | Square present | Bucket OK | Upload path |
|-----|--------------|----------------|-----------|-------------|
| OAS-AS-BKL-0024 | Live check | Live check | Live probe | Code ready |
| OAS-AS-BKL-0020 | Live check | Live check | Live probe | Code ready |
| OAS-AS-BKL-0001 | Live check | Live check | Live probe | Code ready |
| OAS-AS-BKL-0025 | Live check | Live check | Live probe | Code ready |
| OAS-AS-BKL-0007 | Live check | Live check | Live probe | Code ready |

> **Baseline audit (Batch 001):** 0/25 hero images populated before this sprint. Expect **fail** on hero/square until ops upload.

## Bucket missing — owner action

If probe returns `missing`:

```
Storage bucket "product-media" not found.
Owner action: apply migration 20260506093134 (product-media) in Supabase Dashboard.
```

Full text: `MEDIA_BUCKET_OWNER_ACTION` in `mediaReadiness.ts`.

Fast Create shows amber banner when bucket unreachable.

## UI surfaces

| Surface | Media behavior |
|---------|----------------|
| `FastCreateProduct` | `uploadFastCreateHero` → bucket probe banner |
| `ProductEdit` | `ProductMediaUploader` + URL field; dual column sync |
| `PilotReadinessDashboard` | Per-SKU hero/square status |

## Status

| Item | Code | Data/infra |
|------|------|------------|
| Bucket constant + path | **Done** | Owner verify bucket live |
| Dual hero write | **Done** | — |
| Hero read fallback | **Done** | — |
| Pilot media evaluator | **Done** | Upload assets for 5 SKUs |
| Square taxonomy | **Partial** | Ops upload `square_image` rows |

See also: `docs/IMAGE_STORAGE_AND_SYNC_AUDIT.md`.
