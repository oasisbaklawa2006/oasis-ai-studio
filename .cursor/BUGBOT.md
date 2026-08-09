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
