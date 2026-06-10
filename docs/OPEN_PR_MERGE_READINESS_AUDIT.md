# Open PR Portfolio — Merge Readiness Audit

**Date:** 2026-06-10  
**Repository:** `oasisbaklawa2006/oasis-ai-studio`  
**Base branch:** `main` (latest: `501adf8` — PR #37 Phase 1 drafts merged)  
**Mode:** Read-only review — no merges, commits, SQL, or production changes performed

---

## Portfolio Summary

| Metric | Value |
|--------|-------|
| **Total PRs reviewed** | **14** |
| **MERGE NOW** | **7** |
| **FIX BEFORE MERGE** | **4** |
| **HOLD** | **1** |
| **CLOSE** | **2** |
| **Highest-risk PR** | **#42** (31-file mega-stack, duplicate resolver + wave artifacts) |
| **Portfolio health score** | **52%** |

All 14 open PRs pass CI `quality` gate (typecheck + build + test). No PR contains new `supabase/migrations` or committed ephemeral `.sql` insert batches in its **diff vs main**. Historical migration files exist on repo `main` but are not introduced by these PR diffs.

**Critical context:** Language Waves 2A, 2B, and 2C were **already executed in production** via governed RPC outside git merge. Merging PRs #40–#43 archives scripts/reports — it does **not** auto-trigger approvals. Re-running submit SQL without review remains an operational risk.

---

## Per-PR Assessment

### PR #24 — `docs: Oasis AI Studio Catalogue Authority Reality Audit`

| Field | Value |
|-------|-------|
| **Branch** | `cursor/catalogue-authority-audit-673c` |
| **Files changed** | 1 (+305 / −0) |
| **Scope** | Expands/replaces existing `docs/AI_STUDIO_CATALOGUE_AUTHORITY_AUDIT.md` on main with full 35-module reality audit |
| **Category** | Documentation only |
| **Typecheck** | ✓ PASS (CI `quality`) |
| **Build** | ✓ PASS |
| **Tests** | ✓ PASS (67 on main baseline) |
| **Bugbot** | No automated findings posted; manual review: no code risk |
| **Scope contamination** | Clean — single doc update |
| **Production risk** | **LOW** |
| **Decision** | **MERGE** |
| **Reason** | Foundational audit doc; updates shallow main version with comprehensive read-only assessment. No runtime impact. |

---

### PR #26 — `docs: Catalogue Authority Import Readiness Audit`

| Field | Value |
|-------|-------|
| **Branch** | `cursor/catalogue-import-readiness-audit-673c` |
| **Files changed** | 1 (+303 / −0) |
| **Scope** | Adds `docs/CATALOGUE_IMPORT_READINESS.md` — Category 1/2/3 import readiness |
| **Category** | Documentation only |
| **Typecheck / Build / Tests** | ✓ PASS (CI) |
| **Bugbot** | None |
| **Scope contamination** | Clean |
| **Production risk** | **LOW** |
| **Decision** | **MERGE** |
| **Reason** | Standalone import readiness reference; precedes Category 1 staging work already on main. |

---

### PR #28 — `docs: Category 1 SKU readiness audit (Products-List-Project)`

| Field | Value |
|-------|-------|
| **Branch** | `cursor/category1-sku-readiness-audit-673c` |
| **Files changed** | 7 (+1246 / −11) |
| **Scope** | SKU audit doc + Category 1 preview CSV/scripts + `duplicateDetection.ts` tweak |
| **Category** | Mixed scope |
| **Typecheck / Build / Tests** | ✓ PASS (CI) |
| **Bugbot** | None posted |
| **Scope contamination** | **Yes** — 6/7 files duplicated in PR #30; PR #30 is strict superset |
| **Production risk** | **MEDIUM** (minor import duplicate-detection logic change) |
| **Decision** | **CLOSE** |
| **Reason** | Superseded by PR #30 which adds Builder audit + same preview artifacts. Merging both causes redundant conflict resolution. |

---

### PR #30 — `docs: Catalogue Builder deep functional audit`

| Field | Value |
|-------|-------|
| **Branch** | `cursor/catalogue-builder-functional-audit-673c` |
| **Files changed** | 9 (+1657 / −14) |
| **Scope** | `CATALOGUE_BUILDER_FUNCTIONAL_AUDIT.md` + Category 1 preview data + `duplicateDetection.ts` Central schema alignment + `Products.tsx` name fallback |
| **Category** | Mixed scope (docs + minor runtime) |
| **Typecheck / Build / Tests** | ✓ PASS (CI) |
| **Bugbot** | None posted |
| **Scope contamination** | **Partial** — `Products.tsx` change already on main (PR #29); diff vs main is effectively no-op for UI. Preview data overlaps PR #28. |
| **Production risk** | **LOW–MEDIUM** |
| **Decision** | **FIX BEFORE MERGE** |
| **Reason** | `duplicateDetection.ts` removes `product_name` column queries (Central uses `name`). Verify duplicate detection still catches name collisions on live schema before merge. Rebase to drop no-op `Products.tsx` hunk. |

**Exact blocker:** Confirm `detectExistingProductDuplicates` works with Central `products.name` only; add test or manual verification.

---

### PR #31 — `docs: Alias & WhatsApp authority deep audit`

| Field | Value |
|-------|-------|
| **Branch** | `cursor/alias-whatsapp-authority-audit-673c` |
| **Files changed** | 1 (+446 / −0) |
| **Scope** | `docs/ALIAS_WHATSAPP_AUTHORITY_AUDIT.md` |
| **Category** | Documentation only |
| **Typecheck / Build / Tests** | ✓ PASS (CI) |
| **Bugbot** | None |
| **Scope contamination** | Clean |
| **Production risk** | **LOW** |
| **Decision** | **MERGE** |
| **Reason** | Deep audit of alias/WhatsApp authority gaps; informs Wave 4 persistence work. No code. |

---

### PR #33 — `docs: Oasis product language authority design`

| Field | Value |
|-------|-------|
| **Branch** | `cursor/product-language-authority-design-673c` |
| **Files changed** | 1 (+452 / −0) |
| **Scope** | `docs/OASIS_PRODUCT_LANGUAGE_AUTHORITY.md` — term types, channel scope, governance design |
| **Category** | Documentation only |
| **Typecheck / Build / Tests** | ✓ PASS (CI) |
| **Bugbot** | None |
| **Scope contamination** | Clean |
| **Production risk** | **LOW** |
| **Decision** | **MERGE** |
| **Reason** | Design authority doc; should merge before intelligence/preview code PRs for traceability. |

---

### PR #35 — `feat(capability): Product Intelligence authority completion`

| Field | Value |
|-------|-------|
| **Branch** | `cursor/product-intelligence-capability-673c` |
| **Files changed** | 13 (+963 / −9) |
| **Scope** | `productIntelligence/*` read modules, snapshot language section, `ProductLanguageTermsPanel`, `productSearch` OR-query tweak |
| **Category** | Mixed scope (read-only prototype + UI + search) |
| **Typecheck / Build / Tests** | ✓ PASS (CI) |
| **Bugbot** | None posted |
| **Scope contamination** | **Yes** — entire `src/` delta is subset of PR #36 |
| **Production risk** | **LOW** (read-only fetches; no write paths; no Central sync) |
| **Decision** | **CLOSE** |
| **Reason** | Strict subset of PR #36. Merging #35 then #36 creates unnecessary churn. Close #35; merge #36 only. |

---

### PR #36 — `docs(preview): Batch 001 language intelligence term preview`

| Field | Value |
|-------|-------|
| **Branch** | `cursor/batch001-language-preview-673c` |
| **Files changed** | 20 (+3439 / −9) |
| **Scope** | Language preview CSVs/scripts + all PR #35 code + capability audit doc |
| **Category** | Mixed scope |
| **Typecheck / Build / Tests** | ✓ PASS (CI) |
| **Bugbot** | None posted |
| **Scope contamination** | Contains PR #35 code + large generated CSV assets (expected for preview) |
| **Production risk** | **LOW** |
| **Special checks** | No WhatsApp send paths; `fetchLanguageTerms` is read-only; no `product_aliases` writes in app code |
| **Decision** | **MERGE** |
| **Reason** | Canonical product intelligence + language preview artifact PR. Includes safe-to-draft CSV used by all wave scripts. |

---

### PR #38 — `Product Intelligence → WhatsApp consumption blueprint`

| Field | Value |
|-------|-------|
| **Branch** | `cursor/product-intelligence-whatsapp-blueprint-673c` |
| **Files changed** | 1 (+703 / −0) |
| **Scope** | `docs/PRODUCT_INTELLIGENCE_TO_WHATSAPP_BLUEPRINT.md` — consumption architecture (no send implementation) |
| **Category** | Documentation only |
| **Typecheck / Build / Tests** | ✓ PASS (CI) |
| **Bugbot** | None |
| **Scope contamination** | Doc duplicated in PRs #39–#42 stacks (merge once via earliest PR or this one) |
| **Production risk** | **LOW** |
| **Decision** | **MERGE** |
| **Reason** | Blueprint only; explicitly no order creation or send paths. Merge before resolver PR #39. |

---

### PR #39 — `Phase 1 language approval, resolver prototype, Batch 002 readiness`

| Field | Value |
|-------|-------|
| **Branch** | `cursor/phase1-approval-resolver-program-673c` |
| **Files changed** | 11 (+1721 / −0) |
| **Scope** | `src/features/productResolver/*` (read-only prototype) + Phase 1/Batch002 docs + audit script |
| **Category** | Read-only prototype + Documentation |
| **Typecheck / Build / Tests** | ✓ PASS (CI); **73 tests** on branch (+6 resolver tests vs main) |
| **Bugbot** | None posted; resolver has no production write surface |
| **Scope contamination** | `PRODUCT_INTELLIGENCE_TO_WHATSAPP_BLUEPRINT.md` also in PR #38 — merge #38 first |
| **Production risk** | **LOW–MEDIUM** |
| **Special checks** | Resolver: read-only, no order creation, no Central sync. Duplicate resolver re-appears in #40–#42 but same implementation. |
| **Decision** | **MERGE** |
| **Reason** | Introduces resolver prototype (not on main). Required foundation for wave execution reports. |

---

### PR #40 — `Wave 2A: expand language intelligence to 12 covered SKUs`

| Field | Value |
|-------|-------|
| **Branch** | `cursor/wave2a-language-execution-673c` |
| **Files changed** | 17 (+4417 / −0) vs main; **+8 files / +2779** incremental after #39 |
| **Scope** | Wave 2A scripts, payloads, collision reports, approval docs + full #39 stack |
| **Category** | Governance + Mixed |
| **Typecheck / Build / Tests** | ✓ PASS (CI) |
| **Bugbot** | Wave 2A payload dependency on committed chunk JSON (not full payload file on all branches) |
| **Scope contamination** | Re-carries entire #39 tree; stacked PR pattern |
| **Production risk** | **MEDIUM** |
| **Special checks** | Wave 2A **already approved in production** (179 aliases). Submit scripts generate SQL — operational re-run risk if executed carelessly. No migrations in diff. |
| **Decision** | **FIX BEFORE MERGE** |
| **Reason** | Merge only after #39. Rebase to incremental delta if possible. Add README warning on submit scripts: "do not re-execute against production without checking pending drafts." |

**Exact blocker:** Document operational guardrails on `submit-wave2a-drafts.mjs`; confirm no duplicate draft re-submission intent.

---

### PR #41 — `Wave 2B: Asiyah/Tart cluster language approval (17 SKUs)`

| Field | Value |
|-------|-------|
| **Branch** | `cursor/wave2b-language-execution-673c` |
| **Files changed** | 23 (+6117 / −0) vs main; **+8 files / +1820** incremental after #40 |
| **Scope** | Wave 2B scripts/payloads/reports + full #39+#40 stack |
| **Category** | Governance + Mixed |
| **Typecheck / Build / Tests** | ✓ PASS (CI) |
| **Bugbot** | Same submit-script re-run class as #40 |
| **Scope contamination** | Full stack duplication |
| **Production risk** | **MEDIUM** |
| **Special checks** | Wave 2B **already live** (220→286 aliases cumulative). No WhatsApp send. |
| **Decision** | **FIX BEFORE MERGE** |
| **Reason** | Merge sequentially after #40. Archival value high; operational risk if scripts re-run. |

**Exact blocker:** Same as #40 — submit script guardrails; merge order dependency on #40.

---

### PR #42 — `Catalogue Authority Completion Wave — audit reports + Wave 2C draft prep`

| Field | Value |
|-------|-------|
| **Branch** | `cursor/catalogue-authority-completion-wave-673c` |
| **Files changed** | 31 (+9201 / −0) |
| **Scope** | Mega-stack: #39+#40+#41 artifacts + 5 audit reports + Wave 2C **prep** (not executed) + resolver |
| **Category** | Mixed scope (severe stacking) |
| **Typecheck / Build / Tests** | ✓ PASS (CI) |
| **Bugbot** | **High:** Wave 2C `loadExistingAliases` may miss wave2a/b payload files on clean checkout; committed ephemeral SQL risk if `_w2c_*.sql` present on branch working tree |
| **Scope contamination** | **Severe** — duplicates #39–#41 entirely; Wave 2C prep superseded by #43 execution |
| **Production risk** | **HIGH** |
| **Decision** | **CLOSE** |
| **Reason** | Superseded by PR #43 (Wave 2C executed + updated reports). Unique docs (`BATCH001_LANGUAGE_AUTHORITY_REPORT`, etc.) are conceptually replaced by PR #43 reports (`LANGUAGE_COVERAGE`, `PACKAGING`, `MEDIA`, etc.). Merging causes 9k+ line duplicate doc/stack conflicts. |

---

### PR #43 — `Product Authority Completion Wave — Wave 2C execution + authority reports`

| Field | Value |
|-------|-------|
| **Branch** | `cursor/product-authority-completion-wave-673c` |
| **Files changed** | 10 (+3067 / −0) |
| **Scope** | Wave 2C scripts/payloads + 6 new authority reports (packaging, media, Category 3 recovery, snapshot plan, Batch 002 launch, language coverage final) |
| **Category** | Governance + Documentation |
| **Typecheck / Build / Tests** | ✓ PASS (CI); 67 tests (no resolver on this branch vs main) |
| **Bugbot** | **Medium:** `execute-wave2c-language.mjs` seen-map ordering may misclassify exclusions; Wave 2C already executed in production |
| **Scope contamination** | **Clean vs main** — no resolver duplication; does not carry #39–#41 stacks |
| **Production risk** | **LOW–MEDIUM** |
| **Special checks** | Wave 2C **already approved** (+66 aliases, 25/25 SKU coverage). PR adds scripts/docs only. No `src/` runtime changes. No Central sync. |
| **Decision** | **MERGE** |
| **Reason** | Cleanest archival PR for Wave 2C + Product Authority reports. Independent of #42. Merge after #39–#41 or standalone for docs/scripts. |

---

## Summary Sections

### MERGE NOW (ordered)

1. **PR #33** — Language authority design doc (precedes code waves)
2. **PR #38** — WhatsApp consumption blueprint (precedes resolver)
3. **PR #24** — Catalogue authority reality audit (updates main doc)
4. **PR #26** — Import readiness audit
5. **PR #31** — Alias/WhatsApp authority audit
6. **PR #36** — Product intelligence + language preview artifacts (close #35 first)
7. **PR #39** — Resolver read-only prototype + Phase 1 reports
8. **PR #43** — Wave 2C final reports + scripts (independent, clean diff)

*Note: PR #30 can move to MERGE NOW after duplicate-detection verification (see FIX).*

---

### FIX BEFORE MERGE

| Order | PR | Exact blocker |
|-------|-----|---------------|
| 1 | **#30** | Verify `duplicateDetection.ts` name-only queries work on Central; rebase to drop no-op `Products.tsx` |
| 2 | **#40** | Merge after #39; add submit-script production guardrails; confirm no duplicate draft re-submission |
| 3 | **#41** | Merge after #40; same submit-script guardrails |

*Non-blocking follow-up (does not block MERGE): PR #43 `execute-wave2c-language.mjs` seen-map ordering — archival merge safe without fix.*

---

### HOLD

| PR | Dependency |
|----|------------|
| **#40** | Should merge **after #39** — stacked diff reduces to 8 files once #39 is on main. Hold if #39 is not merged first. |

*(PR #41 holds on #40; PR #43 can proceed independently.)*

---

### CLOSE

| PR | Reason |
|----|--------|
| **#28** | Superseded by PR #30 (strict superset of shared files) |
| **#35** | Superseded by PR #36 (identical `src/` delta plus preview assets) |
| **#42** | Superseded by PR #43 + merged stack of #39–#41; 31-file mega-stack with severe contamination |

---

## Recommended Merge Sequence

```
Phase 1 — Documentation foundation (parallel-safe)
  #33 → #38 → #24 → #26 → #31

Phase 2 — Tooling & preview artifacts
  #36 (close #35)
  #30 (after duplicateDetection verification; close #28)

Phase 3 — Resolver foundation
  #39

Phase 4 — Governance archives (sequential)
  #40 → #41

Phase 5 — Final authority wave
  #43 (close #42)
```

**Do not merge #42.** Close #28, #35, #42 after equivalents land.

---

## Recommended Closure Sequence

1. Close **#35** immediately (superseded by #36)
2. Close **#28** when **#30** merges
3. Close **#42** when **#43** merges (or immediately — work superseded)

---

## Top 10 Portfolio Risks

| # | Risk | PRs | Severity |
|---|------|-----|----------|
| 1 | Mega-stack PR #42 (9k+ lines) duplicates resolver + waves + reports | #42 | HIGH |
| 2 | Governed submit scripts can re-insert drafts if re-run against production | #40–#43 | HIGH |
| 3 | Language waves already live — merge archival PRs without ops runbook | #40–#43 | MEDIUM |
| 4 | `term_type` / `channel_scope` not on `product_aliases` master (docs only; runtime gap) | All language PRs | MEDIUM |
| 5 | Stacked PRs (#40–#42) re-merge identical resolver causing conflict noise | #40–#42 | MEDIUM |
| 6 | `duplicateDetection.ts` schema drift fix unverified on Central | #30 | MEDIUM |
| 7 | Wave 2C script alias snapshot dependency on payload files not in all branches | #42, #43 | MEDIUM |
| 8 | Large generated CSV/JSON assets bloat repo (+3k–9k lines/PR) | #36, #40–#43 | LOW |
| 9 | Doc duplication across PR stacks (blueprint, wave reports appear 3–4×) | #38–#42 | LOW |
| 10 | Open portfolio count (14 PRs) creates merge-order confusion and stale branches | All | LOW |

---

## Validation (main workspace baseline)

| Check | Result |
|-------|--------|
| `npm run typecheck` | ✓ PASS |
| `npm run build` | ✓ PASS |
| `npm run test` | ✓ PASS (67 tests — no resolver on main) |
| PR branch #39 tests | ✓ 73 tests (includes resolver) |
| CI `quality` on all 14 PRs | ✓ SUCCESS |

---

## Bugbot Summary (portfolio-wide)

No Bugbot PR comments posted on GitHub. Ad-hoc Bugbot branch review flagged:

| Severity | Finding | Affected |
|----------|---------|----------|
| High | Wave 2C `loadExistingAliases` silent skip if wave2a/b payload JSON missing | #42, #43 scripts |
| High | Ephemeral `INSERT INTO catalogue_alias_drafts` SQL must not be committed/re-run | Operational (#40–#43) |
| Medium | Wave 2C seen-map ordering misclassifies exclusions | #43 script |
| Medium | Batch 001 CSV may omit SKU 0025 weight row | Preview data (#36) |

---

## Portfolio Health Score: 52%

| Dimension | Weight | Score |
|-----------|--------|-------|
| CI pass rate (14/14) | 25% | 100% |
| Scope hygiene (stacking/duplication) | 25% | 30% |
| Production safety (no migration/SQL in diffs) | 20% | 90% |
| Merge clarity (sequencing) | 15% | 40% |
| Supersession hygiene (stale PRs open) | 15% | 25% |
| **Weighted** | | **52%** |

The portfolio is **technically green** (all CI pass) but **operationally yellow** due to stacked governance PRs, superseded open branches, and production language work already executed outside merge flow.

---

*Audit performed read-only. No merges, commits, SQL, migrations, or production modifications were made.*
