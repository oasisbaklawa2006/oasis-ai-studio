# Unified Product Media Architecture

_Date: 2026-03-13 · Shared Supabase: `tcxvcatsqqertcnycuop`_

## Current state

| App | Bucket | Hero column | Gallery |
|-----|--------|-------------|---------|
| Central | `product-images` (often missing) | `products.image_url` | None |
| AI Studio | `product-media` (migration exists) | `hero_image_url` + synced `image_url` | `product_media` table |

**Problem:** Two buckets, two write paths, one catalogue. Read path unified in code; write path still split.

---

## Recommended architecture (additive)

### Single media authority: **AI Studio `product-media` bucket**

| Principle | Detail |
|-----------|--------|
| **Write authority** | AI Studio `ProductMediaUploader` + Fast Create hero upload |
| **Read authority** | `resolveProductHeroUrl()` — accepts any public URL in either column |
| **Cross-app consumption** | Central reads `image_url` or `hero_image_url`; no Central upload long-term |
| **Governance** | Contributor media → `catalogue_media_submissions` draft queue |

### Canonical media roles

Defined in `src/lib/productImage.ts` → `PRODUCT_MEDIA_ROLES`:

| Role | Purpose | Required for |
|------|---------|--------------|
| `hero_image` | Primary catalogue / list thumbnail | Catalogue-ready |
| `square_image` | Grid / WhatsApp square crop | Social / WA catalogue |
| `detail_image` | PDP detail | Buyer portal |
| `packaging_image` | Pack shot / carton | B2B orders |
| `lifestyle_image` | Context / gifting | Premium catalogues |
| `label_image` | FSSAI label scan | Label queue |
| `raw_photo` | Source iPhone capture | Media workflow |
| `video` | Reel / motion | Future WA rich media |

Supporting angles (`closeup`, `side_angle`, etc.) map to `product_media` typed rows today.

---

## Storage structure

```
product-media/
  products/
    {sku-or-id}/
      raw/           # camera / upload originals
      submissions/   # contributor pending assets
      hero/          # (optional) promoted hero copies
  fast-create/
    {uuid}/raw/      # pre-product-id staging (Fast Create)
```

**Path builders:** `buildDirectMediaPath`, `buildStagingMediaPath` in `mediaDraftBoundary.ts`

---

## Data model

### `products` row (hero sync)

```typescript
heroUrlWritePayload(url) → { hero_image_url: url, image_url: url }
```

Both columns written on every hero mutation — **Central compatibility without Central code changes**.

### `product_media` row (gallery)

| Column | Purpose |
|--------|---------|
| `product_id` | FK |
| `type` | Media role |
| `file_url` | Public URL |
| `storage_path` | Bucket path |
| `status` | draft / approved |
| `is_hero` | Deprecated in favor of products columns; gallery may still flag |

---

## Flows

### Upload (AI Studio)

```
User selects file
  → uploadMediaFileToStorage (product-media)
  → insert product_media row (if gallery)
  → update products.hero_image_url + image_url (if hero)
  → contributor? submitMediaCatalogueDraft
```

### Fast Create (pre-ID)

```
Upload → products/fast-create/{uuid}/raw/...
  → public URL stored on product insert
```

### Read (any app)

```
resolveProductHeroUrl(row) → hero_image_url ?? image_url
product_media gallery → typed assets for readiness engine
```

### Snapshot / catalogue export

`catalogueSnapshot` + `mediaReadinessEngine` read `product_media` first, fall back to hero columns.

---

## Migration path (no destructive changes)

| Phase | Action | Owner |
|-------|--------|-------|
| 1 | Create `product-images` bucket OR redirect Central to `product-media` | Supabase admin |
| 2 | AI Studio dual-column sync (done) | Code deployed |
| 3 | Backfill `product_media` rows from existing `image_url` URLs | Optional script |
| 4 | Central upload UI calls Studio media API or shared edge upload | Central team (future) |
| 5 | Deprecate flat `product-images` root uploads | After backfill |

---

## Cross-app consumption matrix

| Consumer | Read path | Write path |
|----------|-----------|------------|
| AI Studio Products list | `resolveProductHeroUrl` | Fast Create / Media uploader |
| Catalogue Builder | `resolveProductHeroUrl` | Read-only |
| Central buyer catalogue | `image_url` | Migrate to Studio |
| Label Queue | `label_image` in `product_media` | Studio Labels |
| Public catalogue | Snapshot hero URL | Snapshot generator |

---

## Decision

**Final authority:** AI Studio owns `product-media` bucket + `product_media` taxonomy. Central retains read access via synced `image_url`. No new migrations required in this wave — constants and sync helpers only.
