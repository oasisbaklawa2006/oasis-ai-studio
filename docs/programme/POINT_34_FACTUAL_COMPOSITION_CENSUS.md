# Point 34 — Ingredients / Allergens / Shelf-life / Storage Canonical Closure

**ASM:** AI Studio factual product composition fields  
**Mission Control authority:** Central #459 — Point 34  
**Starting SHA:** `6f8e164` (`main` after #147 Point 35 + #151 Point 33)  
**Boundary:** No Core migration; no shadow truth; Point 37 owns FSSAI label issuance  

## 1. Starting ancestry

| Item | Value |
| --- | --- |
| Base branch | `main` |
| Starting SHA | `6f8e16417dcef2323d833072d23a92a32b87a833` |
| Parent commits | `6f8e164` Point 35 (#147) · `cf0fd3c` Point 33 (#151) · `33f61f2` residual Point 27/29/30 (#140) |

## 2. Field census matrix

| Field | UI surfaces | Parser / AI | Default source | Draft / persistence | Approval | Publication | ProductEdit tab |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `shelf_life_days` | ProductEdit, Fast Create, Products list, DataCorrection, Catalogue Studio | `governedComplianceAiExtraction`, `complianceSuggestions` | **Category rule** (`categoryDefaults`) — deferred meta | **products row** via `formToDbProductPayload` | `category_rule` / `ai_suggestion` meta gate | Snapshot `factual_composition` + `storage_shelf_life_copy` when set | Compliance → Pack & shelf |
| `frozen_shelf_life_days` | ProductEdit (frozen tab) | — | None | **products row** | Manual | Snapshot `point34_v1` | Compliance (frozen fields) |
| `post_processing_shelf_life_days` | ProductEdit | — | None | **products row** | Manual | Snapshot `point34_v1` | Compliance |
| `storage_instructions` | ProductEdit, Fast Create, category import | AI extraction (suggestion-only) | **Category rule** — deferred meta | **products row** | `category_rule` / `ai_suggestion` meta gate | Catalogue AI gateway reads facts only; snapshot | Compliance |
| `temperature_requirement` | ProductEdit | — | None | **products row** | Manual | Snapshot | Compliance |
| `thawing_instruction` | ProductEdit | — | None | **products row** | Manual | Snapshot | Compliance |
| `ingredients` | ProductEdit textarea, Fast Create (removed), Category1 import, snapshot | AI extraction, `generate-product-attributes` edge fn | **Was invented** in `fastCreateSuggestions` — **removed** | **core_blocked** — not on Studio `products` Insert types | UI-only; never in live products write | Gated null in snapshot until approved + Core column | Compliance |
| `allergen_warnings` | ProductEdit, Fast Create (removed), import | AI extraction | **Was invented** in heuristics + draft placeholders — **removed** | **core_blocked** | UI-only | Gated null in snapshot | Compliance |
| `nutritional_info` / `nutrition_facts` | ProductEdit, AI panel | AI extraction; Central uses `nutrition_facts` alias | Heuristic AI drafts (suggestion-only) | **core_blocked** — `nutrition_panels` table exists unwired | UI-only; conflict resolved to `nutritional_info` on read | Gated null in snapshot | Compliance |
| `pdf_shelf_life` / `pdf_storage_condition` | PDF import path only | — | PDF extraction | **pdf_import_only** — not in editor allowlist | — | — | — |
| `ingredients` + `product_ingredients` tables | `/ingredients` page (partial) | — | — | **structured_table** — not wired to ProductEdit save | — | — | Separate route |

## 3. Defects identified (pre-closure)

| Defect | Severity | Resolution |
| --- | --- | --- |
| Fast Create invented ingredients/allergens from category/name | **P0** | Removed; labelStarter hints empty |
| Contributor draft used `"Suggested — please review"` / `"Draft placeholder only"` | **P0** | `factualCompositionDraftPayload` — null when absent |
| `nutritional_info` vs `nutrition_facts` dual keys | **P1** | `normalizeNutritionText` — `nutritional_info` canonical |
| Category shelf-life/storage auto-persisted without approval | **P1** | `category_rule` compliance meta + save gate |
| Ingredients/allergens in snapshot before approval | **P1** | Snapshot compliance gated on `complianceApproved` |
| Label readiness scored phantom persisted ingredients | **P2** | `dataGaps` only; Point 34 canonical references |

## 4. Canonical contract (this PR)

| Module | Responsibility |
| --- | --- |
| `src/features/productTruth/productFactualCompositionCanonical.ts` | Field registry, validation, adapter helpers, snapshot `point34_v1` |
| `src/features/productAuthority/productSchemaAdapter.ts` | Delegates shelf/storage to canonical `factualCompositionToDbPayload` |
| `src/shared/ai/complianceApproval.ts` | `category_rule` source + deferred meta |
| `src/features/fastCreate/fastCreateSuggestions.ts` | No invented composition; deferred category meta |

### Persisted (products row — AI Studio write contract)

- `shelf_life_days` (days, integer > 0)
- `frozen_shelf_life_days`, `post_processing_shelf_life_days`
- `storage_instructions`, `temperature_requirement`, `thawing_instruction`

### Core-blocked (exact prerequisite — do not shadow-persist)

```
products.ingredients
products.allergen_warnings
products.nutrition_facts OR products.nutritional_info
ingredients + product_ingredients junction (structured path)
nutrition_panels per product_id
```

## 5. Test matrix

| Check | Command | Expected |
| --- | --- | --- |
| Point 34 unit tests | `npm test -- productFactualCompositionCanonical` | PASS |
| Fast Create no-invention | `npm test -- fastCreate.test` | PASS |
| Snapshot point34_v1 | `npm test -- catalogueSnapshot.test` | PASS |
| Full unit suite | `npm test` | PASS |
| Typecheck | `npm run typecheck` | PASS |
| Build | `npm run build` | PASS |

## 6. Gate state

`PR merged != Point 34 cleared` — runtime editor round-trip and Core column prerequisite remain programme gates.
