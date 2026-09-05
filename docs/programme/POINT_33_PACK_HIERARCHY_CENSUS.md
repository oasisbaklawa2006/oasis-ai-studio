# Point 33 — Pack / Carton / Pallet Hierarchy Canonical Closure

**ASM:** AI Studio Product Master representation and governed editing  
**Mission Control authority:** Central #459 — Point 33 = pack/carton/pallet hierarchy  
**Starting SHA:** `c010b26` (`POINT30: runtime certification remediation`)  
**Boundary:** No Core migration while Point 20 #201 is active  

## Authority / gap matrix

| Layer | Canonical object | Persistence | AI Studio status | Core dependency |
| --- | --- | --- | --- | --- |
| Product / SKU | `products.id`, `sku`, `product_name` | `products` row | **WORKS** — ProductEdit, Products list | None |
| Sellable pack | `pcs_per_pack`, `primary_pack_*` (form), `pack_size` | `pcs_per_pack` on row; pack type/uom form-only | **WORKS** — editor + `enrichPackFormFromDbRow` adapter | None for single-SKU scope |
| Case / inner carton | `carton_qty`, `carton_uom`, `pcs_per_carton` | `products` row | **WORKS** — UOM tab + pack logic | None |
| Master carton | `master_carton_qty`, `master_carton_uom` | `products` row | **WORKS** — UOM tab + snapshot | `master_carton_weight_kg` snapshot-only (not on row) |
| Pallet | `cartons_per_pallet`, pallet UOM | **Missing on `products`** | **CORE BLOCKED** — preview-only in snapshot | **Core:** pallet columns + RPC persistence |
| Variant isolation | per-variant pack hierarchy | **No `product_variants` table** | **SKU-scoped only** | Core variant schema |
| Dimensions / CBM | `dimension_*_cm`, `cbm`, `carton_dimensions_cm` | `products` row | **Point 35 authority** — pass-through refs only | Point 35 (not duplicated here) |

## Retained canonical objects (no parallel tables)

- `PackagingHierarchy` engine type (`src/features/productTruth/types.ts`)
- `packagingHierarchyFromForm` — flat field → engine mapping
- `buildCanonicalPackagingHierarchy` — Point 33 closure tree (`packagingHierarchyCanonical.ts`)
- `serializePackagingHierarchyForSnapshot` — `catalogue_versions.snapshot_json.packaging_hierarchy` schema `point33_v1`
- `uomPackagingEngine` — qty conversion (unchanged; no pallet UOM until Core ships)
- `packLogic` — guided operator answers → existing row fields
- `productSchemaAdapter.formToDbProductPayload` — governed write allowlist (unchanged)

## As-built vs closure target

| Closure chain | As-built on `main` @ `c010b26` | This PR |
| --- | --- | --- |
| product/variant → sellable pack | SKU-level only; pack via `pcs_per_pack` + form `primary_pack_*` | Canonical node + DB enrich adapter |
| sellable pack → case/carton | `carton_qty` / `pcs_per_carton` | Deterministic `packsPerCarton` + validation |
| case → master carton | `master_carton_qty/uom` | Chain node + snapshot `case_carton` section |
| master carton → pallet | **Not persisted** | `core_blocked` node + dependency list |
| Round-trip serialization | Partial (primary_pack form-only) | `point33_v1` snapshot + `persistedPackFieldsFromHierarchy` |
| Point 35 dimensions | Separate ProductEdit tab | `dimension_refs` pass-through only |

## Files touched

| File | Change |
| --- | --- |
| `src/features/productTruth/packagingHierarchyCanonical.ts` | **NEW** — census, validation, snapshot serializer |
| `src/features/productTruth/packagingHierarchyCanonical.test.ts` | **NEW** — 11 focused tests |
| `src/features/productTruth/panels/PackagingHierarchyPanel.tsx` | Hierarchy tree + Core gap banner |
| `src/features/catalogueSnapshot/snapshotGenerator.ts` | `point33_v1` packaging_hierarchy |
| `src/features/catalogueSnapshot/types.ts` | Typed snapshot packaging block |
| `src/features/productAuthority/productSchemaAdapter.ts` | `enrichPackFormFromDbRow` on load |

## Core dependency (exact)

Pallet layer cannot be written from AI Studio until **oasis-supabase-core** adds and owns:

- `products.cartons_per_pallet` (or equivalent normalized pallet child qty)
- `products.master_cartons_per_pallet`
- `products.pallet_uom`

No shadow table or local-only canonical truth was created. Point 20 #201 remains the schema authority gate.

## Downstream points affected

| Point | Impact |
| --- | --- |
| **36** | Channel MOQ/dispatch rules consume `PackagingHierarchy` engine — unchanged API |
| **37** | Central sync snapshot now carries full `point33_v1` hierarchy for preview |
| **54–56** | Export/fulfilment transforms can read `case_carton` + chain; pallet blocked until Core |

## Test matrix (pre-PR)

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | PASS |
| Unit tests | `npm test` | PASS — 820/820 (+ Point 33 + readiness) |
| Build | `npm run build` | PASS |
| Boundaries | `npm run check:boundaries` | PASS (0 violations) |
| Biome changed | `QUALITY_BASE_REF=c010b26 npm run lint:biome:changed` | PASS |
| Point 33 focused | `npx vitest run src/features/productTruth/packagingHierarchyCanonical.test.ts` | PASS — 11 tests |
