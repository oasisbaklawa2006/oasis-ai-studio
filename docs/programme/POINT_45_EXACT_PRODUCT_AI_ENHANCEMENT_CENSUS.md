# Point 45 — Exact-Product AI Enhancement Canonical Closure

**ASM:** AI Studio Product Master media / photography authority  
**Mission Control authority:** Central #459 — Point 45 = exact-product image enhancement governance/software closure  
**Starting SHA:** `63e2d35afbfe2a48fd6db18dfd54644157320837` (Point 44 PR #176 exact head)  
**Mandatory merge predecessor:** PR #167 (Point 42) → PR #172 (Point 43) → PR #176 (Point 44)  
**Boundary:** No real image editing/generation, no production mutation, no QA scoring/approval (Point 46) or derivative encoding (Point 47)

## Exact starting SHA / ancestry

| Commit | Point | Description |
| --- | --- | --- |
| `54f7c52` | Point 42 | Controlled photography families canonical contract |
| `5f446a0` | Point 43 | Benchmark photography governance canonical closure |
| `63e2d35` | Point 44 | Guided mobile camera capture canonical closure |
| *(this PR)* | Point 45 | Exact-product AI enhancement canonical closure |

## Enhancement / provider / source-binding census

| Surface | Path | Role | Enhancement status |
| --- | --- | --- | --- |
| Point 42 families | `src/features/mediaReadiness/controlledPhotographyFamilies.ts` | Family → slot → uploader chain (upstream) | Consumed by Point 45 slot binding |
| Point 43 benchmark governance | `src/features/mediaReadiness/benchmarkPhotographyGovernance.ts` | Preservation constraints (upstream) | Policy + instruction validation |
| Point 44 guided capture | `src/features/mediaReadiness/guidedMobileCameraCapture.ts` | Source pixel handoff (upstream) | Source-binding chain |
| **Point 45 contract** | `src/features/mediaReadiness/exactProductEnhancement.ts` | **NEW** — canonical exact-product enhancement contract | Authoritative |
| Catalogue content generators | `src/features/catalogueAiStudio/catalogueContentGenerators.ts` | `IMAGE_PROMPT_BLOCK_META` text templates only | **GAP:** no provider adapter; templates not wired to enhancement |
| Catalogue AI gateway | `src/features/catalogueAiStudio/catalogueAiGateway.ts` | Catalogue copy Edge Function only | Out of scope — no image calls |
| Catalogue AI generation merge | `src/features/catalogueAiStudio/catalogueAiGenerationMerge.ts` | Text field merge/provenance | Out of scope — text only |
| Catalogue Product Studio | `src/pages/CatalogueProductStudio.tsx` | Future AI connector placeholder in Media tab | **GAP:** documents enhancement; no governed connector |
| Product media uploader | `src/components/ProductMediaUploader.tsx` | Direct upload/persistence | **GAP:** no enhancement entry point or provenance gate |
| Product media persistence | `src/features/productAuthority/productMediaPersistence.ts` | Writes `product_media` rows | **GAP:** no enhancement provenance validation |
| Media authority contract | `src/features/mediaReadiness/mediaAuthorityContract.ts` | Approved-only authority | Blocks auto-approve via Point 45 `outputPolicy` |
| Media library page | `src/pages/Media.tsx` | Placeholder "Future AI: enhance" UI | **GAP:** no provider adapter |
| Dashboard | `src/pages/Dashboard.tsx` | Photo Enhancement card placeholder | Out of scope — navigation only |
| Catalogue media slots | `src/features/catalogueAiStudio/catalogueMediaSlots.ts` | Studio Media tab adapters (Point 42–45) | Wired |

## Risky paths (regenerate / hallucinate / auto-approve / unbound source)

| Risk | Location | Point 45 mitigation |
| --- | --- | --- |
| Regenerate packaging/text/logo | Future image provider without policy | `forbiddenOperations` + instruction pattern rejection |
| Hallucinate product contents | Generative fill / inpaint requests | `inpaint_product`, `hallucinate_contents`, `generative_fill` forbidden |
| Alter count/shape/color materially | Operator instructions | `alter_product_geometry`, `alter_piece_count`, `alter_product_color` forbidden |
| Accept enhancement without source binding | Direct upload paths | `bindEnhancementSourceMedia` requires `sourceMediaId` + `contentHash` + productId |
| Auto-approve enhanced media | Persistence without QA | `outputPolicy.reviewCandidateOnly`; `auto_approve_forbidden` on handoff |
| Write customer-visible media directly | Publish without Point 46 | `direct_publish_forbidden` on handoff |
| Provider output without provenance | Ungoverned adapter | `validateEnhancementProviderOutput` fail-closed |
| Preservation unproven | Provider attestation missing | `preservation_unproven` error when attestation incomplete |

## Enhancement execution vs separate points

| Lane | Point 45 owns | Separate points |
| --- | --- | --- |
| Source-media identity binding | `SourceMediaBinding` with immutable `contentHash` | Point 44 capture handoff |
| Allowed operations | lighting/background/cleanliness only | — |
| Preservation requirements | packaging text, geometry, count, logo, colour | Point 43 benchmark constraints |
| Provider provenance validation | `EnhancementProviderProvenance` | — |
| Review candidate output | `pending_review` status only | Point 46 QA scoring/approval |
| Derivative encoding | — | **Point 47** |

## Exact-product enhancement contract (Point 45)

| Domain | Rule | Protected by |
| --- | --- | --- |
| Product identity | `productId` required before source binding | `product_identity_unresolved` |
| Source binding | `sourceMediaId` + `contentHash` required | `source_media_unbound`, `source_hash_missing` |
| Slot binding | Point 42 uploader → readiness slot via `bindCaptureSlot` | `unknown_uploader_type`, `unknown_slot` |
| Family chain | Point 42 → Point 43 resolution required | `family_resolution_failed` |
| Allowed enhancement | lighting_balance, background_cleanup, noise_reduction, color_cast_correction, exposure_normalization | `EnhancementPolicy.allowedOperations` |
| Forbidden enhancement | regenerate_packaging, alter geometry/count/colour, inpaint, generative fill, etc. | `EnhancementPolicy.forbiddenOperations` |
| Preservation | packaging text, geometry, count, logo, colour must remain source-bound | `preservation_unproven` |
| Provider provenance | source hash/media id/product/slot must match binding | `source_hash_mismatch`, etc. |
| Output status | Always `pending_review` — never approved | `auto_approve_forbidden`, `direct_publish_forbidden` |

## Fail-closed policy rules

1. Missing `productId` → `product_identity_unresolved`.
2. Missing `contentHash` → `source_hash_missing`.
3. Missing `sourceMediaId` → `source_media_unbound`.
4. Unknown uploader type / slot → `unknown_uploader_type` / `unknown_slot`.
5. Forbidden operator instruction → `forbidden_enhancement_operation`.
6. Point 43 benchmark conflict → `conflicts_with_benchmark`.
7. Provider provenance missing → `provenance_missing`.
8. Source hash/media/product/slot mismatch → respective mismatch errors.
9. Preservation attestation incomplete → `preservation_unproven`.
10. Attempted auto-approve → `auto_approve_forbidden`.
11. Attempted direct publish → `direct_publish_forbidden`.

## Files touched

| File | Change |
| --- | --- |
| `src/features/mediaReadiness/exactProductEnhancement.ts` | **NEW** — Point 45 canonical exact-product enhancement contract |
| `src/features/mediaReadiness/exactProductEnhancement.test.ts` | **NEW** — policy/provenance tests (fixtures/mocks only) |
| `src/features/catalogueAiStudio/catalogueMediaSlots.ts` | Wire `catalogueExactProductEnhancement*` adapters |
| `src/features/catalogueAiStudio/catalogueMediaSlots.test.ts` | Point 45 adapter wiring tests |
| `src/features/mediaReadiness/controlledPhotographyFamilies.ts` | Update census downstream path for Point 45 |
| `src/features/mediaReadiness/benchmarkPhotographyGovernance.ts` | Update census downstream path for Point 45 |
| `src/features/mediaReadiness/guidedMobileCameraCapture.ts` | Update census downstream path for Point 45 |
| `docs/programme/POINT_45_EXACT_PRODUCT_AI_ENHANCEMENT_CENSUS.md` | **NEW** — this census |

## Gate state

| Gate | Status |
| --- | --- |
| Branched from Point 44 #176 head `63e2d35` | **PASS** |
| Exact-product enhancement contract implemented | **PASS** |
| Reconciled with Point 42/43/44 — no parallel taxonomy | **PASS** |
| Points 46–47 kept separate | **PASS** |
| Fixtures/mocks only — no real image editing | **PASS** |
| PR dependent on #167, #172, #176 | **DRAFT** — await predecessor merges, then rebase |
| Enhancement + fidelity UAT | **NOT CLEARED** — contract + tests only; real provider UAT required for stage clearance |
| Merge | **STOP** — await review from `dineshmutrejabackup-cmd` |
