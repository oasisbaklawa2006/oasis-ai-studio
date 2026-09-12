# Point 40 — Version / Audit History Census

**Issue:** #459 Point 40 · **ASM:** AI Studio immutable version / audit history closure  
**Mandatory merge predecessors:** AI Studio PR **#157** (Point 38) → PR **#161** (Point 39)  
**Starting SHA:** `65fdbf046c6056db468d523000d1d3b8b25fe7b1` (Point 39 head)  
**Starting branch:** `cursor/point40-version-audit-history-d71a` (built from Point 39 exact head)  

## Branch ancestry evidence

| Ref | SHA | Relationship |
| --- | --- | --- |
| `origin/main` | `6f8e164` | POINT35 (#147) — ancestor of Point 38 |
| Point 38 head | `bd36a735` | **Mandatory predecessor #1** — POINT38 workflow-state closure (#157) |
| Point 39 head | `65fdbf046` | **Mandatory predecessor #2** — POINT39 correction/resubmission (#161) |
| Point 40 branch | `cursor/point40-version-audit-history-d71a` | Built from `65fdbf046` — **must not merge before #157 and #161** |

```
6f8e164 (main, POINT35)
   └── bd36a735 (POINT38 #157) ← mandatory predecessor #1
          └── 65fdbf046 (POINT39 #161) ← mandatory predecessor #2
                 └── cursor/point40-version-audit-history-d71a (this PR)
```

## Version / audit authority census

### A. Catalogue AI Studio copy drafts (primary governed workflow)

| Identifier | Location | Actor | Timestamp | Predecessor / supersedes | Reason / change metadata | UI surface |
| --- | --- | --- | --- | --- | --- | --- |
| `catalogue_ai_studio_drafts.version_number` | Core table | Contributor on create | `created_at` | Implicit ordinal; explicit via audit | N/A | Studio governance card + Point 40 chain |
| `catalogue_ai_studio_drafts.status` | Core table | Reviewer on approve/reject | `reviewed_at` | Terminal snapshot per version | `rejection_reason` column | Status badge + version chain |
| `catalogue_ai_studio_draft_audit_log` | Core append-only | `actor_id` per row | `created_at` | CREATE_NEW_VERSION `metadata.predecessor_*` (Point 39) | `metadata.rejection_reason`, `previous_version_rejection_reason` | Per-version audit list |
| CREATE_DRAFT / CREATE_NEW_VERSION | Audit `action` | Contributor | `created_at` | `buildPredecessorLinkage` metadata | `correction_kind` | Point 40 read model |
| SUBMIT / APPROVE / REJECT | Audit `action` | Contributor / reviewer | `created_at` | Status transition only | Reject reason in metadata | Point 40 read model |
| SAVE_DRAFT | Audit `action` | Contributor | `created_at` | Same draft row | No secrets in metadata | Point 40 read model |

**Read model (Point 40):** `productVersionHistory.ts` — `buildProductVersionHistory`, fail-closed chain validation  
**Fetch path:** `fetchProductVersionHistory` in `catalogueDraftRepository.ts` — read-only; no new audit authority  
**UI consumer:** `CatalogueProductStudio.tsx` — product version chain + per-version audit; integrity warning on broken chain

### B. Contributor drafts — Approval Inbox

| Draft type | Version identifier | Audit authority | Point 40 treatment |
| --- | --- | --- | --- |
| Product / media / alias / BOM / tag | Core draft row id (no client version_number) | Core RPC + rejection_reason column | **Not absorbed** — separate Core audit tables |
| MOQ / pricing | Central only | Central | Read-only in AI Studio |

**Pure contract reference:** `evaluateContributorCorrection` — documented only; no duplicate ledger

### C. Catalogue versions (publication handoff — Point 54 boundary)

| Identifier | Location | Audit events | Point 40 treatment |
| --- | --- | --- | --- |
| `catalogue_versions.version_number` | Core `catalogue_versions` | `catalogue_sync_events` | **Referenced, not unified** — separate publication domain |
| localStorage fallback | `catalogueVersionStore.ts` | Browser-only | Flagged non-authoritative in Central Sync panel |

### D. Other audit surfaces (out of Point 40 scope)

| Path | Authority | Why excluded |
| --- | --- | --- |
| `/admin/audit` feature flags | Central | Not product workflow version history |
| Category1 import log | Optional `import_logs` | Import staging only |
| Data Correction page | `localStorage` review flags | Product master gaps, not draft versions |
| Operator inbox suggestions | `suggestionAudit.ts` | Sales-order domain |

## Duplicate / unsafe paths identified

| Issue | Risk | Point 40 treatment |
| --- | --- | --- |
| Per-version audit only (no chain) | Operator cannot see predecessor context across versions | Product version chain in read model + UI |
| History inferred from current row state | Stale/mutable presentation | Read model built from drafts + audit rows only |
| Missing CREATE_NEW_VERSION linkage | Broken predecessor chain | `chain_valid=false` + fail-closed UI warning |
| Missing actor on governed actions | Anonymous audit | Chain error — fail-closed |
| Terminal in-place SAVE in audit | Mutable approved/rejected snapshot | Chain error — fail-closed |
| Impossible chronology | Successor before predecessor | Chain error — fail-closed |
| Raw AI payloads in audit metadata | Secret leakage | `stripSecretAuditMetadata` before UI |
| localStorage catalogue versions | Non-authoritative history | Unchanged — explicitly labeled elsewhere |

## Separation from Point 39 / Point 54

| Point | Boundary |
| --- | --- |
| **39** | Correction/resubmission mechanics — predecessor metadata **written** on CREATE_NEW_VERSION |
| **40 (this PR)** | Immutable version/audit history **read model** + presentation — never rewrites audit rows |
| **54** | Publication (`published`/`synced`) — not implemented here |

## This PR closure

| File | Change |
| --- | --- |
| `src/features/productWorkflow/productVersionHistory.ts` | **NEW** — canonical read model, chain validation, metadata safety |
| `src/features/productWorkflow/productVersionHistory.test.ts` | **NEW** — chain, actor/reason, terminal, chronology, stale/current regressions |
| `src/features/catalogueAiStudio/catalogueDraftRepository.ts` | Read helpers: `fetchAllDraftVersions`, `fetchAuditLogsForDraftIds`, `fetchProductVersionHistory` |
| `src/pages/CatalogueProductStudio.tsx` | Version chain + integrity warning; audit via read model summaries |
| `src/features/productWorkflow/productWorkflowState.ts` | Boundary comment — Point 40 implemented |
| `src/features/productWorkflow/productCorrectionContract.ts` | Boundary comment — Point 40 read model |

## Gate matrix (exact-head on Point 39 base)

| Gate | Command | Status |
| --- | --- | --- |
| Unit tests | `npm test` | **PASS** — 898/898 |
| Build | `npm run build` | **PASS** |
| Boundaries | `npm run check:boundaries` | **PASS** (0 violations) |
| Typecheck | `npm run typecheck` | **PASS** |

## Programme gate state

`PR MERGED != Point 40 CLEARED` — dependent on #157 → #161 merge order; rebase onto `main` after both predecessors merge, rerun exact-head gates, request `dineshmutrejabackup-cmd` review, STOP before merge. No production mutation performed in this PR.
