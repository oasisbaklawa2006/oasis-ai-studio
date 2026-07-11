# Catalogue Product AI Studio Programme — Integrated Evidence Archive

Documentation only. No code, schema, dependency, or CI/CD change. Produced as task #61 of the
autonomous stacked delivery programme, covering the complete PR chain #80 → #81 (A2) → #82 (A3) →
#84 (A4). All GitHub evidence below was re-fetched live via the GitHub API on 2026-07-11 (not
reused from earlier cached session state) immediately before this document was written.

---

## 1. Exact PR chain, branches, bases, final head SHAs

| PR | Milestone | Branch | Base | Base SHA | Final head SHA | State |
|---|---|---|---|---|---|---|
| [#80](https://github.com/oasisbaklawa2006/oasis-ai-studio/pull/80) | Foundation / hardening | `feat/catalogue-product-studio-completion-2026-07-11` | `main` | `a6575f60b8895842623c435d87575f25456f7cd2` | `d3be922457d3f3f054a1dfc4fe6dca352d9c1472` | draft, open, unmerged |
| [#81](https://github.com/oasisbaklawa2006/oasis-ai-studio/pull/81) | A2 — operator cockpit | `feat/catalogue-studio-operator-cockpit-2026-07-11` | PR #80's branch | `d3be922457d3f3f054a1dfc4fe6dca352d9c1472` | `17e6699d10e3381a78a8d51954bf004d834070ae` | draft, open, unmerged |
| [#82](https://github.com/oasisbaklawa2006/oasis-ai-studio/pull/82) | A3 — governed AI content | `feat/catalogue-studio-ai-content-and-localisation-2026-07-11` | PR #81's branch | `17e6699d10e3381a78a8d51954bf004d834070ae` | `ff9e1415f3944e8d0f6ca9622de23fb9119f1dcc` | draft, open, unmerged |
| [#84](https://github.com/oasisbaklawa2006/oasis-ai-studio/pull/84) | A4 — governed media workspace | `feat/catalogue-studio-media-workspace-2026-07-11` | PR #82's branch | `ff9e1415f3944e8d0f6ca9622de23fb9119f1dcc` | `debf7ac20660da52fa7b02761d817b9529ea1042` | draft, open, unmerged |

Verified via `pull_request_read` (`get`) on all four PR numbers immediately before this document
was written: all four report `state: open`, `draft: true`, `merged: false`,
`mergeable_state: clean`, and each PR's `base.sha` exactly matches the prior PR's `head.sha` at the
time of the base PR's most recent push — the stack is contiguous with no gap or divergence.

There is no PR #83 in this chain — Issue #83 (not a PR) is the [Execution Ledger](https://github.com/oasisbaklawa2006/oasis-ai-studio/issues/83).

---

## 2. Complete delivered-scope matrix (A1–A4)

*(A1 is the pre-existing draft/approval workspace this programme builds on — not a PR in this
stack; referenced here only for completeness.)*

| Area | A1 (pre-existing) | A2 (PR #81) | A3 (PR #82) | A4 (PR #84) |
|---|---|---|---|---|
| Draft/approval workflow (save/load/reset/submit/approve/reject, audit log) | ✅ Full, untouched by this programme | Untouched | Untouched | Untouched |
| Product anchor / sticky command bar | Basic anchor | Rebuilt: sticky bar, hero thumbnail, computed "Next:" action | Untouched (tone selector added to Content tab only) | Untouched |
| Product work queue / filters | None | ✅ New: search, status chips, live-patching badges | — | — |
| Five-stage tab structure | 5 tabs, unordered labels | ✅ Relabeled/reordered "1–5" (logic unchanged) | Uses existing tabs | Uses existing tabs |
| AI content generation | None (manual only) | — | ✅ New: governed `oasis-ai-chat` gateway, tone-steered, one-click full draft | — |
| AI provenance (per-field, sticky) | None | — | ✅ New: `AiFieldTracking` (watched/locked), survives reload | — |
| Language/Messaging tab | Fields embedded in Content tab | Relabeled as stage 3 | Untouched | Untouched |
| Media: read-only summary + required-slot checklist | None (used Full Editor only) | ✅ New (PR #80) | Untouched | **Replaced** by real uploader (see below) |
| Media: real upload/hero/approval in Catalogue Studio | Not available (deep-link to Full Editor only) | Not available | Not available | ✅ New: `ProductMediaUploader` embedded directly, same authority as Full Editor |
| Media: mount/staleness correctness | N/A | N/A | N/A | ✅ New: mount-guard + `isCurrentAsyncRequest` guards (5 Bugbot rounds) |
| Image prompt composition | Local per-slot templates existed | Untouched | Untouched | ✅ Extended: optional operator instruction addendum |
| AI image generation/enhancement/background removal/vision | Not available | Not available | Not available | **Confirmed blocked** — no provider exists (see §3) |

---

## 3. Explicit deferred/blocked capabilities and reasons

| Capability | Status | Reason (evidenced, not assumed) |
|---|---|---|
| Highlights/features content field | Blocked | No such column on `catalogue_ai_studio_drafts` — needs a migration (PR #80 delta table) |
| Explicit Hinglish content (distinct from Hindi) | Blocked | Schema has only `hindi_description`; a Hinglish variant needs a new column (PR #82 preflight) |
| Per-channel/audience/tone **variant storage** (multiple stored versions of one field) | Blocked | Schema has one column per channel already; a stored variant matrix needs new columns/table (PR #82 preflight) |
| A2.7 richer destination-card preview (retail/WhatsApp) | Deferred, not dropped | Flagged explicitly in PR #81 to keep that diff reviewable; the existing Export/Copy Bundle Preview tab still provides a read-only preview |
| Autosave on the governance/audit drawer | Not implemented | `saveDraft()` creates a new version whenever the latest draft is `APPROVED`/`REJECTED`; debounced autosave would silently create draft versions behind the operator's back (documented, not added unsafely) |
| AI image generation | Blocked, out of scope | No provider, no endpoint, no env key anywhere in the repo or configured environment; `oasis-ai-chat` (A3's real provider) is text-only; `AIStudio.tsx`'s own roadmap page labels this "Planned" |
| AI image enhancement/editing | Blocked, out of scope | Same — no service exists |
| Background removal | Blocked, out of scope | No service; not even in the roadmap |
| Vision-based product/SKU analysis from a photo | Blocked, out of scope | Roadmap "Planned"; no vision-capable endpoint |
| Media generation-event provenance | Blocked, out of scope | No schema exists, and nothing to have provenance *for* since there's no generation capability |

None of the above were fabricated as "planned" or "coming soon" features beyond what the repo's
own `AIStudio.tsx` roadmap page already states.

---

## 4. Every Bugbot / independent-audit finding, mapped to fixing commit and regression evidence

All thread IDs and resolution states below were re-fetched live via `pull_request_read`
(`get_review_comments`) immediately before this document was written.

### PR #80 (12 Bugbot findings, 12/12 threads resolved)

| # | Finding | Severity | Fixing commit (head at time of fix) | Regression evidence |
|---|---|---|---|---|
| 1 | Sale type shows internal slug (e.g. `b2b_horeca`) instead of human label | Medium | `726852d` | `catalogueSaleTypeLabel.ts` + test |
| 2 | Anchor hero ignores media authority (anchor vs. Media tab disagree) | Medium | `726852d` | `catalogueMediaSummary.ts` + test |
| 3 | Hero anchor/readiness mismatch (`computeCatalogueProductReadiness` only checked legacy column) | Medium | `4ea34e2` | readiness/hero unification |
| 4 | Full Editor ignores `?tab=` after mount (route param change didn't re-apply) | Medium | `93ca283` | `productEditTabs.ts` + test |
| 5 | Media slots ignore legacy hero fallback, disagreeing with anchor | Medium | `93ca283` | `catalogueMediaSlots.ts` + test |
| 6 | Hero preview ignores approval authority (fallback fired even with unapproved rows) | Medium | `7b2bd0a` | `catalogueMediaSummary.ts` authority fix |
| 7 | Same deep link (repeat click) ignored by Full Editor tab state | Medium | `7b2bd0a` | `location.key`-keyed re-apply |
| 8 | Media fetch stuck loading forever on promise rejection (no `.catch`) | Medium | `7b2bd0a` | `.catch` added with cancellation guard |
| 9 | Readiness reuses legacy hero URL even when `product_media` rows exist unapproved | Medium | `61dfec8` | readiness hero-source fix |
| 10 | Stale media flash on product switch (previous product's rows painted for one frame) | Medium | `f25a635` | synchronous render-phase reset |
| 11 | Legacy hero shown while loading (loading state used a spurious zero-rows fallback) | Medium | `8396e24` | `catalogueMediaLoadState.ts` state machine |
| 12 | Full Editor accepts an invalid `?tab=` value with no fallback | Low | `8396e24` | validated fallback to a known tab |

**Final validation (head `d3be922`):** `check:boundaries` 0 new violations · `typecheck` clean ·
`typecheck:build` 128 pre-existing errors, 0 new · `build` succeeds · `test` 579/579 passing ·
`git diff --check` clean · `package-lock.json` unchanged.

### PR #81 (2 Bugbot findings, 2/2 threads resolved)

| # | Finding | Severity | Fixing commit | Regression evidence |
|---|---|---|---|---|
| 1 | Work-queue draft status stale after save/submit/approve/reject (no live patch) | Medium | (final head `17e6699`) | queue status map patched immediately on every mutation |
| 2 | Queue readiness/hero ignored approved `product_media`, disagreeing with sticky bar | Medium | (final head `17e6699`) | bulk hero-only `product_media` read added |

**Final validation (head `17e6699`):** `check:boundaries` 0 new · `typecheck` clean ·
`typecheck:build` 128 pre-existing, 0 new · `build` succeeds · `test` 593/593 passing (+14 new) ·
`git diff --check` clean.

### PR #82 / A3 (8 Bugbot findings across 5 rounds + 1 independent-audit finding, 8/8 threads resolved)

| # | Round | Finding | Severity | Fixing head | Regression evidence |
|---|---|---|---|---|---|
| 1 | 1 | AI-generation gate keyed off `overallLabel` (any missing category), not just identity | High | `03bb869` | `isAiGenerationBlockedByIdentity()` + test proving identity can pass while `overallLabel` is "Not ready" |
| 2 | 1 | Provenance compared final draft to full AI result, misclassifying preserved fields as "edited after" | Medium | `03bb869` | `buildAiGenerationProvenance` classifies only fields AI actually applied + test |
| 3 | 1 | Reset left stale AI baseline/tone in place | Medium | `03bb869` | shared `clearAiGeneration()` for reset + product switch |
| 4 | 1 | AI merge captured `editor` in a stale closure, discarding concurrent typing | Medium | `03bb869` | merge moved inside React functional state update |
| 5 | 2 | Stale AI response after draft reset could still resolve and undo the reset | High | `b293314` | `aiGenerationRequestIdRef` invalidation guard + test |
| 6 | 2 | Saved AI provenance lost on reload (draft hydration never restored baseline/tone) | High | `b293314` | `restoreAiGenerationState()` / `readPersistedAiGenerationProvenance()` + test |
| 7 | 3 | Preserved-only provenance (all-fields-preserved run) discarded as "absent" | Medium | `026b5cc` | presence keyed on `service` marker, not array emptiness + test |
| 8 | 3 | Stale guard left Generate button stuck disabled | Low | `026b5cc` | resets `aiGenerationState` to `"idle"` on the dead-end path |
| 9 | Independent audit (not Bugbot) | Reload-then-save silently reclassified a human-edited field back to AI-generated | — | `ff9e141` | full `AiFieldTracking` (watched/locked) redesign + 4-scenario end-to-end regression suite reproducing the exact reported defect |

**Final validation (head `ff9e1415f3944e8d0f6ca9622de23fb9119f1dcc`):** `check:boundaries` 0 new ·
`typecheck` clean · `typecheck:build` 128 pre-existing, 0 new · `lint` 0 new · `build` succeeds ·
`test` 634/634 passing (+10 new this round: `advanceAiFieldTracking` tests, a locked-field
`mergeAiGeneratedContent` test, and a 4-scenario end-to-end "reload-and-save cycle" suite) ·
`git diff --check` clean.

### PR #84 / A4 (5 Bugbot findings across 5 rounds, 5/5 threads resolved)

| # | Round | Finding | Severity | Fixing head | Regression evidence |
|---|---|---|---|---|---|
| 1 | 1 | Uploader's own mount-triggered `onMediaChange` forced page media back into "loading", clearing hero/readiness | Medium | `8ea5f3d` | `catalogueMediaUploaderMountGuard.ts` one-shot mount-call absorption + 8 tests |
| 2 | 2 | Stale callback after unmount (uploader never cancelled its in-flight `load()`) | Medium | `96d87d2` | guard refuses to forward while nothing mounted + 3 new tests |
| 3 | 3 | Stale callback survives a product switch while the Media tab stays open | Medium | `24e1c82` | root fix moved into `ProductMediaUploader.tsx` itself (`isCurrentAsyncRequest`, reused from `ProductEdit.tsx`) — the external guard structurally couldn't distinguish this case |
| 4 | 4 | Null-hero race during page load could auto-promote an upload to hero over an existing approved one | Medium | `debf7ac` | uploader mount deferred until the page's own media fetch finishes loading |
| 5 | 4 | Success toast ("Hero cleared"/"Photo deleted") shown after a stale skip, misleading the operator | Low | `debf7ac` | toasts gated on the same staleness check as the callback suppression |

Round 5 (final, on head `debf7ac`): Bugbot check run `completed`/`success`, **zero new findings**.

**Final validation (head `debf7ac20660da52fa7b02761d817b9529ea1042`):** `check:boundaries` 0 new ·
`typecheck` clean · `typecheck:build` 128 pre-existing (confirmed identical via `git stash` diff
each round), 0 new · `lint` 0 new (pre-existing warnings confirmed identical each round) · `build`
succeeds · `test` 650/650 passing (+16 new: 5 for `composeCatalogueImagePrompt`, 11 for the mount
guard) · `git diff --check` clean.

### Programme totals

- **28 findings total** across the 4 PRs (12 + 2 + 8 + 5 = 27 formal Bugbot review threads, + 1
  independent-audit finding on PR #82 relayed via PR comment, not a formal Bugbot thread).
- **27/27 formal review threads confirmed `is_resolved: true`** via a live API re-check across all
  four PRs immediately before this document was written. **Zero unresolved threads anywhere in the
  stack.**
- The 1 independent-audit finding was verified directly against source before fixing and closed
  with a dedicated 4-scenario end-to-end regression suite reproducing the exact reported defect.

---

## 5. Final tests, typechecks, builds, boundary checks, lint, diff-hygiene — per milestone

| Milestone | Head | Tests | typecheck (`tsc --noEmit`) | typecheck:build (`tsc -b --force`) | lint | build | boundaries | diff-check |
|---|---|---|---|---|---|---|---|---|
| PR #80 | `d3be922` | 579/579 | clean | 128 pre-existing, 0 new | not separately itemized in PR body (repo-wide baseline predates this PR's lint-tracking convention) | succeeds | 0 new violations | clean |
| PR #81 | `17e6699` | 593/593 (+14) | clean | 128 pre-existing, 0 new | not separately itemized (same as above) | succeeds | 0 new violations | clean |
| PR #82 | `ff9e141` | 634/634 (+41 vs. #81) | clean | 128 pre-existing, 0 new | 0 new findings in touched files | succeeds | 0 new violations | clean |
| PR #84 | `debf7ac` | 650/650 (+16 vs. #82) | clean | 128 pre-existing, 0 new | 0 new findings in touched files | succeeds | 0 new violations | clean |

The `128 pre-existing errors, 0 new` result for `typecheck:build` was independently re-verified at
every single Bugbot-fix round within PR #84 (not just once per PR) via `git stash` diffing against
the pre-change file, confirming byte-for-byte the same pre-existing errors at shifted line numbers
— see Execution Ledger checkpoints 3–6.

`package-lock.json` unchanged across the entire programme — **zero new dependencies** introduced at
any point in any of the 4 PRs.

---

## 6. CI / Vercel status and why some checks structurally don't run on stacked PRs

| PR | `quality` (GH Actions) | `Enforce ... repo ownership boundaries` (GH Actions) | Cursor Bugbot | Vercel Preview |
|---|---|---|---|---|
| #80 | ✅ success | ✅ success | ✅ success | ✅ Ready |
| #81 | *(does not run — see below)* | *(does not run)* | ✅ success | ✅ Ready |
| #82 | *(does not run)* | *(does not run)* | ✅ success | ✅ Ready |
| #84 | *(does not run)* | *(does not run)* | ✅ success | ✅ Ready |

**Why `quality`/boundaries don't run on #81, #82, #84:** both GitHub Actions workflows
(`.github/workflows/release-quality-gate.yml` and `repo-boundaries.yml`) are configured with
`on: pull_request: branches: [main]`. Since PR #81/#82/#84 each have a base branch that is *not*
`main` (they're stacked on the previous PR's branch), GitHub structurally never triggers these
workflows for them — this is a pre-existing CI-config characteristic verified by reading the
workflow YAML directly, not a defect introduced by this programme. **The equivalent commands were
run locally on every touched file at every round** (see §5) as the best available substitute; both
workflows will run normally once this stack is eventually rebased onto (or merged into) `main`.

PR #80's base *is* `main`, so both workflows ran natively there and passed.

---

## 7. Schema, dependency, environment, CI/CD, production-mutation confirmation

Verified by direct inspection of the diff and file list of all 4 PRs (via `pull_request_read`
`get_files` at PR-creation time, cross-checked against each PR's own "Validation"/"Non-deliverables"
section, which was itself produced from real command output, not asserted):

- **No `supabase/migrations/*.sql` files touched or added** in any of the 4 PRs.
- **No RLS policy changes.**
- **No changes to any Central/Trace repository** (this programme is scoped entirely to
  `oasis-ai-studio`).
- **No production data mutated** — no `execute_sql`/write operation was ever run against the
  production Supabase project from this session; all work is local repo edits + git push.
- **`package-lock.json` unchanged** across all 4 PRs — zero new npm dependencies.
- **No new environment variables added** — `VITE_MEDIA_GOVERNANCE_MODE` (referenced throughout A4)
  is a pre-existing variable, not introduced by this programme.
- **No CI/CD workflow file changed** — the `.github/workflows/*.yml` files themselves are untouched;
  only their *scoping behavior* on stacked PRs is documented (§6), not altered.
- **No repository settings changed** (branch protection, secrets, webhooks, Actions permissions).

---

## 8. Governance/authority verification

| Authority | Verification |
|---|---|
| **Product Master (`products` table) protection** | The entire programme operates on `catalogue_ai_studio_drafts` (+ its audit log) as the working surface. The only direct `products` table writes anywhere in this stack are the pre-existing, unchanged hero-image write path inside `ProductMediaUploader.tsx` (`applyDirectHeroAuthority`, `removeAsHero`, `remove`) — the same authority Full Editor already used before this programme, gated by the same role check (`useCatalogueMediaWriteMode`). No new field on `products` is ever written by AI generation, content drafting, or any A2/A3/A4 code. |
| **Draft workflow (save/load/reset/submit/approve/reject)** | Confirmed untouched in PR #80/#81/#82/#84 bodies — same buttons, same guards, same disabled states throughout. A2 only relocated the audit-history *display* behind a collapsible toggle; the underlying write path is identical. |
| **AI provenance** | A3 records `service`/`tone`/per-field classification into the pre-existing `source_snapshot` jsonb column — no schema change. Per-field tracking (`AiFieldTracking`: `watchedFields` vs. sticky `lockedHumanEditedFields`/`lockedPreservedFields`) was hardened across 5 Bugbot rounds + 1 independent audit specifically to prevent a reload-and-save cycle from ever silently corrupting this audit trail (§4, PR #82). |
| **Media authority (approval, hero designation)** | A4 embeds the exact same `ProductMediaUploader` component Full Editor already used — same `mediaAuthorityContract.ts`/`mediaReadinessEngine.ts` single source of truth, same `product_media`/Storage bucket authority. **Zero new authority code.** The 5 A4 Bugbot rounds (§4) all concerned *timing/staleness* of when the existing authority is read/refreshed, never a change to the authority rules themselves. |
| **Role/write-mode boundaries** | `useCatalogueMediaWriteMode(roles)` (pre-existing) still gates: direct write for owner/admin/product_manager, draft-submission-for-approval for contributors, read-only otherwise. Confirmed unchanged — A4 only changes *which component* renders the UI for this, not the write-mode logic itself. |
| **Approvals** | Approve/reject-with-reason on drafts is the pre-existing A1 workflow, untouched. Media approval is the pre-existing `product_media.status` authority, untouched. |

---

## 9. Remaining risks, waivers, and limitations

- **No authenticated browser smoke test has been performed in this session, at any point in the
  programme.** Every route in this app is behind `ProtectedRoute` (real Supabase auth), and this
  session has never held non-production credentials. This is waived at each individual PR per the
  autonomous delivery programme's own terms, explicitly deferred to **one final integrated
  authenticated smoke test by the owner** — not yet performed. **The programme must not be
  considered production-ready until that smoke test passes.**
- **AI generation network calls were never live-exercised in this session** (A3's `oasis-ai-chat`
  gateway, A4's local prompt composition is pure-function and doesn't need live exercise). The
  gateway code is written to match the real, pre-existing wire format used by
  `enrichSuggestionsWithAi()` in Fast Create, and its parsing/validation logic is unit-tested
  against synthetic SSE payloads — but an actual live call has not been observed to succeed from
  this session.
- **A pre-existing repo-wide TypeScript narrowing quirk** (non-strict `tsconfig` causes
  `if (!result.ok)` to fail to narrow a discriminated union under `tsc -b`) is present today at
  `pilotReadiness.ts:174` and was deliberately *not* fixed — the correct idiom
  (`result.ok === false`) was used in all new code instead, per the "no config changes without
  approval" rule. Documented here so it is not mistaken for a defect this programme introduced.
- **CI's `quality`/boundaries GitHub Actions workflows have never run on PR #81, #82, or #84**
  (§6) — only local-command equivalents. They will run for the first time when this stack is
  rebased onto/merged into `main`; a genuinely clean CI run for these two workflows against the
  full stacked diff has therefore not yet been observed on GitHub itself.
- **Deferred schema items** (§3: Hinglish column, per-channel variant storage, highlights/features
  field) remain unimplemented and would each require a migration + explicit owner approval before
  any future work proceeds on them.
- **No PR in this stack has been merged.** All four remain draft and unmerged, per standing
  governance, pending the owner's smoke test and explicit merge approval.

---

## 10. Owner-facing authenticated smoke-test checklist (final integrated preview)

**Preview URL:** https://oasis-ai-studio-git-feat-7125f4-oasisbaklawa2006-6222s-projects.vercel.app
(auto-redeploys on every push to PR #84's branch; currently serving commit `debf7ac`)

Sign in with a real account, then walk through:

1. **Navigate** to Catalogue Product AI Studio. Confirm the **work queue** loads with search +
   status filter chips (All / Recently Worked On / Needs Product Truth / Ready for Generation /
   Draft / Needs Human Review–Ready for Approval / Rejected / Approved), each row showing a status
   badge, completion %, and blocker count.
2. **Select a product.** Confirm the queue collapses into a compact sticky command bar (hero
   thumbnail, name, short SKU, packaging, sale type, build %, version/status, a computed "Next:"
   action).
3. **Stage 1 — Complete Truth.** Confirm this is unchanged Product Truth behavior (out of this
   programme's scope).
4. **Stage 2 — Content.** Click **"Generate Complete Catalogue Draft"** with a tone selected.
   Confirm every content field populates from a real AI call (not instant/fake), and an **"Edited"**
   badge appears only on fields you then manually change.
5. **Reset**, then generate again. Confirm no stale content or stuck "generating" button.
6. **Save**, reload the page (or reopen the same product), confirm previously AI-generated fields
   still show correctly and a field you'd manually edited stays marked as edited — **not**
   reverted to "AI-generated."
7. **Stage 3 — Languages & Channels.** Confirm Hindi description + WhatsApp draft message fields
   appear here only, with copy stating the workflow is informational/non-blocking and WhatsApp
   "approval workflow not active."
8. **Stage 4 — Media.** Confirm the **real uploader** (gallery/camera/URL, hero designation) is
   embedded directly — no more deep-link-out to Full Editor required for a basic upload. Upload a
   photo, mark as hero, confirm the sticky bar / Build Meter update to match.
9. On a product **without** any approved hero, upload one and confirm no flicker or briefly-wrong
   hero state appears immediately after selecting the product or switching products while on the
   Media tab.
10. Enter an **optional prompt instruction** (e.g. "darker background") on any image-prompt block
    and click **"Compose from Product Truth."** Confirm the composed text includes your instruction
    as a labeled addendum, and that no image is actually generated (text only).
11. **Stage 5 — Preview & Approval.** Submit the draft for approval (or approve directly, if your
    role allows), confirm the existing approve/reject-with-reason workflow behaves exactly as
    before this programme.
12. Use **browser Back/Forward** after selecting a product and switching tabs — confirm the
    selected product and active tab restore correctly at each step.
13. Click a **missing-field chip** to deep-link into the Full Editor, then click a different deep
    link while already on that page — confirm the tab switches correctly both times, including a
    repeat click of the same link.

If every step above behaves as described, the programme is ready for the owner's merge decision.
If any step fails, stop and report the specific step and observed behavior — do not merge.

---

## 11. Safe merge plan (correct order, with rebase/re-check after each step)

**Do not execute any step below without explicit owner approval — this section is a plan, not an
authorization.**

1. **Owner performs the smoke test above** against PR #84's preview. Only proceed past this point
   once it passes.
2. **Merge PR #80 into `main`.**
   - After merge, PR #81's base (`d3be922...`) is now part of `main`'s history, so no rebase is
     structurally required for #81 — but re-run `get_check_runs`/`get_review_comments` on #81 to
     confirm GitHub hasn't surfaced any new conflict or check regression from the merge.
   - GitHub Actions `quality`/boundaries will now run natively on PR #81 for the first time (its
     base is still PR #80's branch, not `main`, until #81 itself is retargeted or merged — if
     retargeting PR #81's base to `main` is desired, do that explicitly and re-verify).
3. **Merge PR #81 into `main`** (or into whatever #81's base now resolves to). Re-run local
   validation (`typecheck:build`, `check:boundaries`, `lint`, `vitest run`, `build`) on the
   post-merge tree before proceeding, even though it passed pre-merge — a merge can introduce
   conflicts invisible to a stacked diff view.
4. **Merge PR #82 into `main`** (same pattern: confirm checks, re-run local validation on the
   merged tree).
5. **Merge PR #84 into `main`** last.
6. **After each merge**, re-fetch `get_check_runs` and `get_review_comments` for every
   *remaining* open PR in the stack — a merge can change a downstream PR's diff or mergeable_state.
   Do not proceed to the next merge if any check goes red or a previously-resolved thread reopens.
7. Only after PR #84 is merged does `main` contain the complete, integrated A1–A4 feature set.

This order (#80 → #81 → #82 → #84) is mandatory — merging out of order would either fail (GitHub
blocks merging a PR whose base isn't `main`) or silently drop intermediate history.

---

## 12. Rollback and post-merge production-verification checklist

**Rollback (if a merged PR proves defective):**
- Since no schema/migration ever shipped in this programme, rollback is a pure code revert — no
  data migration to reverse.
- `git revert` the merge commit for the specific PR found defective (revert the most recently
  merged first if multiple are implicated), push, and redeploy.
- No production data was ever mutated by this programme's own actions (see §7), so no data
  restoration step is needed — only the code needs reverting.
- If a defect is isolated to A4 (media) but A2/A3 (already merged) are sound, only PR #84's merge
  commit needs reverting; A2/A3 do not need to be touched.

**Post-merge production verification (after the full stack lands on `main`):**
1. Confirm the production Vercel deployment (main branch) builds and deploys successfully.
2. Re-run the full owner smoke-test checklist (§10) against the **production** URL, not just the
   preview.
3. Spot-check that `products` table hero/catalogue-ready fields for a handful of real products are
   unchanged from before the merge (no unintended mutation).
4. Confirm `catalogue_ai_studio_drafts`/audit-log rows for a few real drafts are intact and their
   `source_snapshot.ai_generation` provenance (if any) reads correctly.
5. Confirm the GitHub Actions `quality` and repo-boundaries workflows both show green on `main`
   post-merge (they will run natively now that everything is on `main`).
6. Monitor Vercel runtime logs/errors for the first real-traffic window after deploy for any
   unexpected exception tied to the new Media tab or AI generation call path.

---

## 13. Links

- PR #80: https://github.com/oasisbaklawa2006/oasis-ai-studio/pull/80
- PR #81 (A2): https://github.com/oasisbaklawa2006/oasis-ai-studio/pull/81
- PR #82 (A3): https://github.com/oasisbaklawa2006/oasis-ai-studio/pull/82
- PR #84 (A4): https://github.com/oasisbaklawa2006/oasis-ai-studio/pull/84
- Execution Ledger — Issue #83: https://github.com/oasisbaklawa2006/oasis-ai-studio/issues/83

---

*This document is documentation only — it does not alter any application behavior, schema,
dependency, or CI/CD configuration. Committed to PR #84's branch per instruction, since PR #84 is
the final stacked PR in this chain and remains draft and unmerged.*
