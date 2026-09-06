# Point 39 — Correction / Rejection / Resubmission Census

**Issue:** #459 Point 39 · **ASM:** AI Studio correction/resubmission canonical closure  
**Mandatory merge predecessor:** AI Studio PR **#157** (Point 38)  
**Starting SHA:** `bd36a735650adf664c382d02a69e357fc0eda7f9`  
**Starting branch:** `cursor/point38-product-workflow-state-2c0c` (`refs/pull/157/head`)  

## Branch ancestry evidence

| Ref | SHA | Relationship |
| --- | --- | --- |
| `origin/main` | `6f8e164` | POINT35 (#147) — ancestor of Point 38 |
| Point 38 head | `bd36a735` | **Mandatory predecessor** — POINT38 workflow-state closure (#157) |
| Point 39 branch | `cursor/point39-correction-resubmission-0714` | Built from `bd36a735` — **must not merge before #157** |

```
6f8e164 (main, POINT35)
   └── bd36a735 (POINT38 #157) ← mandatory predecessor
          └── cursor/point39-correction-resubmission-0714 (this PR)
```

## Correction / rejection / resubmission census

### A. Catalogue AI Studio copy drafts (primary governed workflow)

| Path | Location | Actor | Reason persistence | Predecessor linkage | Status transition | In-place mutation risk |
| --- | --- | --- | --- | --- | --- | --- |
| Reject | `catalogueDraftRepository.rejectDraft` | Reviewer (`assertValidWorkflowTransition` + UI) | `rejection_reason` column + audit `metadata.rejection_reason` | N/A (terminal) | UNDER_REVIEW → REJECTED | **Safe** — status-guarded `.eq("status","UNDER_REVIEW")` |
| Save correction | `catalogueDraftRepository.saveDraft` | Contributor | Prior reason in CREATE_NEW_VERSION audit | `predecessor_draft_id`, `predecessor_version_number`, `correction_kind`, `previous_version_rejection_reason` | REJECTED/APPROVED → new DRAFT row (v+1) | **Safe** — insert-only from terminal; DRAFT updates in-place only |
| Resubmit | `saveDraft` → `submitDraftForReview` | Contributor | Carried in predecessor audit metadata | Same as save correction | DRAFT → UNDER_REVIEW | **Safe** — submits open DRAFT only |
| Approve | `approveDraft` | Reviewer | Clears `rejection_reason` | N/A | UNDER_REVIEW → APPROVED | **Safe** |
| UI reject shortcut | `CatalogueProductStudio.handleReject` | Reviewer | Requires non-empty reason in UI | N/A | Delegates to repository | **Safe** — repository now also fail-closes empty reason |
| Export copy | `isExportBundleDistributable` | Any | N/A | N/A | No status change | **Safe** — APPROVED + complete content only |

**Pure contract:** `productCorrectionContract.ts` — reason validation, terminal immutability, predecessor linkage, contributor correction semantics  
**State legality:** delegated to `productWorkflowState.ts` (Point 38)

### B. Contributor drafts — Approval Inbox (5 actionable + 2 Central-governed)

| Draft type | Table | Reject path | Resubmit path | Actor | Reason persistence |
| --- | --- | --- | --- | --- | --- |
| Product | `catalogue_product_drafts` | RPC `reject_catalogue_product_draft` | New draft via Core submit RPC (not in-place) | Reviewer / Contributor | `rejection_reason` column; UI requires reason |
| Media | `catalogue_media_submissions` | `reject_catalogue_media_submission` | New submission row | Reviewer / Contributor | Same |
| Alias | `catalogue_alias_drafts` | `reject_catalogue_alias_draft` | New draft row | Reviewer / Contributor | Same |
| BOM | `catalogue_bom_drafts` | `reject_catalogue_bom_draft` | New draft row | Reviewer / Contributor | Same |
| Tag | `catalogue_tag_drafts` | `reject_catalogue_tag_draft` | New draft row | Reviewer / Contributor | Same |
| MOQ | `catalogue_moq_drafts` | Central only | Central only | Central | Read-only in AI Studio |
| Pricing | `catalogue_pricing_drafts` | Central only | Central only | Central | Read-only in AI Studio |

**UI consumer:** `ApprovalInbox.tsx` — `reject()` requires trimmed reason; approve/reject RPCs are Core authority  
**Pure contract:** `evaluateContributorCorrection` — documents resubmit-only-from-rejected semantics

### C. Catalogue versions (publication handoff — Point 54 boundary)

| Path | Authority | Point 39 treatment |
| --- | --- | --- |
| Version reject/approve | Core `catalogue_versions` | **Not absorbed** — referenced only for skip guards |
| Publish / sync | Point 54 Central | **Blocked** — no AI Studio publish transition |

### D. Out-of-scope paths (not catalogue draft correction)

| Path | Location | Why excluded |
| --- | --- | --- |
| Data Correction page | `DataCorrection.tsx` | Product master gap fixes — `localStorage` review flags, not draft workflow |
| Pilot alias review | `PilotAliasReview.tsx` | Separate pilot alias domain |
| Knowledge handoff | `submitKnowledgeDraft.ts` | Point 33 knowledge plane |
| WhatsApp operator inbox | `operatorInbox/*` | Sales-order suggestion domain |

## Duplicate / unsafe paths identified (pre-Point39)

| Issue | Risk | Point 39 treatment |
| --- | --- | --- |
| Empty rejection reason bypassing UI | Reviewer reason lost | `assertRejectionReasonRequired` in repository + contract |
| Terminal snapshot in-place edit | Overwrites approved/rejected content | `assertTerminalSnapshotNotMutatedInPlace` + insert-only new version |
| Rejected → approved skip | Illegal approval without resubmission | Point 38 guard retained; regression tested |
| Rejection reason lost on new version | Operator cannot see prior feedback | `buildPredecessorLinkage` with `previous_version_rejection_reason` |
| Save during UNDER_REVIEW | Races reviewer action | Point 38 + repository fail-closed |
| Direct publish | Bypasses review | Point 54 boundary — blocked in Point 38 |
| Contributor rejected in-place resubmit | Mutates rejected record | Documented: new Core submission required |

## Separation from Point 40 / Point 54

| Point | Boundary |
| --- | --- |
| **40** | Version/audit history presentation — reads existing audit log; no new audit UI |
| **54** | Publication (`published`/`synced`) — not implemented here |
| **39 (this PR)** | Governed correction/resubmission contract + audit linkage metadata |

## This PR closure

| File | Change |
| --- | --- |
| `src/features/productWorkflow/productCorrectionContract.ts` | **NEW** — fail-closed correction/resubmission contract delegating legality to Point 38 |
| `src/features/productWorkflow/productCorrectionContract.test.ts` | **NEW** — rejection, correction, resubmit, stale-version, unauthorized regressions |
| `src/features/catalogueAiStudio/catalogueDraftRepository.ts` | Point 39 guards: reason required, terminal immutability, predecessor linkage |
| `src/features/catalogueAiStudio/catalogueDraftRepository.test.ts` | **NEW** — repository-level correction/regression tests |

## Gate matrix (exact-head on Point 38 base)

| Gate | Command | Status |
| --- | --- | --- |
| Unit tests | `npm test` | **PASS** — 886/886 |
| Build | `npm run build` | **PASS** |
| Boundaries | `npm run check:boundaries` | **PASS** (0 violations) |
| Typecheck | `npm run typecheck` | **PASS** |

## Programme gate state

`PR MERGED != Point 39 CLEARED` — runtime evidence required after #157 merges and exact-head gates re-run on rebased `main`.
