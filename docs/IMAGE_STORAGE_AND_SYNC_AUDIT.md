# Image Storage and Sync Audit

_Date: 2026-03-28 · Shared Supabase: `tcxvcatsqqertcnycuop`_

## Executive summary

| Issue | Root cause | Fixed in AI Studio code? | Owner action |
|-------|------------|--------------------------|--------------|
| Central upload "bucket not found" | Central uses **`product-images`** bucket — **no migration creates it** in Central repo | No (Central repo) | Create `product-images` bucket + policies on Supabase |
| Upload success but image not visible | URL in form state; may not persist until **Save product**; preview uses `image_url` | Documented | Save product after upload |
| AI Studio does not show Central images | Column mismatch: Central → `image_url`, AI Studio read `hero_image_url` only | **Yes** — unified `resolveProductHeroUrl` | None |
| AI Studio upload uses different bucket | AI Studio → **`product-media`** (migration exists) | Documented + constant | Ensure `product-media` bucket exists |
| Bucket naming mismatch | `product-images` (Central) vs `product-media` (AI Studio) | Partial — read path unified | Align buckets or create both |

---

## A. Central image upload path

**Component:** `Oasis-Baklawa-Central/src/pages/admin/AdminProducts.tsx`

| Step | Behavior |
|------|----------|
| Upload handler | `handleImageUpload` |
| Storage bucket | **`product-images`** |
| Path/key | `{random36}-{timestamp}.{ext}` (flat root, no folder prefix) |
| URL type | **Public URL** via `getPublicUrl(fileName)` |
| Form field | `formData.image_url` (preview immediate) |
| DB persist | `image_url` in save payload on **Save product** (`handleSave`) |
| Buyer catalogue | Reads `products.image_url` (e.g. `public-order-tracking` function) |

### Observed failure mode

> "bucket could not be located"

**Classification:** `bucket missing` — grep of Central `supabase/migrations` shows **no `INSERT INTO storage.buckets` for `product-images`**. Upload RPC fails before URL is set.

### Upload success but not visible

**Classification:** `URL saved to form but product not saved` OR `URL saved but AI Studio reads wrong column`

- Central preview binds to `formData.image_url` — should show after upload
- If user navigates away without Save, URL is lost
- AI Studio previously ignored `image_url` — fixed in this pack

---

## B. AI Studio image / media path

| Item | Value |
|------|-------|
| Upload component | `ProductMediaUploader.tsx`, `Media.tsx` |
| Storage bucket | **`product-media`** (`src/lib/productImage.ts` → `AI_STUDIO_MEDIA_BUCKET`) |
| Path pattern | `products/{sku|id}/raw/{timestamp}-{filename}` |
| URL type | Public URL via `getPublicUrl` |
| DB columns written | `hero_image_url` **and** `image_url` (after this fix) |
| Gallery table | `product_media` (typed rows); hero also on `products` |
| Central sync | Product row sync may include `image_url`; AI Studio now reads both columns |
| Typed media | `product_media` preferred for readiness; **fallback to `image_url`/`hero_image_url` for display** |

### Files changed (sync read path)

- `src/lib/productImage.ts` — `resolveProductHeroUrl`, `heroUrlWritePayload`
- `src/pages/ProductEdit.tsx` — read/write both columns
- `src/components/ProductMediaUploader.tsx` — hero update writes both columns
- `src/pages/Products.tsx`, `CatalogueBuilder.tsx`, `mediaAssetsFromForm.ts`

---

## C. Supabase storage bucket audit (code-only)

| Bucket | Referenced by | Migration in AI Studio repo | Migration in Central repo |
|--------|---------------|----------------------------|---------------------------|
| **`product-media`** | AI Studio uploads | **Yes** — `20260506093134_*.sql` (public read, team write) | No |
| **`product-images`** | Central AdminProducts | No | **No** |
| `receipts` | Central dispatch/payments | No | Yes |
| `final-invoices` | Central ledgers | No | Yes |
| `whatsapp_attachments` | Central WA | No | Yes |
| `trade-documents` | Central trade | No | Yes |

**Actual bucket status on live project:** Not verified from this environment (no storage admin API). Owner must confirm in Supabase Dashboard → Storage.

---

## D. Root cause classification (image issue)

| Classification | Applies? |
|----------------|----------|
| Bucket missing (`product-images`) | **Yes** — Central error |
| Wrong bucket name in frontend | **Yes** — cross-app mismatch |
| Upload succeeds but URL not saved | **Sometimes** — Central requires Save |
| URL saved but not public/readable | Possible — check bucket `public` flag |
| RLS/storage policy blocks read | Possible on `product-media` |
| Sync sends row but not image field | Possible — depends on sync job |
| AI Studio ignores `image_url` | **Was yes** — **fixed** |
| Browser cache | Low probability |

---

## E. Owner actions (Supabase — not executed by this PR)

### 1. Create Central hero bucket (required for Central uploads)

```text
Bucket id:   product-images
Public:      true (matches Central getPublicUrl usage)
Policies:    team/staff insert + public read (mirror product-media pattern)
```

### 2. Confirm AI Studio bucket

```text
Bucket id:   product-media
Apply:       supabase/migrations/20260506093134_*.sql if missing
```

### 3. Optional long-term alignment

- **Option A:** Central switches to `product-media` + shared path convention
- **Option B:** Keep both buckets; AI Studio displays any public URL in `image_url` or `hero_image_url` (current fix)
- **Option C:** Sync job copies Central `product-images` URLs into `product_media` rows

### 4. Central code fix (separate repo PR — not in this pack)

- Add migration for `product-images` bucket
- Or change `AdminProducts.tsx` to use `product-media` with same path convention as AI Studio

---

## Validation checklist

- [ ] Central: upload hero on test product → Save → `products.image_url` populated in DB
- [ ] AI Studio: Products list shows image from Central `image_url`
- [ ] AI Studio: upload on Product Edit Media tab → both columns set
- [ ] Public URL opens in incognito (storage policy OK)

---

## Fix applied vs blocker

| Item | Status |
|------|--------|
| AI Studio read `image_url` | **Fixed** |
| AI Studio write both URL columns on hero set | **Fixed** |
| Central `product-images` bucket | **Blocker — owner must create** |
| Bucket name alignment | **Documented — owner decision** |
| `product_media` full sync | **Future** — display fallback sufficient for MVP |
