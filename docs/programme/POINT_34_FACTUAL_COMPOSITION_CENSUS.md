# Point 34 — Ingredients / Allergens / Shelf-life / Storage Canonical Closure

**ASM:** AI Studio factual product composition fields  
**Mission Control authority:** Central #459 — Point 34  
**Starting SHA:** `6f8e164` (`main` after #147 Point 35 + #151 Point 33)  
**Reconciled head:** `cursor/point34-factual-composition-closure-c61e` (#197)  
**Boundary:** No Core migration; no shadow truth; Point 37 owns FSSAI label issuance  

## 1. Starting ancestry

| Item | Value |
| --- | --- |
| Base branch | `main` |
| Starting SHA | `6f8e16417dcef2323d833072d23a92a32b87a833` |
| Parent commits | `6f8e164` Point 35 (#147) · `cf0fd3c` Point 33 (#151) · `33f61f2` residual Point 27/29/30 (#140) |

## 2. Core authority reconciliation (#197 follow-up)

Mission Control correction: **Core already owns** `products.ingredients`, `products.allergen_warnings`, and `products.nutrition_facts`. The gap was **AI Studio stale generated types + save adapter omission**, not missing Core schema.

| Evidence | Location |
| --- | --- |
| Central draft approve SQL writes composition columns | `scripts/supabase/PR06C1_central_tag_alias_approve_mapping.sql` |
| DataCorrection reads composition from `products` | `src/pages/DataCorrection.tsx` |
| ProductEdit validation doc expects row columns | `docs/AI_STUDIO_AUTHENTICATED_PRODUCTEDIT_VALIDATION.md` |
| Import playbook maps CSV → products columns | `docs/CATEGORY1_FIRST_IMPORT_PLAYBOOK.md` |

### Reconciliation actions (this branch)

| Action | Module |
| --- | --- |
| Regenerated AI-side `products` types for composition columns | `src/integrations/supabase/types.ts` |
| Added Central compat allowlist entries | `src/features/productAuthority/liveProductsSchema.ts` |
| Wired governed persistence (`nutritional_info` → `nutrition_facts`) | `productFactualCompositionCanonical.ts` → `productSchemaAdapter.ts` |
| Approval-gated save via existing compliance meta | `compliancePersistence.ts`, `stripUnapprovedComplianceFields` (all persisted factual fields) |
| Canonical shelf-life validation before live save | `factualCompositionSaveValidation` → ProductEdit form guard + `productEditDirectProductsRow` pre-write gate |
| Approval-aware label readiness for composition + shelf/storage | `labelReadiness.ts` + ProductEdit `complianceMetaMap` |
| Shelf-life reload string normalization | `factualCompositionFromDbRow` |
| Removed false `core_blocked` / Core prerequisite claims | census, `labelReadiness.ts`, canonical registry |

**No Core prerequisite returned** — composition text columns are proven on live Central `products`.

## 3. Field census matrix

| Field | UI | AI / parser | Defaults | Persistence | Approval | Publication |
| --- | --- | --- | --- | --- | --- | --- |
| `shelf_life_days` | ProductEdit, Fast Create, Products, DataCorrection | Governed AI extraction | Category rule (deferred meta) | `products.shelf_life_days` | `category_rule` / `ai_suggestion` meta | Snapshot `factual_composition` |
| `frozen_shelf_life_days` / `post_processing_shelf_life_days` | ProductEdit | — | None | `products` row | Manual | Snapshot |
| `storage_instructions` | ProductEdit, Fast Create, import | AI (suggestion-only) | Category rule (deferred) | `products.storage_instructions` | Meta gate | Catalogue AI facts-only |
| `temperature_requirement` / `thawing_instruction` | ProductEdit | — | None | `products` row | Manual | Snapshot |
| `ingredients` | ProductEdit, import, snapshot | AI edge fn | **Never invented** from category/name | `products.ingredients` | Compliance approval gate | Snapshot gated until approved |
| `allergen_warnings` | ProductEdit, import | AI | **Never invented** | `products.allergen_warnings` | Compliance approval gate | Snapshot gated until approved |
| `nutritional_info` (UI) / `nutrition_facts` (DB) | ProductEdit, AI panel | AI | Heuristic AI drafts (suggestion-only) | `products.nutrition_facts` | Compliance approval gate | `nutritional_info` canonical on read |
| `pdf_shelf_life` / `pdf_storage_condition` | PDF import | — | PDF extraction | `pdf_import_only` | — | — |
| `product_ingredients` + `nutrition_panels` | `/ingredients`, Label Studio | — | — | Optional structured paths (not Point 34 text closure) | — | — |

## 4. Defects identified and resolution

| Defect | Resolution |
| --- | --- |
| Fast Create invented ingredients/allergens | **Fixed** — removed |
| Draft placeholder invention | **Fixed** — null when absent |
| `nutritional_info` vs `nutrition_facts` conflict | **Fixed** — canonical read + DB write mapping |
| Category shelf-life/storage auto-persisted | **Fixed** — `category_rule` deferred meta |
| Composition columns dropped on save (stale types) | **Fixed** — types + adapter wiring |
| False Core schema-gap prerequisite | **Removed** — reconciled against Core authority |

## 5. Canonical contract

| Module | Responsibility |
| --- | --- |
| `productFactualCompositionCanonical.ts` | Registry, validation, adapter helpers, `point34_v1` snapshot |
| `productSchemaAdapter.ts` | Delegates all factual fields to canonical payload builder |
| `compliancePersistence.ts` | All composition fields in approval-gated persisted set |
| `fastCreateSuggestions.ts` | No invention; deferred category meta for shelf/storage |

### Write mapping

| UI form key | DB column | Notes |
| --- | --- | --- |
| `ingredients` | `products.ingredients` | Approval-gated |
| `allergen_warnings` | `products.allergen_warnings` | Approval-gated |
| `nutritional_info` | `products.nutrition_facts` | Central compat column name |
| `shelf_life_days` | `products.shelf_life_days` | Integer days |
| `storage_instructions` | `products.storage_instructions` | Text |

## 6. Optional structured paths (not blockers)

- `ingredients` master + `product_ingredients` junction (structured rollup)
- `nutrition_panels` per `product_id` (macro nutrients — separate from free-text)

## 7. Test matrix

| Check | Expected |
| --- | --- |
| Editor save→reload certification | `productFactualCompositionRoundTrip.test.ts` + `productEditFactualCompositionPersistence.test.ts` |
| Approval-aware composition readiness | `labelReadiness.test.ts` — per-field AI/category warn regressions incl. shelf/storage |
| Snapshot approval gating | `catalogueSnapshot.test.ts` — pending vs approved factual_composition |
| Point 34 canonical unit tests | `productFactualCompositionCanonical.test.ts` |
| `npm test` | **975/975 PASS** (rebased on #200 main `512f529`, head `TBD`) |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npm run check:boundaries` | PASS |
| `QUALITY_BASE_REF=main npm run lint:biome:changed` | PASS |

## 8. Gate state

`PR merged != Point 34 cleared` — live runtime smoke remains a programme gate. **Editor save→reload certified synthetically.** No open Core schema prerequisite for composition text columns.
