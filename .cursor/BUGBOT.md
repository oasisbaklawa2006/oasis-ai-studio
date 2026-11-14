# Oasis AI Studio — Bugbot review rules

These rules apply to all pull requests in `oasisbaklawa2006/oasis-ai-studio`.
They encode recurring defect classes already caught in prior Bugbot rounds (PRs #80–#84).

## Repo ownership (blocking)

If the PR adds **new** or **modifies existing** files under `supabase/migrations/`, or adds/modifies any `*.sql` file anywhere under `supabase/` that contains DDL/RLS (`CREATE TABLE`, `ALTER TABLE`, `CREATE POLICY`, `ENABLE ROW LEVEL SECURITY`, `CREATE FUNCTION`, `CREATE TRIGGER`), then:

- Add a **blocking** bug titled "Schema ownership violation"
- Body: Database schema and migrations belong in `oasis-supabase-core`, not this frontend repo. Move these changes to `oasis-supabase-core`. See `docs/repo-ownership-guardrails.md`.

If the PR adds **new** or **modifies existing** files under `supabase/functions/`, then:

- Add a **blocking** bug titled "Supabase Functions ownership violation"
- Body: Supabase Edge Functions belong in their own designated backend repository, not this frontend repo. Move these changes to the appropriate backend repository. See `docs/repo-ownership-guardrails.md`.

### One-time Core-origin historical snapshot admission — G5 only (requires prior human governance approval)

This exception is **inactive until this policy change is independently reviewed and merged**. It is not an exception for new Studio backend code. A follow-up PR may be classified as a non-authoritative historical source *synchronization*, rather than backend ownership, **only if all** conditions below are independently verified:

- The **only** `supabase/functions/**` diff is an existing file modified in place at `supabase/functions/_shared/erpInboxBridge/processErpInboundRow.ts`, with no file add, copy, rename or delete.
- The source is byte-identical to **merged, independently approved** Core PR #493 (merge `fb47a9508dad3d676776ae8fe0172b67c8284d71`); destination Git blob is precisely `216a3aec29b8b66caccd2c45a83c40a1747a9345`.
- The previous Studio snapshot Git blob is exactly `911461b637413f3525f04ebcb3b565ea2d670e8f`. This makes the permission expire after the single synchronization: later base blobs do not match.
- The existing independent `Core Backend Authority` guard continues to reject every other added, changed, renamed, deleted, copied or untracked backend path, with seven positive/negative tests run in CI. No schema, migration, RLS, secrets or backend deployment is introduced.
- The real `npm run typecheck:build`, security scanning and all required release checks PASS at the exact head; the nonblocking legacy TypeScript audit alone is not acceptance.
- A **separate independent human CODEOWNER/security review** explicitly approves the follow-up source-sync PR after this governance change is approved; no self-approval or admin bypass.

If **any** condition is missing, outdated, unverifiable or violated, report a **blocking Supabase Functions ownership violation** under the unchanged default rule. Do not automatically extend this one-time exception to other Core files, hashes or future migrations. The canonical Supabase backend and all actual deployments continue to belong exclusively to `oasis-supabase-core`.

## Async request races (blocking)

For changes in `src/pages/**`, `src/components/ProductMediaUploader.tsx`, or `src/features/productAuthority/**`:

If an async effect, fetch, or mutation applies results without checking whether the request was superseded (by product id change, unmount, or a newer fetch), then:

- Add a **blocking** bug titled "Stale async result may apply to wrong product"
- Body: Use `requestRace.ts` helpers (`shouldFetchById`, `isSupersededById`, `isCurrentAsyncRequest`) or an equivalent guard before calling `setState` / updating form state.

## Media authority (blocking)

For changes affecting hero image, `product_media`, or catalogue media display:

- Do not read `hero_image_url` / `image_url` when `product_media` rows exist — authoritative media comes from `mediaAuthorityContract` / `authoritativeMediaAssets`.
- Do not apply fetch/subscription results without checking the product id still matches.
- "Remove as hero" publishes `{ heroUrl: null }` — do not treat that as "no media" or re-fallback to legacy columns.

Flag violations as **blocking** with title "Media authority / staleness regression".

## AI provenance (blocking)

For changes in `src/features/catalogueAiStudio/**` or catalogue draft save/load paths:

- A reload-then-save cycle must not reclassify human-edited fields as AI-generated.
- Respect `lockedHumanEditedFields` / `lockedPreservedFields` in merge and provenance builders.
- Do not gate generation on `readiness.overallLabel` alone — use the dedicated generation gate.

Flag violations as **blocking** with title "AI provenance corruption risk".

## Product edit deep links (blocking)

For changes to `ProductEdit.tsx` tab routing:

- Validate `?tab=` against allowed tabs (`productEditTabs.ts`).
- Reset tab state when the product id in the URL changes (initializer-only seeding is insufficient).

## Catalogue readiness consistency (blocking)

Catalogue Product Studio readiness, work-queue completion %, and displayed sale-type labels must use the same authoritative sources as the Full Editor (media rows, not legacy hero columns; human labels from `SALE_TYPES`, not raw slugs).

## Tests for authority changes (non-blocking → blocking for new modules)

If the PR adds or materially changes logic under `src/features/productAuthority/**` or `src/features/catalogueAiStudio/**` without adding or updating tests in the matching `*.test.ts` file, add a **blocking** bug titled "Missing regression test for authority change".

## Quality gate alignment

Do not weaken existing CI gates: changed-line ESLint errors, failing `npm run test`, `npm run build`, `npm run typecheck`, Trivy critical findings, or `scripts/check-repo-boundaries.sh` must remain blocking.

## Mobile layout (medium)

For new flex rows pairing a `Select` with a long-label `Button`, use `flex-wrap` and `w-full sm:w-auto` so narrow viewports do not overflow horizontally.
