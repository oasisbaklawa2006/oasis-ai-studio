# Point 46 — Image QA Validation Canonical Closure

**ASM:** AI Studio Product Master media / photography authority  
**Mission Control authority:** Central #459 — Point 46 = image QA validation governance/software closure  
**Starting SHA:** `986e202` (Point 45 PR #180 exact head)  
**Mandatory merge predecessor:** PR #167 (Point 42) → PR #172 (Point 43) → PR #176 (Point 44) → PR #180 (Point 45)  
**Boundary:** No real image analysis/generation, no production mutation, no derivative encoding (Point 47)

## Exact starting SHA / ancestry

| Commit | Point | Description |
| --- | --- | --- |
| `54f7c52` | Point 42 | Controlled photography families canonical contract |
| `5f446a0` | Point 43 | Benchmark photography governance canonical closure |
| `63e2d35` | Point 44 | Guided mobile camera capture canonical closure |
| `986e202` | Point 45 | Exact-product AI enhancement canonical closure |
| *(this PR)* | Point 46 | Image QA validation canonical closure |

## Image / media QA census

| Surface | Path | Role | QA status |
| --- | --- | --- | --- |
| Point 42 families | `src/features/mediaReadiness/controlledPhotographyFamilies.ts` | Required slot binding (upstream) | Consumed by Point 46 slot compliance |
| Point 43 benchmark governance | `src/features/mediaReadiness/benchmarkPhotographyGovernance.ts` | Preservation constraints (upstream) | Consumed by benchmark_compliance check |
| Point 44 guided capture | `src/features/mediaReadiness/guidedMobileCameraCapture.ts` | Source pixel handoff (upstream) | Capture-origin candidates |
| Point 45 enhancement | `src/features/mediaReadiness/exactProductEnhancement.ts` | Enhancement provenance (upstream) | Enhancement-origin candidates |
| **Point 46 contract** | `src/features/mediaReadiness/imageQaValidation.ts` | **NEW** — canonical image QA validation contract | Authoritative |
| Media authority contract | `src/features/mediaReadiness/mediaAuthorityContract.ts` | Approved-only authority | Blocks customer-visible without QA disposition |
| Media readiness engine | `src/features/mediaReadiness/mediaReadinessEngine.ts` | Slot readiness scoring | Pending rows never satisfy |
| Product media persistence | `src/features/productAuthority/productMediaPersistence.ts` | Writes `product_media` rows | **GAP:** no QA disposition gate |
| Product media uploader | `src/components/ProductMediaUploader.tsx` | Direct upload/persistence | **GAP:** no QA review surface |
| Catalogue Product Studio | `src/pages/CatalogueProductStudio.tsx` | Media tab | **GAP:** no operator QA review UI |
| Catalogue media slots | `src/features/catalogueAiStudio/catalogueMediaSlots.ts` | Studio Media tab adapters (Point 42–46) | Wired |
| Media library page | `src/pages/Media.tsx` | Placeholder UI | **GAP:** no QA disposition workflow |

## Readiness / approval flags

| Flag / state | Where enforced | Point 46 behaviour |
| --- | --- | --- |
| `pending_review` | Point 45 enhancement handoff | Preserved until all mandatory automated checks pass |
| `approved` | `mediaAuthorityContract` | Requires governed reviewer disposition via Point 46 |
| `rejected` | `mediaAuthorityContract` | Requires governed reviewer disposition via Point 46 |
| `hold` | Point 46 only | Packaging/text/logo preservation uncertainty |
| `ready_for_human_review` | Point 46 automated evaluation | All mandatory checks pass — still not approved |

## Automated QA checks (evidence/scores only)

| Check ID | Validates | Pass | Fail | Uncertain |
| --- | --- | --- | --- | --- |
| `source_binding` | Source media id + content hash | Bound | Missing | — |
| `product_identity` | Product id resolved | Present | Missing | — |
| `slot_compliance` | Point 42 required/optional slot | Valid slot | Unmapped | — |
| `benchmark_compliance` | Point 43 governance | Resolved | Failed | — |
| `preservation_provenance` | Point 45 attestation (enhancement) | Complete | Missing provenance | Packaging/text/logo uncertain |
| `technical_quality` | Dimensions, file size | Above minimum | Below minimum | Dimensions unavailable |
| `metadata_integrity` | MIME type | Supported | Unsupported | MIME missing |

## Subjective / manual-only gates

| Gate | Recorded? | Point 46 mitigation |
| --- | --- | --- |
| Exact-product visual fidelity | Requires human reviewer notes on approval | `humanFidelityReviewRequired` policy |
| Packaging text legibility | Uncertain automated check → hold | `preservation_provenance` uncertain status |
| Logo/artwork preservation | Uncertain automated check → hold | Blocks approval while uncertain |
| Operator subjective quality | Not auto-scored | Automated scores are evidence only |

## Risky paths (bypass / unreviewed publication)

| Risk | Location | Point 46 mitigation |
| --- | --- | --- |
| Auto-approve without human review | Future persistence paths | `autoApproveForbidden` + `reviewer_missing` error |
| Direct customer-visible publication | Publish without QA | `direct_publish_forbidden` error |
| Accept AI output without source comparison | Enhancement lane | `source_binding` + `preservation_provenance` checks |
| Packaging/text preservation unverifiable | Enhancement attestation | `preservation_uncertain` → hold, blocks approval |
| QA checks bypassed | Ungoverned status write | Contract-layer fail-closed; persistence gate still **GAP** |
| Unreviewed media row customer-visible | `product_media` status | `mediaAuthorityContract` approved-only; QA audit **GAP** at persistence |

## Point 46 QA decisioning vs separate points

| Lane | Point 46 owns | Separate points |
| --- | --- | --- |
| Automated QA evidence | `runAutomatedQaChecks` scores only | — |
| Human review disposition | `recordQaDisposition` with reviewer auth | — |
| Audit record | `QaAuditRecord` schema | — |
| Enhancement execution | — | **Point 45** |
| Derivative encoding | — | **Point 47** |
| Capture handoff | — | **Point 44** |

## Fail-closed policy rules

1. Missing `productId` → `product_identity_unresolved`.
2. Missing `contentHash` → `source_hash_missing`.
3. Missing `sourceMediaId` → `source_media_unbound`.
4. Unknown uploader type / slot → `unknown_uploader_type` / `unknown_slot`.
5. Mandatory automated check failure → `rejected` readiness; blocks approval.
6. Preservation uncertainty → `hold`; blocks approval with `preservation_uncertain`.
7. Approval without reviewer → `reviewer_missing`.
8. Unauthorized reviewer role → `reviewer_unauthorized`.
9. Attempted direct publish → `direct_publish_forbidden`.
10. Automated scores never auto-approve → `auto_approve_forbidden` policy.

## Files touched

| File | Change |
| --- | --- |
| `src/features/mediaReadiness/imageQaValidation.ts` | **NEW** — Point 46 canonical image QA validation contract |
| `src/features/mediaReadiness/imageQaValidation.test.ts` | **NEW** — pass/hold/reject, source mismatch, preservation uncertainty, reviewer auth, audit tests |
| `src/features/catalogueAiStudio/catalogueMediaSlots.ts` | Wire `catalogueImageQaValidation*` adapters |
| `src/features/catalogueAiStudio/catalogueMediaSlots.test.ts` | Point 46 adapter wiring tests |
| `src/features/mediaReadiness/exactProductEnhancement.ts` | Update census downstream path for Point 46 |
| `docs/programme/POINT_46_IMAGE_QA_VALIDATION_CENSUS.md` | **NEW** — this census |

## Gate state

| Gate | Status |
| --- | --- |
| Branched from Point 45 #180 head `986e202` | **PASS** |
| Image QA validation contract implemented | **PASS** |
| Reconciled with Point 42/43/44/45 — no parallel taxonomy | **PASS** |
| Point 47 kept separate | **PASS** |
| Fixtures/mocks only — no real image analysis | **PASS** |
| PR dependent on #167, #172, #176, #180 | **DRAFT** — await predecessor merges, then rebase |
| Real-image human QA UAT | **NOT CLEARED** — contract + tests only; real-image human QA UAT required for stage clearance |
| Merge | **STOP** — await review from `dineshmutrejabackup-cmd` |
