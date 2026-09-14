# Point 47 — Governed Derivative / Output Formats Canonical Closure

**ASM:** AI Studio Product Master media / photography authority  
**Mission Control authority:** Central #459 — Point 47 = governed derivative/output formats (WebP/WebM/print/UHD)  
**Starting SHA:** `b1d2f02` (Point 46 PR #185 exact head)  
**Mandatory merge predecessor:** PR #167 (Point 42) → PR #172 (Point 43) → PR #176 (Point 44) → PR #180 (Point 45) → PR #185 (Point 46)  
**Boundary:** Fixtures/mocks/local transforms only — no real encoding, no production mutation

## Exact starting SHA / ancestry

| Commit | Point | Description |
| --- | --- | --- |
| `54f7c52` | Point 42 | Controlled photography families canonical contract |
| `5f446a0` | Point 43 | Benchmark photography governance canonical closure |
| `63e2d35` | Point 44 | Guided mobile camera capture canonical closure |
| `986e202` | Point 45 | Exact-product AI enhancement canonical closure |
| `b1d2f02` | Point 46 | Image QA validation canonical closure |
| *(this PR)* | Point 47 | Governed derivative/output formats canonical closure |

## Derivative / export authority census

| Surface | Path | Role | Derivative status |
| --- | --- | --- | --- |
| Point 42 families | `src/features/mediaReadiness/controlledPhotographyFamilies.ts` | Slot/family binding (upstream) | Consumed for profile slot applicability |
| Point 43 benchmark governance | `src/features/mediaReadiness/benchmarkPhotographyGovernance.ts` | Preservation constraints (upstream) | Consumed indirectly via QA chain |
| Point 44 guided capture | `src/features/mediaReadiness/guidedMobileCameraCapture.ts` | Source pixel handoff (upstream) | Source bytes preserved for derivatives |
| Point 45 enhancement | `src/features/mediaReadiness/exactProductEnhancement.ts` | Enhancement provenance (upstream) | QA-approved enhancement may become derivative source |
| Point 46 image QA | `src/features/mediaReadiness/imageQaValidation.ts` | QA disposition + audit (upstream gate) | **Required** — only `approved` disposition eligible |
| **Point 47 contract** | `src/features/mediaReadiness/derivativeOutputContract.ts` | **NEW** — canonical derivative/output contract | Authoritative |
| Media draft boundary | `src/features/catalogueDrafts/mediaDraftBoundary.ts` | MIME allowlist, raw/submissions path builders | Source namespace; derivatives use `derivatives/` |
| Product media persistence | `src/features/productAuthority/productMediaPersistence.ts` | Writes `product_media` rows | **GAP:** no derivative profile gate |
| Product media uploader | `src/components/ProductMediaUploader.tsx` | Direct upload/persistence | **GAP:** no derivative generation lane |
| Catalogue Product Studio | `src/pages/CatalogueProductStudio.tsx` | Media tab | **GAP:** no derivative export UI |
| Catalogue media slots | `src/features/catalogueAiStudio/catalogueMediaSlots.ts` | Studio Media tab adapters (Point 42–47) | Wired |
| Catalogue snapshot | `src/features/catalogueSnapshot/snapshotGenerator.ts` | Central sync payload | Consumes approved hero URLs — no derivative manifest yet |
| Media library page | `src/pages/Media.tsx` | Placeholder UI | **GAP:** no derivative workflow |
| Unified media architecture | `docs/UNIFIED_PRODUCT_MEDIA_ARCHITECTURE.md` | Role/slot consumption map | Informs profile consumption surfaces |

## Output profiles (deterministic, existing requirements only)

| Profile ID | MIME | Extension | Long edge | Aspect hint | Consumption |
| --- | --- | --- | --- | --- | --- |
| `web_catalogue_webp` | `image/webp` | `.webp` | 1200px max | 1:1 | Catalogue grid, WhatsApp square, Central sync catalogue_image |
| `web_hero_webp` | `image/webp` | `.webp` | 1200px max | 3:4 | Product cards, list thumbnails, Studio Media tab |
| `print_ready_jpeg` | `image/jpeg` | `.jpeg` | 3000px max (2400px min) | any | Trace print queue (planned), label PDF fallback (planned) |
| `uhd_archive_jpeg` | `image/jpeg` | `.jpeg` | 3840px max | any | UHD archive, future buyer portal |
| `web_motion_webm` | `video/webm` | `.webm` | 1920px max | any | Video slot, WhatsApp rich media (planned) |

## Storage naming / path rules

| Namespace | Pattern | Overwrite risk |
| --- | --- | --- |
| Source raw | `products/{id}/raw/{ts}-{filename}` | **Protected** — derivatives must not target |
| Contributor staging | `products/{id}/submissions/{ts}-{filename}` | **Protected** — derivatives must not target |
| Derivative output | `products/{id}/derivatives/{profileId}/{hashPrefix}.{ext}` | Deterministic from source hash + profile — no timestamp |

## MIME / content-type handling

| Layer | Rule |
| --- | --- |
| Profile contract | Each profile declares canonical `mimeType` + `fileExtension` |
| Transform output | Output MIME must match resolved profile |
| Video vs image | Image profiles rejected for `video` uploader type; WebM only for video sources |
| Manifest | `point47_manifest_v1` carries MIME, dimensions (mock), consumption surfaces, QA audit ref |

## Source / QA / provenance linkage

| Field | Required | Enforced by |
| --- | --- | --- |
| `sourceContentHash` | Yes | `resolveDerivativeOutputContract`, `validateDerivativeTransformOutput` |
| `sourceMediaId` | Yes | Contract resolution + provenance validation |
| `approvedMediaId` + `approvedMediaRef` | Yes | Point 46 QA audit binding |
| `qaAuditRef` | Yes | Derived from `point46_audit_v1` record |
| `productId` + `readinessSlot` | Yes | Point 42 slot mapping + QA audit match |
| `familyKey` | Yes | Point 42 family resolution |

## Risky paths (pre-Point 47 / persistence gaps)

| Risk | Location | Point 47 mitigation |
| --- | --- | --- |
| Derivatives from unapproved source | Ungoverned persistence | `qa_source_unapproved` — requires Point 46 `approved` disposition |
| Unknown output profile | Ad-hoc resize/WebP | `unknown_output_profile` + canonical profile registry |
| Source overwrite | Reusing raw path | `assessSourceOverwriteRisk` blocks `/raw/`, `/submissions/`, path equality |
| Missing provenance | Ungoverned encoder output | `validateDerivativeTransformOutput` fail-closed |
| Success without persistence | UI/upload claims | `validateDerivativePersistenceHandoff` requires canonical persistence result |
| Direct publish bypass | Customer-visible URLs | `direct_publish_forbidden` on handoff |
| Inconsistent filenames/MIME | Ad-hoc naming | Deterministic `buildDerivativeStoragePath` + profile MIME contract |

## Point 47 derivative generation vs separate points

| Lane | Point 47 owns | Separate points |
| --- | --- | --- |
| Output profile registry | `DERIVATIVE_OUTPUT_PROFILES` | — |
| Eligibility gate | Approved Point 46 QA source only | Point 46 owns QA disposition |
| Mock transform execution | `executeMockDerivativeTransform` | — |
| Provenance + manifest | `point47_provenance_v1`, `point47_manifest_v1` | — |
| Persistence handoff validation | `validateDerivativePersistenceHandoff` | Persistence wiring deferred |
| Enhancement execution | — | **Point 45** |
| QA scoring / approval | — | **Point 46** |
| Capture handoff | — | **Point 44** |

## Fail-closed policy rules

1. Missing `productId` → `product_identity_unresolved`.
2. Point 46 disposition not `approved` → `qa_source_unapproved`.
3. QA audit mismatch (product, slot, media ref) → `qa_audit_mismatch`.
4. Missing source hash or media id → `source_hash_missing` / `source_media_unbound`.
5. Unknown profile id → `unknown_output_profile`.
6. Profile incompatible with readiness slot → `profile_slot_incompatible`.
7. Image profile on video source (or vice versa) → `profile_codec_unsupported`.
8. Derivative path targets raw/submissions or equals source → `source_overwrite_risk`.
9. Transform output without valid provenance → `provenance_invalid`.
10. Success claim without persistence result → `persistence_missing` / `success_claim_without_persistence`.

## Files touched

| File | Change |
| --- | --- |
| `src/features/mediaReadiness/derivativeOutputContract.ts` | **NEW** — Point 47 canonical derivative/output contract |
| `src/features/mediaReadiness/derivativeOutputContract.test.ts` | **NEW** — eligibility, profiles, filenames/MIME, provenance, persistence tests |
| `src/features/catalogueAiStudio/catalogueMediaSlots.ts` | Wire `catalogueDerivativeOutput*` adapters |
| `src/features/catalogueAiStudio/catalogueMediaSlots.test.ts` | Point 47 adapter wiring tests |
| `src/features/mediaReadiness/imageQaValidation.ts` | Update census downstream path for Point 47 |
| `src/features/mediaReadiness/exactProductEnhancement.ts` | Update census downstream path for Point 47 |
| `docs/programme/POINT_47_DERIVATIVE_OUTPUT_CENSUS.md` | **NEW** — this census |

## Gate state

| Gate | Status |
| --- | --- |
| Branched from Point 46 #185 head `b1d2f02` | **PASS** |
| Derivative output contract implemented | **PASS** |
| Reconciled with Point 42–46 chain — no parallel taxonomy | **PASS** |
| Only approved Point 46 QA source eligible | **PASS** |
| Fixtures/mocks only — no real encoding | **PASS** |
| PR dependent on #167, #172, #176, #180, #185 | **DRAFT** — await predecessor merges, then rebase |
| Real export/print/UHD/video UAT | **NOT CLEARED** — contract + tests only; real UAT required for stage clearance |
| Merge | **STOP** — await review from `dineshmutrejabackup-cmd` |
