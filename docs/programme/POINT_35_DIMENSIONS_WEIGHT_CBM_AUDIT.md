# Point 35 — Dimensions / Weight / CBM Audit

**Issue:** #146 · **PR:** #147  
**Baseline:** `main` @ `c010b26` (includes #149 runtime remediation)  
**Core authority:** oasis-supabase-core #199 merged · Production Migration Release #139 SUCCESS @ `882d6e5`  
**Classification:** **LIVE RECERTIFIED** for `carton_dimensions_cm` + `cbm`; `gross_weight_kg` remains Core-blocked in UI

## Live authority census matrix

| Field / unit | Canonical storage | UI | Write path | Read/publication | Validation | Delta | Derived vs stored |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `dimension_l/w/h_cm` | Core `products` | ProductEdit Dimensions tab | `formToDbProductPayload` | ProductEdit + Catalogue Studio select | Numeric parse | **None** | Stored |
| `product_dimensions_cm` | Core `products` | Derived on save | `resolveDimensionsCmText()` | DB + readiness | None | **None** | Derived from L×W×H |
| `carton_dimensions_cm` | Core `products` (**live post-#199**) | None dedicated; text or derived when `fixed_carton_required` | Adapter persist | Catalogue Studio select + readiness | Text / structured | **None** | Stored (explicit or derived) |
| `cbm` (m³) | Core `products` (**live post-#199**) | ProductEdit derived preview | `deriveCbmFromCm()` on save | Catalogue Studio select | Null if incomplete | **None** | Derived — never fabricated |
| `net_weight_g`, `gross_weight_g` | Core `products` | Compliance → Pack & shelf | Adapter | Import + readiness | Numeric parse | **None** | Stored |
| `grams_per_piece` / `pcs_per_kg` | Core compat columns | UOM tab | Mapped from UI field | `dbRowToProductForm` | pcs/kg derived | **None** | Derived pcs/kg |
| `gross_weight_kg` | Core column exists; **UI blocked** | None — grams canonical | **Blocked** — `LIVE_PRODUCTS_STUDIO_ONLY_COLUMNS` | N/A | N/A | UI contract TBD | Stored when enabled |

## Adapter contract evidence (no production mutation)

Unit tests in `productAuthority.test.ts` prove:

- Structured L/W/H + weights map to live columns
- `cbm` persists when all three dimensions are positive (`(L×W×H)/1e6`)
- `carton_dimensions_cm` persists from explicit text or `fixed_carton_required` + structured dims
- CBM is **not** fabricated when dimensions incomplete
- `gross_weight_kg` remains stripped on live save (grams-only UI semantics preserved)

## Remaining Core / programme delta

`gross_weight_kg` column is live on Core schema but AI Studio intentionally keeps grams as the operator-facing unit. No `gross_weight_kg` UI or write path until Mission Control assigns a unit policy.

Central snapshot connector (25B/25C) does not yet publish `cbm` / `carton_dimensions_cm` — out of Point35 scope.

## Gate matrix (pre-merge approval)

| Gate | Status |
| --- | --- |
| Rebased on current `main` (#149) | **PASS** |
| Obsolete `carton_dimensions_cm` / `cbm` guards removed | **PASS** |
| `gross_weight_kg` semantics preserved (blocked) | **PASS** |
| Unit tests | Pending CI |
| Production mutation | **NONE** |
| Merge approval | **STOP** — awaiting collaborator review |
