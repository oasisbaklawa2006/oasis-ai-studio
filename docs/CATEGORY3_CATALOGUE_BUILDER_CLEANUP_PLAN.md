# Category 3 / Catalogue Builder Cleanup Plan

**Date:** 2026-06-10  
**Program:** AI Studio Catalogue Authority Completion Wave — Workstream D  
**Scope:** `catalogue_collections` vs legacy `catalogues`, public share, hamper readiness, Category 3 fit  
**Mode:** Audit + cleanup plan — no migrations, no product master writes

---

## Executive summary

| Area | Status | Readiness |
|------|--------|-----------|
| `catalogue_collections` schema | Deployed on Central | 80% |
| Legacy `catalogues` + public page | Working for legacy path | 70% |
| Builder → public share URL | **Broken** — route mismatch | 0% |
| Collection item overrides | Schema exists, UI unused | 20% |
| Product name fallback in collections | Partial | 40% |
| Hamper / gift collection type | Type exists, gates not applied | 25% |
| Publishability gates | Optimistic (hardcoded approved) | 30% |
| Batch 001 product fit | Products exist, not publishable | 35% |
| **Category 3 readiness** | | **35%** |

Category 3 infrastructure (collections, share links, PDF/WhatsApp export) is scaffolded but not end-to-end functional. The highest-impact fix is unifying public catalogue routing between legacy `catalogues` and new `catalogue_share_links`.

---

## Dual catalogue systems

### Legacy: `catalogues` + `catalogue_products`

| Component | Path | Behavior |
|-----------|------|----------|
| Table | `catalogues` | `public_slug`, `status`, channel pricing flags |
| Items | `catalogue_products` | Join to `products` |
| Public page | `src/pages/PublicCatalogue.tsx` | Route: `/catalogue/:slug` |
| Lookup | `catalogues.public_slug` + `status = published` | Works |

### New: `catalogue_collections` + `catalogue_collection_items` + `catalogue_share_links`

| Component | Path | Behavior |
|-----------|------|----------|
| Tables | `catalogue_collections`, `catalogue_collection_items`, `catalogue_share_links` | Builder CRUD |
| Store | `src/features/catalogueBuilder/collectionStore.ts` | Supabase with localStorage fallback |
| Public page | **None** | Share URL points to `/c/:token` — no route handler |
| Lookup | `catalogue_share_links.share_token` | Orphaned |

### Problem: public share URL mismatch

`buildShareUrlPlaceholder()` in `collectionStore.ts`:

```typescript
return `${window.location.origin}/c/${shareToken}`;
```

`PublicCatalogue.tsx` reads:

```typescript
supabase.from("catalogues").select("*").eq("public_slug", slug)
```

**No `/c/:token` route exists in `App.tsx`.** Builder-generated share links return 404 or fall through to app shell.

---

## Collection product name fallback

### Schema supports overrides

`catalogue_collection_items` includes:

- `display_name_override`
- `description_override`

### UI does not apply them

`CatalogueBuilder.tsx` → `rowToCard()`:

```typescript
name: row.product_name ?? "Unnamed",
description: row.short_description,
```

Overrides from collection items are never read. Collection-specific naming (e.g. hamper gift label) is impossible without editing master product name.

### Product query field mismatch

Builder loads products with `product_name` field; Central `products` table uses `name`. Fallback chain may show "Unnamed" even when `name` is populated unless the select alias maps correctly.

---

## Publishability gates (optimistic)

`CatalogueBuilder.tsx` → `productToForm()`:

```typescript
media_status: "approved",  // hardcoded
```

`rowToCard()`:

```typescript
evaluateCataloguePublishability({ form, complianceApproved: true })
```

All Batch 001 products appear publishable in Builder despite:

- `image_url` null on all SKUs
- `complianceApproved: false` in Product Edit
- No approved channel prices

`evaluateCataloguePublishability` correctly blocks when given honest input; Builder bypasses gates.

---

## Hamper / collection readiness

