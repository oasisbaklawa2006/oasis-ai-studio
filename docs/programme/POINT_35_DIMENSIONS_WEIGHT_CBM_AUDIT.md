# Point 35 — Dimensions / Weight / CBM Audit

**Issue:** #146  
**Baseline:** `main` @ `cdf9014` (2026-09-05)  
**Classification:** **PARTIAL COMPLETE** — live-safe fields wired; Core schema required for export/shipping columns

## Live authority census matrix

| Field / unit | Canonical storage authority | Current UI surface | Write path | Read / publication path | Validation | Missing delta | Derived vs stored |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `dimension_l_cm`, `dimension_w_cm`, `dimension_h_cm` (cm) | Core `products` (Studio migration `20260506093648`) | ProductEdit **Dimensions** tab (conditional: `packaging_decoration_material` or `fixed_carton_required`) | `formToDbProductPayload` → live allowlist | ProductEdit load via `dbRowToProductForm`; Catalogue Studio `PRODUCT_SELECT` (this PR) | Numeric only; no range gate | None for live write | **Stored** |
| `product_dimensions_cm` (text) | Core `products` | Not direct — derived on save | `resolveDimensionsCmText()` → `product_dimensions_cm` on save | Read via `product_dimensions_cm` / legacy `dimensions` | None | None for live write | **Derived** from L×W×H when text absent |
| `net_weight_g`, `gross_weight_g` (grams) | Core `products` | ProductEdit **Compliance → Pack & shelf** | `formToDbProductPayload` | ProductEdit load; Category1 import; catalogue readiness pack-size check | Numeric parse only | None for live write | **Stored** |
| `grams_per_piece` / `pcs_per_kg` (piece weight) | Core `products` (Central compat) | ProductEdit **UOM** tab (`approximate_piece_weight_g`) | Mapped from UI field; Studio keys stripped | `dbRowToProductForm` reads Central compat columns | Derived `pcs_per_kg` when omitted | None | **Derived** `pcs_per_kg` from grams; **stored** on live |
| `carton_dimensions_cm` (text) | Studio migration `20260506164807` — **absent on live production** | None (Fast Create defers to Full Editor; no field exists) | **Blocked** — `LIVE_PRODUCTS_STUDIO_ONLY_COLUMNS` | Catalogue readiness previously checked only this field; now also accepts structured dims | N/A until Core migration | **Core:** add column to shared `products` + regenerate types | **Stored** (when schema exists) |
| `cbm` (m³) | Studio migration `20260506164807` — **absent on live production** | ProductEdit **read-only preview** from L×W×H (this PR) | **Blocked** until Core migration | Not in `ApprovedCatalogueProductSnapshot` (Point 33 connector) | `deriveCbmFromCm()` returns null if any dimension missing | **Core:** add `cbm numeric` column; optional trigger vs app derivation policy | **Derived** `(L×W×H)/1e6` — never fabricated |
| `gross_weight_kg` (kg) | Studio migration `20260506164807` — **absent on live production** | None — UI uses grams only | **Blocked** | N/A | N/A | **Core:** add column OR document grams as sole canonical unit | **Stored** (when schema exists) |
| `carton_qty`, `master_carton_qty`, `pcs_per_carton` | Core `products` | ProductEdit **UOM** tab | `formToDbProductPayload` | Catalogue Studio select; readiness carton qty check | Numeric | None | **Stored** |
| `master_carton_weight_kg` | Snapshot JSON only (`snapshotGenerator`) | **No ProductEdit field** | Not on `products` row | Catalogue snapshot `fulfillment_transform` | N/A | UI + persistence contract TBD with Core | Snapshot-only today |

## Historical PR census

No prior Point-35-specific PR merged. Related but **out of scope** per #146:

- #135 Point 29 — barcode/OCR/Fast Create intake
- #138 Point 30 — governed AI extraction
- #143 Point 41 — media routes
- #140 — held deep-link/draftTableMap

Partial dimension/weight work exists across product-authority recovery PRs (#74–#75) but did not close carton/CBM/export schema gaps.

## Core contract required (stop before shadow authority)

Apply on shared Central `products` (Core migration ownership):

```sql
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS carton_dimensions_cm text,
  ADD COLUMN IF NOT EXISTS cbm numeric,
  ADD COLUMN IF NOT EXISTS gross_weight_kg numeric;
```

Post-migration:

1. Regenerate `src/integrations/supabase/types.ts`
2. Remove `carton_dimensions_cm`, `cbm`, `gross_weight_kg` from `LIVE_PRODUCTS_STUDIO_ONLY_COLUMNS`
3. Enable `formToDbProductPayload` CBM persist (derivation already implemented)
4. Add carton-dimension inputs (separate from product L/W/H) in ProductEdit Dimensions tab
5. Extend `ApprovedCatalogueProductSnapshot` + Central connector 25B/25C if Buyer publication requires CBM

## AI Studio delta delivered (this PR)

| Change | Owner |
| --- | --- |
| `shippingDimensions.ts` — deterministic CBM + dimension text helpers | AI Studio |
| Live schema guard for `carton_dimensions_cm`, `cbm`, `gross_weight_kg` | AI Studio |
| Adapter tests for dimension/weight mapping + blocked columns | AI Studio |
| ProductEdit read-only derived CBM preview | AI Studio |
| Catalogue readiness accepts structured dims when `carton_dimensions_cm` absent | AI Studio |
| Catalogue Studio select includes `dimension_*_cm`, `product_dimensions_cm` | AI Studio |

## Gate matrix (pre-merge)

| Gate | Status |
| --- | --- |
| Live audit complete | **PASS** |
| Core schema blocker documented | **PASS** |
| No overlap with #135/#138/#143/#140 | **PASS** |
| Unit tests | Pending CI |
| Production mutation | **NONE** |
