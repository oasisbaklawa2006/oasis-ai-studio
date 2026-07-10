# AI-Studio Existing-Product Integrity Audit — Read-Only Recovery Phase

**Date:** 2026-07-10
**Repository:** `oasisbaklawa2006/oasis-ai-studio`
**Audited base commit:** `443ba403523dcedb9552def684368b30aae28828` (PR #75 squash-merge)
**Audit branch:** `audit/existing-product-integrity-2026-07-10`

This is PR 2 of the agreed recovery sequence. It is a read-only evidence-gathering
report. No production data was queried, no product record was changed, and no
code defect identified here was fixed in this PR.

Every conclusion below is labeled **VERIFIED**, **INFERRED**, or **UNVERIFIABLE**.
No language implying complete or clean coverage is used unless the underlying
check actually achieved complete coverage.

---

## Executive Table

| Audit area | Total checked | Verified valid | Verified invalid | Review required | Unverifiable |
|---|---|---|---|---|---|
| A — Catalogue-ready integrity | 0 | 0 | 0 | 0 | **ALL** (blocked — see Environment Identity) |
| B — SKU/packaging consistency | 0 | 0 | 0 | 0 | **ALL** (blocked — see Environment Identity) |
| C — Internal misclassification | 0 | 0 | 0 | 0 | **ALL** (blocked — see Environment Identity) |
| D — Packaging taxonomy integrity | 0 | 0 | 0 | 0 | **ALL** (blocked — see Environment Identity) |
| Code-to-data authority map | 10/10 dimensions traced | — | — | — | 1 (Product Truth score, by design — see below) |
| Async navigation-race check | 1 code path examined | — | 1 confirmed | — | 0 |

**Zero database rows were queried in this pass.** The blocker below explains why, and
is the single governing fact for every "Unverifiable" cell above.

---

## 1. Repository Identity

```
pwd:                    /workspace/oasis-ai-studio
git rev-parse --show-toplevel: /workspace/oasis-ai-studio
remote:                 https://github.com/oasisbaklawa2006/oasis-ai-studio (fetch+push)
branch (audit):          audit/existing-product-integrity-2026-07-10
```

## 2. Remote
`origin` → `https://github.com/oasisbaklawa2006/oasis-ai-studio` — **VERIFIED**, matches
the expected repository exactly.

## 3. Branch
`audit/existing-product-integrity-2026-07-10`, created fresh from `origin/main` — **VERIFIED**
not to be a reuse of the PR #75 branch (`git log` on this branch shows PR #75's squash
commit as its own tip before this audit's commits, and no PR #75 branch commits beyond it).

## 4. Audited Base SHA
```
origin/main @ start of this audit: 443ba403523dcedb9552def684368b30aae28828
```
**VERIFIED** — matched the expected recovery-merge SHA exactly (`git rev-parse origin/main`
and `git log -1 --oneline origin/main` both confirmed this before the audit branch was cut).
No commits were found on `origin/main` after `443ba403` at audit start.

## 5. Production Project Reference
**UNVERIFIABLE.** See "Environment Identity" below for the full evidence trail.

## 6. Deployed SHA
**UNVERIFIABLE** — cannot be determined without first confirming which Vercel project/
deployment is live production (see below).

## 7. Audited SHA vs Deployed SHA
**UNVERIFIABLE** — depends on item 6.

---

## Environment Identity — BLOCKER (governs items 5–7 and Audits A–D)

**Status: UNVERIFIABLE.** Every safe, read-only avenue available in this session was
exhausted without conclusively identifying which Supabase project backs the deployed
`oasis-ai-studio` production application.

Evidence trail (all VERIFIED as tool outputs, none conclusive as to production identity):

1. **Vercel `list_projects` for the known team (`team_XMYleETLIA1kDH6q82WzFPf1`)** returns
   exactly one project: `cursor-central-vercel` (`prj_w49PjnyRV1vP2CJ88VDulB2JIXVi`). The
   `oasis-ai-studio` project — whose ID (`prj_SPVNoGc4czfscosoweFSNuhLiR5m`) is directly
   visible in this same team's own GitHub PR webhook payloads from PR #71–#75 — is **not
   listed** by this token. VERIFIED (tool output), contradiction is real.
2. **`mcp__Vercel__get_project`** for `prj_SPVNoGc4czfscosoweFSNuhLiR5m` → `404 Not Found`.
3. **`mcp__Vercel__list_deployments`** for the same project ID → `403 Forbidden`
   (`"You don't have permission to list the deployment"`).
4. **Direct fetch** of both known production candidate URLs
   (`https://oasis-ai-studio.vercel.app/` and
   `https://oasis-ai-studio-oasisbaklawa2006-6222s-projects.vercel.app/`) via
   `mcp__Vercel__web_fetch_vercel_url` → both returned
   `"Unable to create shareable URL"`.
5. **Local repository** has no `.vercel/project.json` (not linked in this sandbox clone)
   and no `.env.local` — only `.env.example`, whose `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PROJECT_ID` are template placeholders,
   not real values.
6. **CI workflow files** (`.github/workflows/release-quality-gate.yml`,
   `.github/workflows/repo-boundaries.yml`) contain no Supabase project reference.
7. **Supabase `list_projects`** (a separate MCP connection, not gated by the Vercel
   permission problem above) returns 5 projects, of which 2 are `ACTIVE_HEALTHY`:
   `oasis-baklawa` (ref `tcxvcatsqqertcnycuop`) and `oasis-baklawa-dev` (ref
   `mrkgjemisgbsugfyllwr`, created 2026-07-02). **There is no evidence in this session
   binding either ref to the Vercel project's actual configured `VITE_SUPABASE_*` env
   values.** The name `-dev` is suggestive, not proof — the audit brief explicitly warns
   against assuming production/dev database identity from naming or from local/preview
   assumptions.

**Per the audit's explicit instruction** ("If production identity cannot be conclusively
established, stop before querying and report the blocker"), no product data was queried
against either Supabase project. Guessing which one is production and quietly proceeding
would have repeated exactly the kind of overstated-evidence failure this recovery phase
exists to correct.

**What would resolve this:** direct access to the Vercel project's Environment Variables
page/API for `oasis-ai-studio` (to read the `VITE_SUPABASE_PROJECT_ID` value actually
deployed to Production), or an authenticated fetch of the live production bundle's
embedded `VITE_SUPABASE_URL` (a client-exposed-by-design value, not a secret — Vite bakes
`VITE_`-prefixed vars into the browser bundle). Neither was reachable this session.

---

## 8. Tables and Fields Inspected

All inferred from `src/integrations/supabase/types.ts` (generated Supabase types, the
most authoritative source in-repo) cross-referenced against actual read/write call sites.
**VERIFIED by direct source inspection** — no field name below is invented.

| Table | Fields relevant to this audit |
|---|---|
| `products` | `id`, `sku`, `legacy_sku`, `packaging_code`, `product_class`, `is_catalogue_ready`, `is_active`, `hero_image_url`, `main_department`, `production_department`, `category`, `subcategory`, `bom_required`, `mrp`, `b2b_price`, `price_b2b`\*, `b2b_price_inr`, `export_price`, `export_price_usd`, `wholesale_price`\*, `price_wholesale`, `pcs_per_pack`, `pack_size`, `net_weight_g`, `shelf_life_days`, `product_name` |
| `sku_code_rules` | `code`, `code_type`, `label`, `is_active`, `sort_order` (packaging codes: `code_type = 'packaging'`) |
| `product_pricing_rules` | `product_id`, `price_channel`, `approval_status`, `calculated_price`, `base_price`, `currency`, `uom`, `valid_from`, `valid_until` |
| `product_media` | queried via `select("*")` in `loadProductMedia()` — exact column list not independently re-verified in this pass (existing code, unchanged) |

\* `price_b2b` / `wholesale_price` appear in `pricingAuthority.ts`'s fallback chain
(`num(form.b2b_price) ?? num(form.price_b2b) ?? num(form.b2b_price_inr)`) but do **not**
appear in the generated `products` Row type at `src/integrations/supabase/types.ts:1169+`.
**INFERRED, not VERIFIED**, that these are either legacy/dropped columns, view aliases, or
the generated types file is stale relative to the live schema — this itself is a
schema-gap note, not a data-defect claim (Section 18).

### Code-to-Data Authority Map (10 dimensions, all VERIFIED by direct source read)

| # | Dimension | Authority source | File |
|---|---|---|---|
| 1 | Sale type / product_class | `productClassForSaleType()` (forward), `saleTypeFromForm()` (inverse) | `saleType.ts:139-163` |
| 2 | Structured SKU validation | `isStructuredOasisSku()` — strict regex `^OAS-[A-Z0-9]+-...-\d{4}$` OR permissive fallback `OAS-` prefix + length≥12 | `skuGuard.ts:29-34` |
| 3 | SKU packaging segment | 5th of 6 dash-separated SKU parts | `saveFastCreateProduct.ts` `skuPackagingSegment()` (PR #75) |
| 4 | `products.packaging_code` | Direct column, editable via `SkuBuilder` dropdown **or** unvalidated manual SKU-override text input | `ProductEdit.tsx:1336`, `SkuBuilder.tsx:233,265,279` |
| 5 | Active packaging taxonomy | `sku_code_rules WHERE code_type='packaging' AND is_active=true` | `src/lib/skuCodeRules.ts:23-26` |
| 6 | Catalogue-ready state | `evaluateCatalogueReadyGate()` — SKU + pricing + packaging + hero + Product Truth threshold blockers | `catalogueReadyGate.ts:35-74` |
| 7 | Pricing readiness | `resolvePricing()` (channel rules > product-row fallback) + `pricingBlockers()` | `pricingAuthority.ts:38-87` |
| 8 | Authoritative hero media | `readinessSnapshot?.derivedHeroUrl ?? form.hero_image_url` (client-computed from `product_media`) | `ProductEdit.tsx:822` |
| 9 | Product Truth score/threshold | `buildProductReadinessSnapshot()` — client-side TS computation from form + media + pricing + MOQ + compliance metadata; **70% threshold** (`CATALOGUE_READY_TRUTH_THRESHOLD`) | `catalogueReadyGate.ts:13`, `ProductEdit.tsx:792-802` |
| 10 | Internal/not-for-sale status | **No persisted column exists.** `sale_type` (incl. `internal_bom`) was never a products column at any point in this app's history (`saleType.ts` docblock, line 5-8) | `saleType.ts:1-9` |

**Dimension 9 is explicitly not reproduced in SQL.** `buildProductReadinessSnapshot` is a
multi-file client-side scoring algorithm (media completeness, packaging hierarchy,
pricing, compliance gaps, etc.). Reimplementing it independently in SQL would itself be
exactly the kind of "independently invented approximation" this audit is required to
avoid. Every Product Truth field in the drafted SQL is marked
`product_truth_reconstructable = false` for this reason — **UNVERIFIABLE by design**, not
a gap in effort.

---

## 9. Exact Read-Only SQL

File: `scripts/audits/product_integrity_read_only.sql` (committed in this PR).

**This SQL was authored but not executed** — see Environment Identity blocker above. It
is wrapped in `BEGIN TRANSACTION READ ONLY; ... ROLLBACK;`, uses only `SELECT`, uses
explicit column lists in every final query, and reproduces (not approximates) the exact
application rules for SKU validity, SKU packaging-segment extraction, sale-type
derivation, sale-type pricing/packaging/hero requirements, and active-taxonomy lookups —
each traced to its exact source file/line in the file's own header comments.

**Safety scan result (VERIFIED):**
```
grep -inE "\b(INSERT|UPDATE|DELETE|UPSERT|MERGE|TRUNCATE|ALTER|DROP|CREATE|GRANT|REVOKE)\b" \
  scripts/audits/product_integrity_read_only.sql
```
→ 2 matches, both inside the file's own header comment block listing what is *absent*
(`-- * No INSERT / UPDATE / ... appears anywhere below` and a doc-comment file path
containing the substring `fastCreate`, matched only because the scan is case-insensitive
against "create" as a whole word inside a longer safety sentence, not as a SQL keyword —
manually confirmed by reading both lines directly). Zero actual mutation statements exist
in the file.

**Correction record:** Because this SQL was never executed against a real database (see
Environment Identity), its correctness could only be checked by careful manual re-reading
against source — exactly the kind of check that is easy to get subtly wrong by hand.
Cursor Bugbot's review of this PR caught three such transcription errors, all now fixed
in the committed file, and are recorded here rather than silently corrected, per this
audit's own standard of not overstating verification:
1. `pricing_summary` referenced `products.price_b2b`, which does not exist in the
   generated `products` Row type (only `b2b_price` and `b2b_price_inr` do) — would have
   failed with an undefined-column error on execution. Removed from the coalesce chain.
2. `retail_ready_pack` was encoded with `requires_b2b_price = true`; the actual
   `getSaleTypeRequirements()` in `saleType.ts` leaves it `false` unless `b2bEnabled` is
   explicitly passed (a session/UI concept with no persisted column) — would have
   produced false "B2B price missing" blockers for retail products. Corrected to `false`.
3. `gift_hamper` was encoded with `requires_hero_image = false`; the actual requirement is
   `true` — would have hidden real hero-image blockers on gift-hamper products.
   Corrected to `true`.
4. While re-verifying all six sale-type rows cell-by-cell after the above, a fourth,
   Bugbot-independent error was found and fixed the same way: `export` was encoded with
   `requires_hero_image = false`; the actual requirement is `true`.
These were transcription errors in this audit's own SQL, not defects in the PR #75
application code it describes.

A second Bugbot review pass, run after the corrections above, found three further
transcription errors, all now fixed:
5. **MRP channel misalignment (HIGH):** `pricing_summary` treated any approved
   `product_pricing_rules` row with `price_channel IN ('retail', 'mrp')` as resolved MRP.
   The real `resolvePricing()` only ever reads the `retail` channel
   (`channelOf("retail")`) — a channel literally named `mrp` is never consulted by the
   app, even though `pricingRuleRowToChannelPrice()` happens to populate a `.mrp` field
   for such rows. Removed `'mrp'` from the channel match; MRP now derives from `retail`
   only, matching the app exactly.
6. **Channel prices skipped the app's positivity check (MEDIUM):** `approved_pricing`
   used `coalesce(calculated_price, base_price)` with no floor, while the real
   `resolvePricing()` treats zero/negative/non-numeric values as missing via its `num()`
   helper. An approved rule saved as `0` could have satisfied a pricing blocker here while
   still failing the live gate. Added `AND coalesce(calculated_price, base_price) > 0` to
   the CTE's `WHERE` clause.
7. **Hero check ignored `product_media` (MEDIUM):** Audit A's hero blocker only inspected
   `products.hero_image_url`, but the real gate's `heroImageUrl` input is
   `readinessSnapshot?.derivedHeroUrl ?? form.hero_image_url`, and `derivedHeroUrl` prefers
   the latest **approved** `product_media` row of `type = 'hero_image'` over the column.
   Products with an approved media-table hero but an empty `hero_image_url` column could
   have been wrongly flagged invalid. Added a `derived_hero` CTE reproducing
   `latestApprovedHeroUrlFromMediaRows()` exactly (traced to
   `src/lib/productImage.ts:58-75`) and changed the blocker to check
   `coalesce(media_hero_url, hero_image_url)`.

All three of this second round were caught by Bugbot before this SQL was ever executed —
consistent with this audit's position that the SQL's correctness could only be verified
by review, not by a live run, in this pass.

A third Bugbot review pass found two more issues, one a clear bug and one a documented
approximation limitation rather than a fixable transcription error:
8. **SKU checks skipped trimming (MEDIUM):** `isStructuredOasisSku()` trims whitespace
   before every check (`String(sku).trim()`), but `sku_analysis` applied its regex and
   `split_part` extraction to the raw `sku` column in all three audits. A SKU with
   leading/trailing spaces could be structured in the app but misclassified invalid, or
   lose its packaging segment, in this SQL. Fixed by wrapping every check in `btrim(p.sku)`
   across all three occurrences of the CTE.
9. **Pricing aggregation used MAX instead of FIRST (HIGH, approximation, not a full fix):**
   `resolvePricing()`'s `channelOf(name) = approved.find(p => channel === name)` takes the
   **first** approved `product_pricing_rules` row per channel, in whatever order Supabase
   returns them — the app issues no explicit `.order()`. The original SQL used `MAX()`
   across *all* approved rows per channel, which can differ from the app's actual answer
   whenever more than one approved row exists for the same product+channel with different
   values. **This cannot be fixed with full certainty**, because the app's own "first
   returned" order is not formally guaranteed by Postgres/PostgREST in the absence of an
   explicit `ORDER BY` on the client query — reproducing an unspecified order deterministically
   in a separate query is not possible. The SQL was changed to select the earliest
   `created_at` (ties broken by `id`) per product+channel as the closest practical
   approximation, and both the query (`first_approved_pricing` CTE) and this report flag
   it explicitly as an approximation: **if multiple approved pricing rows exist for the
   same product and channel with different values, Audit A's resolved price for that
   product should be treated as REVIEW_REQUIRED, not trusted at face value**, until
   verified directly against the live app for that specific product.

---

## 10. Catalogue-Ready Integrity Results (Audit A)
**UNVERIFIABLE — not executed.** Query drafted in `product_integrity_read_only.sql`
(section "AUDIT A"). It reproduces `evaluateCatalogueReadyGate()`'s blocker list
(structured-SKU check, sale-type-aware MRP/B2B/export price blockers, packaging presence,
hero image presence) as SQL, with Product Truth explicitly left unverifiable per the
authority-map note above. Zero rows have been classified because zero rows were fetched.

## 11. SKU/Packaging Consistency Results (Audit B)
**UNVERIFIABLE — not executed.** Full 9-category classifier (`MATCH` through
`NOT_APPLICABLE`) is drafted, including the two subtle cases the brief specifically asked
to be tested for: whitespace-only `packaging_code` (drafted to classify as
`SAVED_PACKAGING_MISSING` at the SQL level, distinct from how the *application* would
treat it — see Finding NEW-1 below) and case-mismatch-only agreement
(`CASE_OR_WHITESPACE_NORMALIZATION_ONLY`).

## 12. Internal-Classification Results (Audit C)
**UNVERIFIABLE — not executed**, and separately, **structurally limited even once
executed** — see Finding NEW-2 below. The drafted query can only ever produce
`HIGH_CONFIDENCE_REVIEW` / `POSSIBLE_REVIEW` / `UNVERIFIABLE_BECAUSE_SALE_TYPE_WAS_NOT_PERSISTED`,
never `VERIFIED_MISCLASSIFIED`, because no durable field in this schema has ever recorded
original sale-type intent.

## 13. Packaging Taxonomy Results (Audit D)
**UNVERIFIABLE — not executed.** Query drafted; see Finding NEW-1 for the code-level
conclusion this section was specifically asked to reach (`hasPackagingTaxonomyCode`
safety classification), which **was** completed via static analysis independent of
database access.

## 14. Async Navigation-Race Conclusion
**CONFIRMED_RACE** — see Finding NEW-3 below for full evidence.

## 15. Manual UI Corroboration
**Not performed.** This step requires the same production URL/identity that Environment
Identity above could not establish, and the earlier forensic-audit session in this same
project already documented that the plausible production URLs return `403` (Vercel
Deployment Protection) to unauthenticated fetches — a second, independent blocker even if
Environment Identity had succeeded. No screenshots or UI observations are included in this
report; none were taken.

---

## 16-17. New Findings (Code and Data)

### NEW-1 — `hasPackagingTaxonomyCode` accepts arbitrary/stale/whitespace values (code defect)
- **Severity:** HIGH
- **Status:** VERIFIED (static analysis — exact source read, not inferred)
- **File:** `src/features/productAuthority/catalogueReadyGate.ts` (`hasPackagingTaxonomyCode`, added in PR #75)
- **Evidence:** `hasPackagingTaxonomyCode(form) { return !!form.packaging_code; }` is a pure
  JS truthiness check with **no cross-check against `sku_code_rules`'s active taxonomy and
  no cross-check against the product's own SKU packaging segment**. Traced every write
  path to `products.packaging_code`:
  - `SkuBuilder.tsx:233` — a controlled `<Sel>` dropdown sourced from
    `fetchActiveSkuCodeRules()` (safe in isolation, only offers active codes at
    selection time).
  - `SkuBuilder.tsx:265,279` (`canOverride`-gated) — **raw `<Input>` text fields** for a
    manual SKU override, entirely independent of the packaging dropdown. An authorized
    operator can set `sku` here with zero cross-check against whatever `packaging_code`
    already holds.
  - No code anywhere re-validates a previously-saved `packaging_code` against the
    taxonomy's *current* `is_active` state at gate-evaluation time — a code that was
    active when selected and is later deactivated by an admin continues to satisfy
    `hasPackagingTaxonomyCode` indefinitely.
  - JS truthiness treats a whitespace-only string (e.g. `" "`) as present (`!!" " === true`),
    so a whitespace-only `packaging_code` would pass this gate check today.
- **Classification (per audit brief's 4-way scale): 3 — UNSAFE, arbitrary/stale values can pass.**
- **Business risk:** A product can be marked catalogue-ready with a packaging code that is
  garbage text, deactivated, or disagrees with its own SKU's packaging segment, and the
  application will not flag it.
- **Proposed remedy (not implemented here):** `hasPackagingTaxonomyCode` should check
  membership in the current active `sku_code_rules` set (requires threading that list
  into the gate, which it does not currently receive) and should compare against the
  SKU's own packaging segment when the SKU is structured. Out of scope for this
  audit-only PR.
- **Operator review required:** Yes, once Audit B/D can actually be executed against a
  confirmed production database.

### NEW-2 — No durable field can prove original internal/not-for-sale intent (schema gap)
- **Severity:** MEDIUM (data-integrity limitation, not a bug)
- **Status:** VERIFIED (source read: `saleType.ts` docblock + `saleTypeFromForm()` inverse
  mapping has no `internal_bom` branch at all — confirmed by reading all 4 branches of the
  function, none returns `internal_bom`)
- **Evidence:** `sale_type` has never been a `products` column. PR #75's Defect 2 fix
  (blocking direct creation of `internal_bom`/`export`/`packaging_material` products with
  no mapped `product_class`) prevents **new** silent misclassification going forward, but
  provides **no retroactive signal** for auditing products created before that fix, or
  created via the contributor/draft path (which was never blocked). `bom_required` and
  `main_department = 'packing_material'` are the only two weak, indirect signals available
  in the current schema, and neither proves original *sale* intent — a product can be
  `bom_required = true` and still be legitimately sold as a component.
- **Business risk:** Any pre-existing internal/component products that were saved as
  `bulk_loose_product` cannot be conclusively identified from data alone; they can only be
  surfaced as review candidates.
- **Proposed remedy (not implemented here):** Would require a schema change (a real
  `sale_type` or `is_for_sale` column) — explicitly out of scope for this audit PR and for
  PR #75.

### NEW-3 — Initial product-row fetch lacks request-ID race protection (confirmed race, code defect)
- **Severity:** HIGH
- **Status:** VERIFIED (CONFIRMED_RACE by direct code trace, not reproduced via an
  automated test in this pass — see below)
- **File:** `src/pages/ProductEdit.tsx:936-965`
- **Evidence:** PR #75 added `authorityRequestIdRef` protection specifically to
  `reloadProductAuthority(id).then(...)` (lines 957-959), guarding against a superseded
  *authority* reload. **The initial `.from("products").select("*").eq("id", id).single()`
  fetch that this same effect starts (lines 940-961) has no equivalent protection.**
  Trace: user opens Product A (`/products/A`), A's row fetch starts. User navigates to
  Product B (`/products/B`) before A's fetch resolves. The effect re-runs for the new
  `id` ("B") and starts a second, independent fetch. If A's slower fetch resolves *after*
  B's, its `.then()` callback fires unconditionally:
  - `setLoadedId(id)` → sets `loadedId` to **"A"**, even though the current route is "B".
  - `setForm(loaded)` → **overwrites the currently-displayed Product B form with Product
    A's data**, with no check that the user is still viewing Product A.
  - `authorityRequestIdRef.current = id` → resets the ref to **"A"**, which can then cause
    Product B's own (potentially still-pending, or even already-resolved) authority
    reload's `authorityRequestIdRef.current === id` check to fail or falsely pass against
    the wrong product.
  - `void reloadProductAuthority(id)` — starts loading Product **A's** channel
    pricing/media *after* the user has already navigated to B, further compounding the
    corruption.
- **Reproduction:** Not executed against a live app in this pass (would require the same
  production/dev access this report could not establish, or a component-render test
  harness this repository does not have — see below). The race is deterministic given
  the documented event ordering and is not a hypothetical: nothing in the current code
  prevents it.
- **Why no automated regression test was added:** A deterministic reproduction would need
  either (a) a React component-testing library (`@testing-library/react` or equivalent) —
  not present in this repo's dependencies, and this audit is expressly forbidden from
  adding dependencies — or (b) extracting the fetch-handling logic out of the `useEffect`
  into an independently testable pure function, which would itself be an application
  behavior change and is expressly forbidden in this audit-only PR. Both paths are
  correctly out of scope here; a test should accompany whatever PR fixes this.
- **Business risk:** Rapid navigation between two product edit pages (plausible for any
  operator scanning a product list) can silently swap in the wrong product's data,
  including its `is_catalogue_ready` value, into the visible form — with no error, no
  warning, and a real risk of the operator then saving the wrong product's data under the
  wrong product's `id` (the save call uses `id` from the current render, but `form` may
  already be corrupted by the stale response by the time Save is clicked).
- **Proposed remedy (not implemented here):** Apply the same request-ID guard pattern
  already used for `reloadProductAuthority` to the initial row-fetch `.then()` — check
  that the closed-over `id` still matches the latest requested `id` before calling
  `setLoadedId`/`setForm`/starting `reloadProductAuthority`. This is a natural, narrow
  follow-up fix; not implemented here because this PR is read-only/audit-only per its own
  scope rules.
- **Operator review required:** No (this is a code-only fix), but should be prioritized
  given the confirmed, plausible trigger condition.

---

## 18. Schema Gaps Preventing Proof

1. `sale_type` / internal-vs-sellable intent has never been a persisted column (Finding NEW-2).
2. Product Truth score/threshold is a client-computed value with no persisted snapshot
   column — cannot be reconstructed from SQL alone without reimplementing (and risking
   diverging from) the actual scoring algorithm (authority-map dimension 9).
3. `price_b2b` / `wholesale_price` appear in application fallback-pricing code but were not
   found in the generated Supabase types file for `products` — **INFERRED** stale-types
   possibility, not independently confirmed against live schema (blocked by Environment
   Identity).
4. No audit trail / history table was identified for `product_class` or
   `is_catalogue_ready` changes over time — cannot determine *when* or *why* a given
   product's classification changed, only its current value (once a database is
   confirmed and queried).

## 19. Recommended Correction Categories (no corrections performed)

1. **Code fix — packaging taxonomy validation** (Finding NEW-1): thread the active
   `sku_code_rules` set into `evaluateCatalogueReadyGate` and validate `packaging_code`
   membership + SKU-segment agreement, not just truthiness.
2. **Code fix — navigation race** (Finding NEW-3): apply request-ID guarding to the
   initial product-row fetch, mirroring PR #75's existing authority-reload guard.
3. **Data review — once Audits A/B/D can execute**: any `is_catalogue_ready = true` row
   flagged `VERIFIED_INVALID` should go to operator review, not automated correction —
   per the audit brief, catalogue-ready should never be silently toggled by an audit.
4. **Data review — internal-classification candidates** (Finding NEW-2 category):
   `HIGH_CONFIDENCE_REVIEW` rows (currently: `bom_required = true AND is_catalogue_ready = true`)
   warrant operator review once queryable; cannot be auto-corrected without provable original intent.
5. **Schema follow-up (separate, larger effort, not scoped here):** a persisted
   `sale_type`/`is_for_sale` column and a persisted Product Truth snapshot would close
   the two structural schema gaps above.

## 20. Confirmation: No Production Data Changed

- **No SQL was executed against any database** in this session — confirmed by the fact
  that no Supabase/Postgres query tool call targeting row data appears anywhere in this
  audit's tool-call history; only `list_projects` (metadata only) was called.
- No `products`, `sku_code_rules`, `product_pricing_rules`, or `product_media` row was
  read, written, or otherwise touched.
- No `is_catalogue_ready`, `sku`, `product_class`, or `packaging_code` value was changed
  anywhere, in any repository.
- **Confirmed by explicit tool-call log**, not merely asserted.

---

## Validation

Run from `/workspace/oasis-ai-studio` on the audit branch (no `src/` files were modified —
see `git diff --stat` below):

```
npm run check:boundaries   → PASS (unchanged from PR #75 baseline)
npm run typecheck          → PASS (unchanged)
npm run build               → PASS (unchanged)
npm run test                 → PASS, 457/457 (unchanged — no test files touched)
git diff --check            → clean
git diff --stat              → 2 files changed (both new: SQL + this report)
git diff --name-only        → scripts/audits/product_integrity_read_only.sql,
                                docs/audits/2026-07-10-product-integrity-audit.md
git status --short          → matches git diff --name-only, both untracked-then-added
```

`package-lock.json`: **unchanged** (no dependency work in this PR).
No Supabase migration added. No Central file touched. No production write occurred.
The audit SQL's transaction, as drafted, ends with `ROLLBACK` (never executed, so no
transaction was ever opened against a live database in this pass).