| Feature | Status |
|---------|--------|
| `CatalogueCollectionType` includes hamper types | ✓ in types |
| Hamper BOM in Product Edit | ✓ for `gift_hamper` class |
| Builder hamper profile | **Not applied** — treats all products as single-SKU cards |
| Collection bundling (multi-product hamper) | **Not built** |
| Hamper pricing (bundle MOQ) | **Not built** |
| `/hampers` page | Exists for BOM management, not catalogue collections |

Batch 001 products are all `ready_goods_store` / single-SKU baklawa — no hamper SKUs in Batch 001. Category 3 hamper collections would need:

1. Hamper product records with `product_class: gift_hamper`
2. `hamper_bom` components linked
3. Collection type `gift_hamper` with bundle pricing rules
4. Override display names per collection context

---

## Category 3 fit for Batch 001

| Requirement | Batch 001 status |
|-------------|------------------|
| Products in master | ✓ 25/25 |
| Hero images | ✗ 0/25 |
| Approved compliance | ✗ 0/25 |
| Channel visibility | ✗ 0/25 |
| Approved aliases for search/WhatsApp | 17/25 SKUs |
| Collection can be created | ✓ (schema) |
| Collection can be shared publicly | ✗ (route broken) |
| PDF export | ✓ (client-side, uses card data) |
| WhatsApp mini-catalogue text | ✓ (preview only) |

**Verdict:** Batch 001 is not Category 3 publish-ready. Builder can draft collections locally but public share and honest publishability gates block production use.

---

## Cleanup plan (recommended implementation waves)

### Wave C3-1 — Public route unification (small, safe UI fix)

**Priority: P0**

1. Add route `/c/:shareToken` in `App.tsx` → new `PublicCollectionCatalogue.tsx`.
2. Resolve `catalogue_share_links.share_token` → `catalogue_collections` → items → products.
3. Apply `display_name_override` / `description_override` in render.
4. Deprecate or bridge legacy `/catalogue/:slug` with redirect mapping table (optional).

**Effort:** 1–2 components, no migration if tables exist.

### Wave C3-2 — Honest publishability gates

**Priority: P1**

1. Remove hardcoded `media_status: "approved"` and `complianceApproved: true` from `productToForm`.
2. Load real product fields (`name`, `image_url`, compliance flags) from `products`.
3. Show `AuthorityStatusBadges` blockers on collection cards (component already imported).
4. Block share link creation when any item has publishability blockers.

### Wave C3-3 — Collection item overrides

**Priority: P1**

1. In `listCollectionItems`, return override fields.
2. In `rowToCard`, prefer `display_name_override ?? product.name`.
3. Add inline edit for overrides in Builder UI.

### Wave C3-4 — Hamper collection profile

**Priority: P2**

1. When `catalogue_type === 'gift_hamper'`, load `hamper_bom` for each hamper product.
2. Render bundle composition in public view.
3. Bundle pricing from hamper product MRP, not sum of components.

### Wave C3-5 — Legacy catalogue migration

**Priority: P3**

1. Migrate existing `catalogues` rows to `catalogue_collections` with slug preservation.
2. Single public resolver for both `public_slug` and `share_token`.

---

## Readiness score: 35%

| Dimension | Weight | Score |
|-----------|--------|-------|
| Schema / tables deployed | 20% | 80% |
| Builder CRUD | 15% | 70% |
| Public share E2E | 25% | 0% |
| Override + fallback | 15% | 30% |
| Publishability honesty | 15% | 20% |
| Hamper readiness | 10% | 25% |
| **Weighted total** | | **35%** |

---

## References

- `src/pages/CatalogueBuilder.tsx`
- `src/pages/PublicCatalogue.tsx`
- `src/features/catalogueBuilder/collectionStore.ts`
- `src/features/catalogueBuilder/cataloguePublishability.ts`
- `src/integrations/supabase/types.extensions.ts`
- `docs/AI_STUDIO_MEDIA_AND_CATALOGUE_BUILDER_REPORT.md`
