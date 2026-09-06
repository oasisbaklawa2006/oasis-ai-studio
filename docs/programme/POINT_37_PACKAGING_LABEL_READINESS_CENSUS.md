# Point 37 — Packaging / Label-Readiness Canonical Closure

**ASM:** AI Studio Product Master representation and governed editing  
**Mission Control authority:** Central #459 — Point 37 = packaging / label-readiness fields  
**Starting SHA:** `6f8e164` (`POINT35` merged on `main`)  
**Boundary:** No Core migration; FSSAI/legal columns remain Core-blocked  

## Live authority census matrix

| Field / concept | Canonical storage / module | Shadow / legacy | Canonical winner | AI Studio status |
| --- | --- | --- | --- | --- |
| Packaging type / form | `products.packaging_code` + active `sku_code_rules` taxonomy | `pack_size`, `primary_pack_type`, `pack_label`, PDF pack strings | `evaluatePackagingReadiness()` in `catalogueReadyGate.ts` | **Closure** — fail-closed on shadow-only |
| Sellable pack label | Point 33 `sellable_pack` node (`pcs_per_pack`, `pack_size`+`net_weight_g`) | Free-text `pack_label` snapshot-only | `buildCanonicalPackagingHierarchy()` | **Closure** |
| Inner / case carton label | Point 33 `case_carton` node (`carton_qty`, `pcs_per_carton`) | Secondary pack codes (666/888) unmapped in master | Point 33 hierarchy validation | **Closure** when carton MOQ applies |
| Master carton label | Point 33 `master_carton` node | `master_carton_weight_kg` snapshot-only | Point 33 hierarchy validation | **Closure** when declared |
| Legal / FSSAI / metrology | `labelReadiness.ts` data gaps | `labels.fssai_license` (Trace/label row — wrong PIM owner) | `computeLabelReadiness()` + gap severities | **Fail-closed Draft** until Core columns |
| Artwork / label assets | Media slots (`label_front_image`, `label_back_image`, `packaging_reference`) | `products.label_status` workflow flag (separate) | `evaluateArtworkLabelAssets()` | **Closure** for export; optional retail |
| Barcode / EAN linkage | `products.barcode_sku` (Core claim-governed write) | `labels.barcode` (Trace print row) | `evaluateBarcodeLinkage()` + `normalizeBarcodeInput()` | **Closure** — export required |
| Catalogue publication | `catalogueReadyGate` (unchanged for Point 37) | Product Truth `packaging_status` | Separate toggles preserved | **Not merged** |

## Duplicate / shadow field resolution

| Concept | Duplicates | Winner |
| --- | --- | --- |
| Packaging type | `packaging_code` vs `pack_size` / `primary_pack_type` / `pack_label` | **`packaging_code`** (active taxonomy) |
| Pack declaration | `pcs_per_pack` vs `qty_per_pack` vs weight-only `net_weight_g` | **`pcs_per_pack`** or paired `pack_size`+`net_weight_g` via Point 33 |
| Carton qty | `carton_qty` vs derived `pcs_per_carton/pcs_per_pack` | **`carton_qty`** with hierarchy cross-check (Point 33) |
| Barcode | `barcode_sku` vs `labels.barcode` | **`barcode_sku`** for product authority; labels table = Trace Point 95 |
| Label compliance | ProductEdit textareas vs `labels` row vs `nutrition_panels` | **`labelReadiness` gaps** until Core label-compliance bundle ships |
| Readiness toggles | Catalogue-ready vs label-ready vs `label_status` | **Separate** — never merged (see `labelReadiness.ts` docblock) |

## Smallest genuine missing link (AI-owned)

Before this PR: packaging type gate (`evaluatePackagingReadiness`), legal label panel (`labelReadiness.ts`), and Point 33 hierarchy existed in separate modules with no unified fail-closed packaging/label-readiness evaluator or snapshot block.

**Closure:** `packagingLabelReadinessCanonical.ts` + `point37_v1` snapshot section + ProductEdit panel wiring.

## Core dependency (exact — ONE bounded prerequisite)

Product-level FSSAI / legal label fields cannot be persisted from AI Studio until **oasis-supabase-core** adds and owns:

- `products.fssai_licence_number` (or an equivalent normalized label-compliance column bundle)

No shadow table or local-only canonical truth was created. Trace label print execution remains Point 95 authority.

## Publication fail-closed behaviour

| Stale / invalid input | Outcome |
| --- | --- |
| `pack_size` / `primary_pack_type` without taxonomy `packaging_code` | **Blocked** — shadow-only |
| Inactive / SKU-mismatched `packaging_code` | **Blocked** |
| Customer-facing product missing sellable pack qty/type | **Blocked** |
| Carton MOQ / `fixed_carton_required` without carton qty | **Blocked** |
| Export sale type without approved label artwork slots | **Blocked** |
| Export without valid `barcode_sku` | **Blocked** |
| Any `labelReadiness` `no_column` / `not_persisted` gap | **Blocked** — `ready_for_label_design: false` |

## Files touched

| File | Change |
| --- | --- |
| `src/features/productAuthority/packagingLabelReadinessCanonical.ts` | **NEW** — census, validation, snapshot serializer |
| `src/features/productAuthority/packagingLabelReadinessCanonical.test.ts` | **NEW** — focused tests |
| `src/features/catalogueSnapshot/snapshotGenerator.ts` | `packaging_label_readiness` `point37_v1` |
| `src/features/catalogueSnapshot/types.ts` | Typed snapshot block |
| `src/components/LabelReadinessPanel.tsx` | Point 37 hierarchy + artwork + barcode display |
| `src/pages/ProductEdit.tsx` | Wire canonical evaluator to Compliance tab |

## Downstream points unaffected

| Point | Impact |
| --- | --- |
| **35** | Dimensions/CBM/grams semantics preserved — referenced only |
| **36** | MOQ/lead-time publication blockers unchanged |
| **38** | Product workflow not absorbed |
| **41–47** | Media workspace authority unchanged — artwork read-only here |
| **95** | Trace label print pipeline not implemented |

## Test matrix (head)

| Check | Command |
| --- | --- |
| Point 37 focused | `npx vitest run src/features/productAuthority/packagingLabelReadinessCanonical.test.ts` |
| Typecheck | `npm run typecheck` |
| Unit tests | `npm test` |
| Build | `npm run build` |
| Boundaries | `npm run check:boundaries` |
