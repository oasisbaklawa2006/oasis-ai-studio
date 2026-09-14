# Point 38 — Canonical Product Workflow State Census

**Issue:** #155 · **ASM:** AI Studio product workflow-state closure  
**Mission Control authority:** Central #459 — Point 38 = canonical product workflow states  
**Starting SHA:** `6f8e16417dcef2323d833072d23a92a32b87a833` (`main` @ POINT35 #147)  
**Boundary:** No Core migration; no Point 39/40/54/media absorption  

## Starting SHA evidence

| Ref | SHA | Description |
| --- | --- | --- |
| `origin/main` | `6f8e164` | POINT35 — Dimensions / weight / CBM canonical completion audit + closure (#147) |

## State-machine census (as-built on starting SHA)

### A. Catalogue AI Studio copy drafts (primary governed workflow)

| Layer | Values | Authority | Transitions |
| --- | --- | --- | --- |
| `catalogue_ai_studio_drafts.status` | `DRAFT`, `UNDER_REVIEW`, `APPROVED`, `REJECTED` | Core schema; AI Studio persistence via `catalogueDraftRepository.ts` | DRAFT→UNDER_REVIEW (submit); UNDER_REVIEW→APPROVED/REJECTED; APPROVED/REJECTED→DRAFT (new version) |

**Pure guards (pre-Point38):** `catalogueDraftWorkflow.ts` — `canSubmitForReview`, `canApprove`, `canReject`, `isExportBundleDistributable`  
**UI consumer:** `CatalogueProductStudio.tsx`

### B. Contributor drafts (Approval Inbox — 7 types)

| Layer | Values | Authority | Transitions |
| --- | --- | --- | --- |
| Draft tables | `pending_approval`, `approved`, `rejected` | Core RPCs (`approve_*` / `reject_*`) | Insert as `pending_approval` → approve/reject |

**UI consumer:** `ApprovalInbox.tsx` — reviewer-gated via `is_catalogue_reviewer()`

### C. Catalogue versions (publication handoff)

| Layer | Values | Authority | Transitions |
| --- | --- | --- | --- |
| `catalogue_versions.status` | `draft`, `pending_approval`, `approved`, `published`, `synced` | Core + Central sync | draft→approved (client); `published`/`synced` = **Point 54** |

### D. Product master flags (not a single workflow column)

| Field | Observed values | Role |
| --- | --- | --- |
| `label_status` | `draft`, `needs_review`, `approved`, `locked`, `rejected` | Label domain — separate from catalogue draft workflow |
| `is_catalogue_ready` | boolean | Publication-readiness gate (Point 36 MOQ/readiness) |
| `media_status` | derived + legacy column | Point 31 media authority |

### E. Knowledge handoff (Point 33 — out of Point 38 scope)

`publishSubmissionState.ts` — `NOT_READY` → `HANDOFF_READY` → `SUBMITTED_TO_CORE` (WhatsApp knowledge, not product master workflow).

## Duplicate / legacy / inferred UI states

| Issue | Location | Point 38 treatment |
| --- | --- | --- |
| Two approval vocabularies (UPPER vs snake_case) | Studio drafts vs contributor drafts | Normalized to canonical `submitted` / `approved` / `rejected` phases |
| `WorkQueueStatus` inferred labels | `catalogueWorkQueueStatus.ts` | Maps via `mapCatalogueDraftStatus` — no parallel formula |
| `ReadinessBadge` includes `published`/`locked` | `productTruth/types.ts` | Unchanged — readiness badges ≠ workflow phases |
| `label_status` vs `LabelOverallStatus` | Products list vs `labelReadiness.ts` | Out of scope — not unified here |
| `UNDER_REVIEW` reused for WhatsApp sales drafts | `draftGovernance.ts` | Separate domain — not absorbed |

## Allowed transitions & actor authority

| Canonical phase | Contributor actions | Reviewer actions |
| --- | --- | --- |
| `pre_draft` | save (create first draft) | — |
| `draft` | save, submit | — |
| `submitted` | — (save blocked) | approve, reject |
| `approved` | create_new_version (→ draft) | — |
| `rejected` | create_new_version (→ draft) | — |
| `published` (Point 54) | **blocked** | **blocked** |

**Illegal skips (fail-closed):** draft→approved, draft→published, rejected→approved, save while submitted, publish from any phase.

## Programme boundaries

| Point | Boundary |
| --- | --- |
| **39** | Correction/resubmission after rejection — `create_new_version` from `rejected` only; audit persistence not implemented |
| **40** | Version history — out of scope |
| **54** | Publication (`published`/`synced`) — referenced for skip guards; no AI Studio publish transition |
| **31** | Media workflow — not absorbed |

## Missing link (pre-closure)

No single canonical `ProductWorkflowPhase` contract existed. Transition guards were duplicated in `catalogueDraftWorkflow.ts` without cross-domain normalization, fail-closed skip matrix, or explicit Point 39/54 boundary markers. Repository transitions relied on optimistic `.eq("status", …)` only.

## This PR closure

| File | Change |
| --- | --- |
| `src/features/productWorkflow/productWorkflowState.ts` | **NEW** — canonical phases, domain mappers, transition matrix, snapshot serializer |
| `src/features/productWorkflow/productWorkflowState.test.ts` | **NEW** — 14 focused transition/authorization regressions |
| `src/features/catalogueAiStudio/catalogueDraftWorkflow.ts` | Delegates to Point 38 contract; adds `canSaveDraft`, `canCreateNewVersion` |
| `src/features/catalogueAiStudio/catalogueDraftRepository.ts` | `assertValidWorkflowTransition` before submit/approve/reject/save |
| `src/features/catalogueAiStudio/catalogueWorkQueueStatus.ts` | Maps draft status via canonical phase |
| `src/features/catalogueAiStudio/*.test.ts` | Extended regression coverage |

## Gate matrix (exact-head)

| Gate | Command | Status |
| --- | --- | --- |
| Unit tests | `npm test` | **PASS** — 867/867 |
| Build | `npm run build` | **PASS** |
| Boundaries | `npm run check:boundaries` | **PASS** (0 violations) |
| Typecheck | `npm run typecheck` | **PASS** |

## Downstream points affected

| Point | Impact |
| --- | --- |
| **39** | `create_new_version` boundary defined; audit persistence still Point 39 |
| **40** | Version history reads existing audit log — no change |
| **54** | Publication phase referenced; no publish transition added |
| **37** | Independent — readiness gates unchanged |
