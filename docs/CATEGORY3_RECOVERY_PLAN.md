# Category 3 Recovery Plan

**Date:** 2026-06-10  
**Program:** Product Authority Completion Wave — Workstream D  
**Scope:** Catalogue Builder, public share, collection publication, readiness scoring

---

## Executive summary

| Area | Finding | Readiness |
|------|---------|-----------|
| `/c/:token` route | **Exists** in `App.tsx` | 50% |
| Public resolver logic | **Wrong table** — reads `catalogues`, not `catalogue_share_links` | 0% |
| Share URL generation | Builder uses `share_token` → `/c/{token}` | 80% |
| Collection publication workflow | Draft-only; no publish RPC | 25% |
| Collection readiness scoring | Optimistic gates in Builder | 20% |
| Batch 001 product fit | 25 SKUs; none publishable (media/packaging) | 15% |
| **Category 3 readiness** | | **32%** |

The route exists but the resolver is wired to the legacy catalogue system. Builder share links will 404 or show "Catalogue not available" because `PublicCatalogue` queries `catalogues.public_slug`, not `catalogue_share_links.share_token`.

---

## Investigation findings

### 1. `/c/:token` route mismatch

**Route registration** (`src/App.tsx` line 53):
```tsx
<Route path="/c/:slug" element={<PublicCatalogue />} />
```

**PublicCatalogue lookup** (`src/pages/PublicCatalogue.tsx` line 16):
```tsx
supabase.from("catalogues").select("*").eq("public_slug", slug).eq("status", "published")
```

**Builder share URL** (`collectionStore.ts`):
```tsx
buildShareUrlPlaceholder(shareToken) → `${origin}/c/${shareToken}`
```

| System | Identifier | Table |
|--------|------------|-------|
| Legacy public catalogue | `public_slug` | `catalogues` |
| New Builder collections | `share_token` | `catalogue_share_links` |

**Root cause:** Route path is correct; **page component resolves wrong data source**. Share tokens from Builder never match `catalogues.public_slug`.

### 2. Public catalogue share path

| Path | Works today? | Data source |
|------|--------------|-------------|
| `/c/{legacy-slug}` | Only if slug exists in `catalogues.public_slug` | Legacy |
| `/c/{share_token}` | **No** — token not in `catalogues` | Builder |
| `/catalogues/:id` (admin) | Yes (authenticated) | Builder admin |

### 3. Collection publication workflow

| Step | Status |
|------|--------|
| Create collection | ✓ `catalogue_collections` |
| Add products | ✓ `catalogue_collection_items` |
| Generate share link | ✓ `catalogue_share_links` (placeholder) |
| Publish collection | ✗ No `status: published` transition RPC |
| Public render | ✗ Wrong resolver |
| PDF / WhatsApp export | ✓ Client-side (uses local card data) |
| Channel pricing on public view | ✗ Requires `get_public_catalogue_channel_data` RPC (legacy slug only) |

### 4. Collection readiness scoring

`evaluateCataloguePublishability` correctly checks media, pricing, compliance — but `CatalogueBuilder.tsx` bypasses:

```tsx
// productToForm() — optimistic
media_status: "approved"
// rowToCard() — optimistic
complianceApproved: true
```

**Honest scoring result for Batch 001:** 0/25 products publishable (media + packaging + compliance blockers).

| Gate | Honest | Builder today |
|------|--------|---------------|
| Content | 25/25 | 25/25 |
| Media | 0/25 | 25/25 (false) |
| Pricing approved | 0/25 | 0/25 (hidden) |
| Compliance approved | 0/25 | 25/25 (false) |
| Packaging chain | 0/25 | not checked |

### 5. Collection item overrides

`display_name_override` and `description_override` on `catalogue_collection_items` are **never read** in Builder or public view. Collection-specific naming is unavailable.

---

## Recovery plan (Wave 4C)

### C3-R1 — Public collection resolver (P0, small UI fix)

**Create:** `src/pages/PublicCollectionCatalogue.tsx` OR extend `PublicCatalogue.tsx`

```
/c/:token
  → lookup catalogue_share_links.share_token = :token
  → join catalogue_collections (status check)
  → join catalogue_collection_items + products
  → apply display_name_override ?? products.name
  → render with honest publishability badges
```

**Effort:** 1–2 components, ~150–250 lines. No migration.

### C3-R2 — Honest Builder gates (P1)

1. Remove hardcoded `media_status: "approved"` and `complianceApproved: true`
2. Load real `image_url`, compliance flags from `products`
3. Show `AuthorityStatusBadges` blockers on each card
4. Disable share link creation when any item has blockers

### C3-R3 — Collection publish workflow (P1)

1. Add `status: draft | published | archived` transition on `catalogue_collections`
2. Publish gate: all items must pass `evaluateCataloguePublishability`
3. Invalidate/regenerate share links on unpublish

### C3-R4 — Legacy bridge (P2)

Map existing `catalogues.public_slug` entries to `catalogue_share_links` for backward compatibility, or redirect `/c/{legacy-slug}` via unified resolver.

### C3-R5 — Hamper collection profile (P3)

When `catalogue_type === 'gift_hamper'`, load `hamper_bom` and render bundle composition.

---

## Collection readiness scoring model (proposed)

| Dimension | Weight | Batch 001 today |
|-----------|--------|-----------------|
| All items media-ready | 30% | 0% |
| All items compliance-approved | 20% | 0% |
| All items packaging-valid | 20% | 0% |
| Channel pricing configured | 15% | 0% |
| Collection published + share active | 15% | 0% |
| **Collection publishability** | | **0%** |

---

## Readiness: 32%

| Layer | Score |
|-------|-------|
| Schema / CRUD | 75% |
| Share URL generation | 80% |
| Public resolver E2E | 5% |
| Honest readiness gates | 20% |
| Publication workflow | 25% |
| **Weighted** | **32%** |

---

## References

- `src/App.tsx`
- `src/pages/PublicCatalogue.tsx`
- `src/pages/CatalogueBuilder.tsx`
- `src/features/catalogueBuilder/collectionStore.ts`
- `src/features/catalogueBuilder/cataloguePublishability.ts`
