# POINT 41 — Media Workspace Authority Census

**Work item:** Central #459 Point 41 (Media workspace)  
**Repository:** `oasis-ai-studio` (AI/knowledge plane only)  
**Baseline:** `main` @ work start (2026-09-03)  
**Branch:** `cursor/point41-media-workspace-closure-0890`  
**Out of scope:** Point 29 PR #135 (`/products/:id/media` route), Point 30 PR #138 (aliases authority), Core migrations, production deploy

## Classification

| Area | Status | Notes |
| --- | --- | --- |
| Media Library (`/media`) | **IN PROCESS → closure delta** | Upload/edit/review paths exist; this PR hardens fail-closed validation and approval badges |
| Media Review (`/media/review`) | **GAP CLOSED (client)** | SCREEN #41 governance desk added |
| Product media tab (`ProductEdit` → media) | **Evidence on main** | `ProductMediaUploader.tsx` — not modified in this PR |
| Approval Inbox (`/approvals`) | **Evidence on main** | Generic draft desk includes media — unchanged |
| Storage authority | **Core dependency** | Bucket `product-media`; client mirrors limits in `mediaDraftBoundary.ts` |
| Live storage UAT | **Remaining gate** | Physical camera / live bucket probe not evidenced on this HEAD |

## Write-path census

| Surface | Write mode | Persistence | Review path |
| --- | --- | --- | --- |
| `/media` | `useCatalogueMediaWriteMode` → direct / draft / readonly | `product_media` insert + optional `catalogue_media_submissions` draft | `/media/review` or `/approvals` |
| `ProductMediaUploader` | Same boundary | `productMediaPersistence` + `productMediaMutationAuthority` | Draft → approval RPCs |
| `mediaDraftBoundary` | Staging vs direct paths | Storage upload + draft submit | `submitMediaCatalogueDraft` |

## API / table authority (read-only census)

| Table / RPC | Owner | AI Studio role |
| --- | --- | --- |
| `product_media` | Shared DB | Insert/read via Supabase client; no migration in this PR |
| `catalogue_media_submissions` | Catalogue draft plane | Submit + list for review |
| `approve_catalogue_media_submission` | Core RPC | Reviewer approve |
| `reject_catalogue_media_submission` | Core RPC | Reviewer reject |
| Storage `product-media` | Core bucket policy | Upload via `uploadMediaFileToStorage` |

## This PR closure delta (smallest AI-Studio-owned)

1. **`/media/review`** — media-only governance desk with payload-derived previews (no invented product facts).
2. **`Media.tsx`** — `validateMediaFile` before storage (fail-closed MIME/size); explicit approval-state badges on library cards.
3. **`mediaLibraryDisplay` / `mediaReviewDesk`** — shared display and desk helpers with unit tests.
4. **Nav** — Media Review link for catalogue reviewers (mirrors Approval Inbox gating).

## Remaining gates (not broadened)

- **Live storage UAT:** see `docs/programme/POINT41_MEDIA_LIVE_STORAGE_UAT_CHECKLIST.md` — bucket reachability, camera capture on physical device, production RPC smoke. **Not evidenced on software HEAD.**
- **Point 29:** dedicated `/products/:id/media` deep route (separate work item).
- **Core:** bucket enforcement migration in production Supabase.

## Safety

- No schema migration or production mutation from this PR.
- No changes to Point 29 #135 or Point 30 #138 authority surfaces.
