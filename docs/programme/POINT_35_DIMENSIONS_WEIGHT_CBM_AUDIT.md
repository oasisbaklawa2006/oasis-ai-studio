# Point 35 — Dimensions / Weight / CBM Audit

**Issue:** #146 · **PR:** #147  
**Baseline:** `main` @ `cf0fd3c` (includes #140 + #149 + #151)  
**Core authority:** oasis-supabase-core #199 · `carton_dimensions_cm` + `cbm` live on shared `products`  
**Classification:** **LIVE RECERTIFIED** for `carton_dimensions_cm` + `cbm`; `gross_weight_kg` remains UI-blocked

## Live authority census matrix

| Field / unit | Canonical storage | UI | Write path | Read/publication | Validation | Delta | Derived vs stored |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `dimension_l/w/h_cm` | Core `products` | ProductEdit Dimensions tab | `formToDbProductPayload` | ProductEdit + Catalogue Studio select | Numeric parse | **None** | Stored |
| `product_dimensions_cm` | Core `products` | Derived on save | `resolveProductDimensionsCmText()` | DB + readiness | Positive numeric sides when derived | **None** | Derived from available L×W×H values (partial OK; CBM needs all three) |
| `carton_dimensions_cm` | Core `products` (live) | Text or derived when `fixed_carton_required` | Adapter persist | Catalogue Studio select + readiness | Text / structured | **None** | Stored (explicit or derived) |
| `cbm` (m³) | Core `products` (live) | ProductEdit derived preview | `deriveCbmFromCm()` on save | Catalogue Studio select | Null if incomplete | **None** | Derived — never fabricated |
| `net_weight_g`, `gross_weight_g` | Core `products` | Compliance → Pack & shelf | Adapter | Import + readiness | Numeric parse | **None** | Stored |
| `grams_per_piece` / `pcs_per_kg` | Core compat columns | UOM tab | Mapped from UI field | `dbRowToProductForm` | pcs/kg derived | **None** | Derived pcs/kg |
| `gross_weight_kg` | Core column; **UI blocked** | None — grams canonical | **Blocked** — `LIVE_PRODUCTS_STUDIO_ONLY_COLUMNS` | N/A | N/A | UI contract TBD | Stored when enabled |

## Adapter contract evidence (no production mutation)

Unit tests in `productAuthority.test.ts` and `shippingDimensions.test.ts` prove:

- Structured L/W/H + weights map to live columns
- `cbm` persists when all three dimensions are positive (`(L×W×H)/1e6`)
- `carton_dimensions_cm` persists separately — never copied into `product_dimensions_cm`
- Edit-path recomputation when structured dimensions change (stale hydrated text/CBM ignored)
- CBM clears when a structured dimension is removed (stale hydrated `form.cbm` not retained)
- CBM is **not** fabricated when dimensions incomplete
- `gross_weight_kg` stripped by `sanitizeLiveProductsPayload` (grams-only UI preserved)

## Remaining programme delta

`gross_weight_kg` column exists on Core schema but AI Studio keeps grams as the operator-facing unit.

Central snapshot connector (25B/25C) does not yet publish `cbm` / `carton_dimensions_cm` — out of Point35 scope.

## Gate matrix (pre-merge approval)

| Gate | Status |
| --- | --- |
| Rebased on current `main` @ `cf0fd3c` | **PASS** |
| Review findings remediated | **PASS** |
| `gross_weight_kg` semantics preserved (blocked) | **PASS** |
| Unit tests (local) | **PASS** (55/55 — Point35 + fast-create draft guard) |
| Exact-head CI | Pending push |
| Production mutation | **NONE** |
| Merge approval | **STOP** — prior approval stale; awaiting fresh collaborator review |
