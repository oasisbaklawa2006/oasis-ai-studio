# Point 52 — Mobile Approval / Launch Authority Census

**ASM:** AI Studio governed approval/review usable on supported mobile  
**Mission Control authority:** Central #459 — Point 52 = mobile approval / launch closure  
**Starting SHA:** `6f8e164` (`main` @ POINT35 #147)  
**Point 38 dependency:** **NOT HARD** — PR #157 (`cursor/point38-product-workflow-state-2c0c`) is OPEN; Point 52 uses existing `is_catalogue_reviewer` RPC and `catalogueDraftWorkflow` status guards without duplicating `productWorkflowState.ts`  
**Boundaries:** Point 54 publication authority and Point 44 camera capture are **not absorbed**

## Point 38 #157 dependency analysis

| Question | Finding |
| --- | --- |
| Is #157 merged into `main`? | **No** — state `OPEN` as of census date |
| Does Point 52 need `productWorkflowState.ts`? | **No** — actor authorization for mobile approval uses `is_catalogue_reviewer` RPC at UI/handler layer |
| Would Point 52 duplicate workflow authority? | **Avoided** — status transitions remain in `catalogueDraftWorkflow.ts`; Point 38 closure deferred to #157 |
| Hard predecessor? | **No** — proceed with bounded mobile approval/role closure independent of #157 |

## Authority / surface matrix

| Surface | Route | Review actions | Role gate | Mobile posture | Launch authority |
| --- | --- | --- | --- | --- | --- |
| Approval Inbox | `/approvals` | Approve/reject contributor drafts (7 types) | `is_catalogue_reviewer` RPC + `CatalogueReviewerGate` | **Supported** — stacked `flex-col sm:flex-row` actions | **None** |
| Catalogue Product Studio | `/admin/catalogue-product-studio` | Approve/reject copy drafts (`catalogue_ai_studio_drafts`) | `is_catalogue_reviewer` RPC (handler + button visibility) | **Supported** — queue stacks below `lg`; Bugbot mobile overflow fixes | **Preview/handoff only** — export bundle when APPROVED |
| Central Sync Preview | `/products/:id` (tab) | Approve snapshot (preview) | `is_catalogue_reviewer` RPC | **Scroll-heavy** — JSON preview | **Preview only** — `LIVE_CENTRAL_WRITE_ENABLED = false` |
| Pilot Alias Review | `/testing/pilot-aliases` | Term approve/reject | Testing page gate (`page="testing"`) | **Supported** | **None** |
| Product Intelligence | `/admin/product-intelligence` | Submit to Core as Draft | Readiness/golden-test gates (not reviewer) | **Scroll-heavy** | **Handoff only** — Core owns activation (Point 54) |
| Public catalogue | `/c/:slug` | N/A | N/A | N/A | **Blocked** — `CapabilityUnavailable` stub |
| Catalogue builder publish | `/admin/catalogue-builder` | N/A | N/A | N/A | **Blocked** — `CapabilityUnavailable` stub |

## Dual draft systems (preserved — not unified)

| System | Tables | Review surface | Workflow guards |
| --- | --- | --- | --- |
| Contributor drafts | `catalogue_product_drafts`, `catalogue_media_submissions`, etc. | `/approvals` | RPC `approve_catalogue_*_draft` / `reject_catalogue_*_draft` |
| AI Studio copy drafts | `catalogue_ai_studio_drafts` | Catalogue Product Studio (in-page) | `catalogueDraftWorkflow.ts` status guards |

Point 38 #157 will unify phase mapping across domains; Point 52 does not preempt that contract.

## Central-governed commercial authority (Point 27 Finding 2)

Pricing and MOQ drafts (`catalogue_moq_drafts`, `catalogue_pricing_drafts`) appear in Approval Inbox **read-only** with Central governance note. Approve/reject actions are fail-closed via `evaluateMobileApprovalAction` + `governedByCentral` flag.

## Launch / publication boundary (Point 54 — fail-closed)

| Action | Status in AI Studio | Evidence |
| --- | --- | --- |
| `publish_catalogue_version` | **Blocked** | `evaluateLaunchAction()` |
| `live_central_write` | **Blocked** | `LIVE_CENTRAL_WRITE_ENABLED = false` |
| `activate_knowledge_in_core` | **Blocked** | Publish tab shows Core activation NOT EXECUTED |
| `public_catalogue_route` | **Blocked** | `/c/:slug` stub |
| Approve snapshot (preview) | **Allowed for reviewers** | Local version store only — not live publication |
| Export approved bundle | **Allowed when distributable** | `isExportBundleDistributable()` |

## Mobile viewport policy

| Constant | Value | Source |
| --- | --- | --- |
| Minimum supported viewport | **390px** | `MOBILE_APPROVAL_MIN_VIEWPORT_PX` — matches Testing.tsx section J |
| Sidebar collapse breakpoint | 1024px (`lg`) | `AppLayout.tsx` |
| `useIsMobile` hook breakpoint | 768px | Used by sidebar only — approval surfaces use Tailwind responsive classes |

## Pre-closure gaps (addressed in this PR)

| Gap | Severity | Closure |
| --- | --- | --- |
| Catalogue Studio approve/reject visible without reviewer role | **Auth UX** | `useCatalogueReviewer` + `evaluateMobileApprovalAction` |
| `/approvals` soft text block only | **Auth UX** | `CatalogueReviewerGate` + `AccessRestricted` |
| Central Sync approve snapshot without reviewer gate | **Auth UX** | Reviewer-gated button + handler |
| No durable Point 52 census | **Programme** | This document |
| No focused role/action policy tests | **Test** | `mobileApprovalAuthority.test.ts` |
| No automated mobile E2E for approval | **Test debt** | Deferred — unit policy tests added; Playwright 390px profile is follow-up |

## Files touched

| File | Change |
| --- | --- |
| `src/features/mobileApproval/mobileApprovalAuthority.ts` | **NEW** — surface census, role gates, Point 54 launch fail-closed |
| `src/features/mobileApproval/mobileApprovalAuthority.test.ts` | **NEW** — viewport/role/action/launch tests |
| `src/hooks/useCatalogueReviewer.ts` | **NEW** — shared reviewer RPC hook |
| `src/components/CatalogueReviewerGate.tsx` | **NEW** — fail-closed route gate |
| `src/App.tsx` | Wrap `/approvals` with `CatalogueReviewerGate` |
| `src/features/approvals/ApprovalInbox.tsx` | Policy-gated approve/reject handlers |
| `src/pages/CatalogueProductStudio.tsx` | Reviewer-gated approve/reject UI + handlers |
| `src/features/catalogueSnapshot/panels/CentralSyncPreviewPanel.tsx` | Reviewer-gated snapshot approve (preview) |

## Programme boundaries (not absorbed)

| Point | Treatment |
| --- | --- |
| **38** | Workflow state contract in PR #157 — not duplicated here |
| **39** | Correction/resubmission — status guards preserved; audit persistence deferred to #161 |
| **44** | Camera capture — not in scope |
| **54** | Publication — all launch actions fail-closed via `evaluateLaunchAction()` |

## Quality gates (exact-head)

Run before merge request:

```bash
npm run typecheck
npm test
npm run build
npm run check:boundaries
npm run lint:biome
```
