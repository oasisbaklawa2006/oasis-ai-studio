# Point 42 — Controlled Photography Families Canonical Closure

**ASM:** AI Studio Product Master media / photography authority  
**Mission Control authority:** Central #459 — Point 42 = controlled photography families  
**Starting SHA:** `6f8e16417dcef2323d833072d23a92a32b87a833` (current `main` @ Point 35 merge)  
**Boundary:** No image generation, no production mutation, no Bateel governance (Point 43), no camera/enhancement/QA/outputs (Points 44–47)

## Exact baseline census

| Surface | Path | Role |
| --- | --- | --- |
| Profile detection | `src/features/mediaReadiness/mediaProfileDetection.ts` | Heuristic `ProductMediaProfile` from category/class/type |
| Readiness profiles | `src/features/productTruth/readinessProfiles.ts` | Authoritative required/optional slots per profile |
| Uploader → readiness map | `readinessProfiles.ts` → `MEDIA_UPLOADER_TO_READINESS` | `product_media.type` → readiness slot |
| Governance modes | `src/features/mediaReadiness/mediaGovernanceMode.ts` | `testing` / `pilot` / `production` slot subsets |
| Readiness engine | `src/features/mediaReadiness/mediaReadinessEngine.ts` | Slot evaluation, approval gates, Central sync preview |
| Media authority | `src/features/mediaReadiness/mediaAuthorityContract.ts` | Row-derived status, hero sync, approved-only authority |
| Product media roles | `src/lib/productImage.ts` → `PRODUCT_MEDIA_ROLES` | Canonical uploader role constants |
| Media uploader UI | `src/components/ProductMediaUploader.tsx` | 14 upload types + governance-required slots |
| Catalogue media slots | `src/features/catalogueAiStudio/catalogueMediaSlots.ts` | Studio Media tab adapter over readiness engine |
| Catalogue media summary | `src/features/catalogueAiStudio/catalogueMediaSummary.ts` | Hero + approved gallery read-only summary |
| Image prompt SOP templates | `src/features/catalogueAiStudio/catalogueContentGenerators.ts` | Local text prompts (`IMAGE_PROMPT_BLOCK_META`) — no AI call |
| Sale-type completeness | `src/features/mediaReadiness/mediaCompleteness.ts` | Parallel hero/square/closeup/packaging kind check by sale type |

## Canonical photography families (5)

| Family key | Detection signals | Production required readiness slots | Governed SOP prompts |
| --- | --- | --- | --- |
| `baklawa_small_sweets` | category/subcategory/type contains baklawa/pyramid/roll | `primary_image`, `catalogue_image`, `close_up_image` | hero, square, closeup (+ optional lifestyle/angle) |
| `gift_box` | gift/ready_pack/box/acrylic/pack signals | `pack_front_image`, `open_pack_image`, `primary_image` | packaging + hero |
| `export_pack` | export class/category/type | `label_front_image`, `packaging_reference`, `master_carton_image` | packaging |
| `hamper` | gift_hamper/hamper signals | `hamper_arrangement_image`, `close_up_image`, `primary_image` | lifestyle + closeup + hero |
| `general` | default fallback | `primary_image` | hero |

## Media type / slot mapping (dual taxonomy retained)

Uploader types (`product_media.type`) map to readiness slots via `MEDIA_UPLOADER_TO_READINESS`:

| Uploader type | Readiness slot |
| --- | --- |
| `hero_image` | `primary_image` |
| `white_background`, `square_image` | `catalogue_image` |
| `closeup`, `detail_image` | `close_up_image` |
| `lifestyle`, `lifestyle_image` | `pairing_image` |
| `side_angle`, `top_angle`, `45_angle` | `secondary_angle` |
| `hamper_open`, `hamper_closed` | `lifestyle_variant` / pack slots (profile-dependent) |
| `label_image` | `packaging_reference` / label slots (profile-dependent) |
| `raw_photo` | `secondary_image` |
| `source_pdf_page` | `source_reference` |

Point 42 does **not** merge the two taxonomies — it makes the family → slot → uploader → SOP chain deterministic and fail-closed.

## Catalogue linkage

| Consumer | Reads | Point 42 contract use |
| --- | --- | --- |
| Catalogue Studio Media tab | `catalogueRequiredMediaSlots`, `cataloguePhotographyFamilyView` | Family label + required slots from contract |
| Product Truth / ProductEdit | `evaluateMediaReadiness` | Unchanged — contract derives from same profiles |
| Catalogue snapshot export | `mediaReadinessEngine` + hero authority | Unchanged in this PR |
| Image prompt studio | `composeCatalogueImagePrompt` | SOP keys referenced per slot in contract |

## Bateel / photo-governance overlap

| Area | Status |
| --- | --- |
| Bateel CSS styling | `src/index.css` comments only — **no governance overlap** |
| Bateel photo approval rules | **Point 43** — not implemented here |
| PR-09 Bateel UI rebuild | Documented in `docs/PR_SEQUENCE.md` — separate track |

## Downstream points (strictly separate)

| Point | Scope | Point 42 boundary |
| --- | --- | --- |
| **43** | Bateel photo governance | Referenced only in contract `downstreamAuthority` |
| **44** | Mobile camera capture | Not touched |
| **45** | Photo enhancement | Not touched |
| **46** | Photography QA | Not touched |
| **47** | Photography outputs | Not touched |

## Files touched

| File | Change |
| --- | --- |
| `src/features/mediaReadiness/controlledPhotographyFamilies.ts` | **NEW** — Point 42 canonical family contract + census builder |
| `src/features/mediaReadiness/controlledPhotographyFamilies.test.ts` | **NEW** — 11 focused fail-closed + family requirement tests |
| `src/features/catalogueAiStudio/catalogueMediaSlots.ts` | Wire `cataloguePhotographyFamily*` adapters |
| `src/features/catalogueAiStudio/catalogueMediaSlots.test.ts` | Family resolution wiring tests |
| `docs/programme/POINT_42_CONTROLLED_PHOTOGRAPHY_FAMILIES_CENSUS.md` | **NEW** — this census |

## Fail-closed contract rules

1. Unknown explicit family key → `requireControlledPhotographyFamilyKey` throws; `resolveControlledPhotographyFamily` returns `unknown_family`.
2. Unknown uploader type → `mapUploaderTypeToReadinessSlot` returns `unknown_uploader_type` (never silently maps).
3. Production mode with zero resolved required slots → `requirements_unresolved`.
4. No image generation, no media approval bypass, no production DB writes.

## Test matrix (exact-head)

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | **PASS** |
| Unit tests | `npm test` | **PASS** — **863/863** (includes Point 42 contract + adapter tests) |
| Build | `npm run build` | **PASS** |
| Boundaries | `npm run check:boundaries` | **PASS** (0 new violations) |
| Biome | `biome check` on changed files | **PASS** |
| Production mutation | N/A | **NONE** |

## Gate state

| Gate | Status |
| --- | --- |
| Rebased on current `main` @ `6f8e164` | **PASS** |
| Canonical family contract implemented | **PASS** |
| Fail-closed on unknown family/uploader | **PASS** |
| Points 43–47 kept separate | **PASS** |
| Merge | **STOP** — await review from `dineshmutrejabackup-cmd` |
