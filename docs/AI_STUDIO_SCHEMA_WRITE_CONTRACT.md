# AI Studio Schema Write Contract

_Date: 2026-03-13 · Sprint: 5-SKU Pilot Remediation · Workstream 1_

## Problem

Fast Create and ProductEdit previously built save payloads with **Central legacy column names** (`name`, `price_b2b`, `sub_category`, `visible_in_catalog`, `ingredients`, `department`) while the shared Supabase `products` table (Studio types) expects **`product_name`, `b2b_price`, `subcategory`, `is_catalogue_ready`, `hero_image_url`**. This caused silent field drops or PostgREST rejections on final save.

## Canonical adapter

| Module | Responsibility |
|--------|----------------|
| `src/features/productAuthority/productSchemaAdapter.ts` | Single write contract |

### Functions

| Function | Direction | Purpose |
|----------|-----------|---------|
| `formToDbProductPayload(form)` | UI → DB | Map ProductEdit / Fast Create form to Studio columns |
| `dbRowToProductForm(row, empty)` | DB → UI | Load product; tolerates Central legacy reads (`name`, `image_url`, `sub_category`) |
| `stripUnknownProductFields(payload)` | Sanitize | Remove keys not in allowlist before insert/update |
| `validateProductSavePayload(payload, mode)` | Guard | Required fields before save |
| `formatProductSaveError(error)` | UX | Surface exact Supabase rejection with schema hints |

### Allowlist source

`PRODUCTS_INSERT_ALLOWLIST` is derived from `Database["public"]["Tables"]["products"]["Insert"]` in `src/integrations/supabase/types.ts`, **minus** live-excluded Studio-only columns in `liveProductsSchema.ts`.

**Live-excluded Studio columns:** `approximate_piece_weight_g`, `pieces_per_kg` — absent on shared Central `products` (PGRST204).

**Central compat columns (live write):** `image_url`, `grams_per_piece`, `pcs_per_kg`, `weight_per_pc_grams` — included in `PRODUCTS_WRITE_ALLOWLIST`.

### Fields intentionally NOT written to `products`

| UI field | Reason |
|----------|--------|
| `ingredients` | UI-only until `product_ingredients` / nutrition authority path |
| `allergen_warnings` | UI-only until structured allergen table |
| `nutritional_info` | Belongs on `nutrition_panels` |
| `approximate_piece_weight_g` | UI-only — maps to live `grams_per_piece` on save |
| `pieces_per_kg` | UI-only — maps to live `pcs_per_kg` on save |
| `name`, `price_b2b`, `visible_in_catalog`, etc. | Central legacy — stripped |

## Integration points

| Surface | Before save | On error |
|---------|-------------|----------|
| `ProductEdit.tsx` | `assertStructuredSkuForSave` → `formToDbProductPayload` → `validateProductSavePayload` | `formatProductSaveError` + `submitError` |
| `saveFastCreateProduct.ts` | Same adapter + validation | Throws with formatted message |

## Required fields

| Mode | Required |
|------|----------|
| **create** | `product_name`, `sku` |
| **create/update** | If `main_department === ready_goods_store` → `production_department` |

## Hero image dual-write

`formToDbProductPayload` sets both:

```ts
hero_image_url: hero,
image_url: hero,  // Central catalogue compat when column exists
```

`ProductMediaUploader` / Fast Create upload also use `heroUrlWritePayload()` from `src/lib/productImage.ts`.

## Audit comparison (legacy vs contract)

| UI form field | Legacy write (removed) | Contract write |
|---------------|------------------------|----------------|
| `product_name` | `name` | `product_name` |
| `subcategory` | `sub_category` | `subcategory` |
| `b2b_price` | `price_b2b` | `b2b_price` |
| `is_catalogue_ready` | `visible_in_catalog` | `is_catalogue_ready` |
| `approximate_piece_weight_g` | `grams_per_piece`, `weight_per_pc_grams` | `grams_per_piece` (+ derived `pcs_per_kg`) |
| `hero_image_url` | `image_url` only | `hero_image_url` + `image_url` |

## Tests

`src/features/productAuthority/productAuthority.test.ts`:

- Maps form to Studio columns (no legacy keys)
- Strips unknown fields
- Validates required fields on create

## Owner / infra notes

- If save fails with *"Could not find the 'image_url' column"*, owner must confirm `image_url` exists on shared `products` or remove dual-write (documented only — do not apply destructive migration without sign-off).
- Regenerate types after any `products` migration: `supabase gen types`.

## Status

| Item | Status |
|------|--------|
| Adapter module | **Done** |
| ProductEdit integration | **Done** |
| Fast Create integration | **Done** |
| Unit tests | **Done** |
