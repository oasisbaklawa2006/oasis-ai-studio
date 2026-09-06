# Point 32 — Product / Variant Hierarchy Canonical Closure

**ASM:** AI Studio Product Master representation and governed editing  
**Mission Control authority:** Central #459 — Point 32 = product / variant hierarchy  
**Starting SHA / ancestry:** `4ce1ca053ed336935bc52a49a9267d6a86980078` (Point 31 PR #191 head)  
**Parent branch:** `cursor/point31-full-editor-architecture-861e`  
**Boundary:** No Core migration; no shadow schema; no production mutation  

## Authority / gap matrix

| Layer | Canonical object | Persistence | AI Studio status | Core dependency |
| --- | --- | --- | --- | --- |
| Sellable SKU | `products.id`, `products.sku`, `product_name` | `products` row | **WORKS** — Full Editor identity tab | None |
| SKU identity segment | `packaging_code` (5th OAS SKU segment) | `products` row | **WORKS** — `SkuBuilder` + `skuGuard` | None |
| Basis product / variant parent | `basis_product_id`, `basis_sku` | **Missing on `products`** | **CORE BLOCKED** | Core variant parent ref |
| Variant options | `product_variants` (flavour/size/pack format) | **No table** | **CORE BLOCKED** — preview-only in snapshot | Core `product_variants` table |
| Composition parent/child | `product_bom_items`, `hampers` | Existing tables | **COMPOSITION ONLY** — not variant parentage | None (semantics fixed) |
| Pack / carton hierarchy | Point 33 `packaging_hierarchy` | `products` row + form | **Point 33 authority** — pass-through refs only | Point 33 (not duplicated) |
| Runtime family collapse | `logicalGroupKey`, `packVariantIndicator` | Resolver-only | **NON-AUTHORITATIVE** — must not substitute variant graph | Point 28 duplicate detection separate |

## Census — product / variant surfaces

### Core types (`src/integrations/supabase/types.ts`)

| Surface | Fields | Variant semantics |
| --- | --- | --- |
| `products` | `id`, `sku`, `product_name`, `packaging_code`, `pack_size`, `product_class`, `product_type` | One row = one sellable SKU; **no** `parent_product_id`, `basis_sku`, or `variant_id` |
| `product_aliases` | `product_id`, `alias`, `alias_type` | Per SKU row; orphan merge by `canonical_name` is a known collision risk |
| `product_bom_items` | `parent_product_id`, `child_product_id` | BOM composition — **not** variant parentage |
| `hampers` / `hamper_items` | `parent_product_id`, `child_product_id` | Hamper assembly — **not** variant parentage |
| `product_variants` | — | **Absent** from Studio schema |

### AI Studio editor (Point 31 shell → Point 32 identity tab)

| Route / path | Behaviour |
| --- | --- |
| `/products/new` | Create — self-rooted SKU row |
| `/products/:id` | Edit — identity tab owned by Point 32 |
| `/products/new?duplicateFrom=<id>` | Clone — clears `id`/`sku`; **no** “create variant from basis” path |
| `/products/:id/aliases` | Redirect → identity `#product-language-terms` |

| Identity field | Form key | DB column | Notes |
| --- | --- | --- | --- |
| Product name | `product_name` | `product_name` | Canonical display |
| SKU | `sku`, `packaging_code` | same | Structured OAS identity |
| Ghost taxonomy | `product_family` | saved as `product_type` | No DB column — inference risk |
| Sale type | `sale_type` (session) | — | Overlaps `product_class`; no DB column |

### Duplicate / inferred models (problems catalogued, not absorbed)

| Problem | Location | Risk |
| --- | --- | --- |
| P1 No canonical variant table | Schema | Pack/format = separate product rows |
| P3 `product_family` ghost field | `ProductEdit` form | Round-trip via `product_type` |
| P4 `packaging_code` triple duty | SKU builder, list filter, resolver | Conflates identity + grouping |
| P6 Legacy alias orphan merge | `AliasManager` | Wrong product attachment on name collision |
| P8 Runtime family collapse | `candidateGrouping.ts` | Hides distinct SKUs in resolver |
| P9 `WhatsAppKnowledgeSku.variant` mislabel | `knowledgeBundle.ts` | Named like hierarchy; stores `short_name` only |
| P10 BOM parent refs | `BomBuilder` | Must not be reused as variant parentage |
| P12 Pack bucket named “variant” | `packVariantIndicator` comment | Runtime only; not Point 32 authority |

## Retained canonical objects (no parallel tables)

- `buildCanonicalProductVariantHierarchy` — Point 32 closure tree (`productVariantHierarchyCanonical.ts`)
- `resolveVariantGraph` — explicit-edge cycle / duplicate-key / ambiguous-base detection
- `validateVariantHierarchyMutation` — fail closed until Core ships
- `resolveEditorVariantBinding` — Point 31 identity tab binding
- `serializeProductVariantHierarchyForSnapshot` — `catalogue_versions.snapshot_json.product_variant_hierarchy` schema `point32_v1`
- `ProductVariantHierarchyPanel` — identity tab operator surface
- `assertVariantHierarchySaveAllowed` — Full Editor save guard

## As-built vs closure target

| Closure chain | As-built on Point 31 @ `4ce1ca0` | This PR |
| --- | --- | --- |
| Basis product → sellable SKU | One `products` row per SKU | Canonical self-rooted node + `product_sku` scope |
| Variant options (flavour/size/pack) | Separate product rows per `packaging_code` | `core_blocked` node + dependency list |
| Explicit parent/child graph | Not persisted | `resolveVariantGraph` + mutation guard |
| Pack vs variant separation | Blurred in resolver comments | `assertPackNotVariantHierarchy` + Point 33 pass-through |
| Editor binding | Point 31 ownership map only | Panel + save guard on identity tab |
| Knowledge `variant` field | `short_name` mislabel | `short_name_ref` added; `variant` deprecated |

## Core dependency (exact)

Variant parentage cannot be written from AI Studio until **oasis-supabase-core** adds and owns:

- `product_variants` table (`id`, `product_id`, `variant_key`, `basis_sku`, `sku`, uniqueness per basis product)
- `products.basis_product_id` or `products.parent_product_id` for **variant** parentage (distinct from BOM/hamper `parent_product_id` semantics)
- Deterministic `variant_key` uniqueness constraint per basis product

No shadow table or local-only canonical truth was created. Composition refs (`product_bom_items`, `hampers`) remain composition-only.

## Downstream points affected

| Point | Impact |
| --- | --- |
| **31** | Identity tab wired to Point 32 binding contract |
| **33** | Pack hierarchy remains SKU-scoped; `packaging_code` role documented as identity segment |
| **28** | Duplicate detection unchanged; runtime family collapse explicitly non-authoritative |
| **37** | Central sync snapshot now carries `point32_v1` variant hierarchy block |

## Files touched

| File | Change |
| --- | --- |
| `src/features/productAuthority/productVariantHierarchyCanonical.ts` | **NEW** — census, validation, snapshot serializer, save guard |
| `src/features/productAuthority/productVariantHierarchyCanonical.test.ts` | **NEW** — 12 focused tests |
| `src/features/productAuthority/panels/ProductVariantHierarchyPanel.tsx` | **NEW** — identity tab panel |
| `src/pages/ProductEdit.tsx` | Panel + save guard |
| `src/features/catalogueSnapshot/snapshotGenerator.ts` | `point32_v1` product_variant_hierarchy |
| `src/features/catalogueSnapshot/types.ts` | Typed snapshot variant block |
| `src/features/productTruth/productReadiness.ts` | Variant hierarchy validation input |
| `src/features/productTruth/types.ts` | `variantHierarchyValidation` on `ProductTruthInput` |
| `src/features/productIntelligence/knowledge/knowledgeBundle.ts` | `short_name_ref`; deprecate `variant` mislabel |
| `src/features/productAuthority/fullEditorArchitecture.test.ts` | Point 32 identity owner assertion |

## Test matrix

| Check | Command |
| --- | --- |
| Typecheck | `npm run typecheck` |
| Unit tests | `npm test` |
| Build | `npm run build` |
| Boundaries | `npm run check:boundaries` |

**Gate:** `PR MERGED != Point 32 cleared` until runtime editor/catalogue evidence is certified post-#191 merge.
