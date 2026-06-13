# Product Truth Source Map

_Date: 2026-03-13 · Sprint: Product Authority Reconciliation_

## Principle

Every Product Truth value must originate from the **same authoritative source** as Product Edit. No duplicate truth systems, no inferred defaults.

| Authority layer | Module |
|-----------------|--------|
| Products row (form) | `productSchemaAdapter.ts`, `packagingTruth.ts` |
| Channel pricing | `product_pricing_rules` via `channelAuthorityMappers.ts` |
| Channel MOQ | `product_moq_rules` via `channelAuthorityMappers.ts` |
| Media assets | `product_media` + `products.hero_image_url` via `mediaAssetsFromSources()` |
| Media requirements | `readinessProfiles.ts` |
| Compliance meta | Product Edit `complianceMetaMap` (UI approval state) |

---

## Readiness panel

| Field | Component | Source table | Source column | Fallback |
|-------|-----------|--------------|---------------|----------|
| Score X/Y | `ProductReadinessPanel` | computed | `evaluateProductReadiness` | — |
| Dimension badges | same | computed | 8 `READINESS_DIMENSIONS` | — |
| Blockers | same | computed | per-dimension eval | — |
| Media dimension | `evalMedia` | `product_media`, `products` | merged assets | hero-only if no rows |
| Pricing dimension | `evalPricing` | `product_pricing_rules` | `approval_status` | empty if not wired |
| Packaging dimension | `evalPackaging` | `products` | via `packagingHierarchyFromForm` | **no defaults** |
| Compliance | `evalCompliance` | `products` + UI meta | `hsn_code`, `gst_rate` | — |

---

## Packaging panel

| Field | Component | Source | Fallback |
|-------|-----------|--------|----------|
| Product MOQ | `PackagingHierarchyPanel` | `products.moq_value`, `moq_uom` | **Not configured** |
| MOQ increment | same | `products.increment_value`, `increment_uom` | **Not configured** |
| Trays / master carton | same | `products.master_carton_qty` | **Not configured** (was hardcoded 8) |
| Pieces per kg | same | `products.pcs_per_kg` / form `pieces_per_kg` | **Not configured** |
| Grams per piece | same | `products.grams_per_piece` / form weight | **Not configured** |
| Kg per tray | same | `products.kg_per_tray` (if set) | **Not configured** |

**Fix:** MOQ (9 trays) and master carton qty are **distinct fields**. Product Truth now shows both separately.

---

## UOM panel

| Field | Source | Fallback |
|-------|--------|----------|
| Primary / retail / B2B UOM | `products.primary_uom`, `retail_uom`, `b2b_uom` | — |
| Pieces per kg | `packagingHierarchyFromForm` | **Not configured** |
| Kg per tray | same | **Not configured** |

---

## Channels panel

| Field | Source table | Source column | Fallback |
|-------|--------------|---------------|----------|
| Ladder channels | `product_pricing_rules` + `pricingLadder.ts` | `price_channel`, `calculated_price`, `base_price`, `uom` | Derived per ladder |
| Manual price | `product_pricing_rules` | `calculated_price` / `base_price` | — |
| Effective price | computed | `computePricingLadder()` | inherited/derived |
| Source label | computed | manual / derived / inherited / missing | — |
| B2B required | computed | manual B2B only | blocks if missing |
| MOQ / increment | `product_moq_rules` | `moq_value`, `moq_uom`, etc. | — |
| Unit conversion | `priceUnitConversion.ts` | uses `grams_per_piece` / `pcs_per_kg` | Conversion unavailable |

**Pricing ladder:** `src/features/productTruth/pricingLadder.ts`  
Retail←MRP, Bulk←MRP−20%, Wholesale←MRP−30%, HoReCa←Wholesale, B2B manual required, Export/Franchisee/Own Outlet/Special←B2B.

---

## Media panel

| Field | Source | Fallback |
|-------|--------|----------|
| Profile slots | `readinessProfiles.ts` | profile-detected from category |
| Asset URLs | `product_media.file_url` + hero | merge in `mediaAssetsFromSources` |
| Slot status | `product_media.status` | `draft pending approval` for `raw` |

---

## Preview panel

| Field | Source | Fallback |
|-------|--------|----------|
| MOQ validation | `product_moq_rules` (via props) | channel rule missing message |
| Packaging conversions | `packagingHierarchyFromForm` | null conversion if incomplete |

---

## Central Sync panel

| Field | Source | Fallback |
|-------|--------|----------|
| Snapshot JSON | `generateCatalogueSnapshot` | includes `productMediaRows` |
| Pricing / MOQ in snapshot | `product_pricing_rules`, `product_moq_rules` | via mappers |
| Media in snapshot | `mediaAssetsFromSources` | was form-only |

---

## Integration: ProductEdit → Product Truth

```ts
<ProductTruthAdminSection
  form={form}
  productMediaRows={productMediaRows}   // product_media
  prices={channelPrices}                // product_pricing_rules
  moqRules={channelMoqRules}            // product_moq_rules
/>
```

Loaded by `reloadProductAuthority(productId)` on product mount and after channel rule changes.
