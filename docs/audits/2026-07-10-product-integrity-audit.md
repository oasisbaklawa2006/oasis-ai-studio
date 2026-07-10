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

## PHASE 1 DURABLE CLOSEOUT (2026-07-10)

This section is the authoritative, current record of what was actually executed. It
supersedes the "UNVERIFIABLE — blocked" language in the Executive Table and sections
5–13 below **only as to whether Audits A–D were executed** — those original sections are
left intact as an accurate historical record of the PR #76 pass, which genuinely did not
execute anything.

### Two distinct audit passes — do not conflate them

- **Original PR #76 audit (this document's original body, sections 1–20 below, dated
  2026-07-10):** drafted the SQL and the full audit methodology, but **Audits A–D were
  NOT executed** against any database. The Environment Identity blocker documented in
  this file was genuine at that time — this session's own tooling could not conclusively
  bind a Vercel project or Supabase project to the deployed application.
- **Phase 1 execution (this section, also 2026-07-10, later the same day):** the repo
  owner independently verified production identity from the **live deployed browser
  bundle** (`https://oasis-ai-studio.vercel.app/assets/index-BfI2ZiSI.js`, embedding
  `https://tcxvcatsqqertcnycuop.supabase.co`) and supplied that evidence directly. On
  that basis, `scripts/audits/product_integrity_read_only.sql` was **executed read-only
  against Supabase project `tcxvcatsqqertcnycuop`**, at repository commit
  **`d3b83e702f0471b91542cc78e8b48d9797b68365`** (the current `main`, which is the merge
  commit of PR #77). Every statement ran inside `BEGIN TRANSACTION READ ONLY` with an
  explicit `SET LOCAL statement_timeout = '30s'`, followed by `ROLLBACK`. **Zero rows
  were mutated.** Only `tcxvcatsqqertcnycuop` was queried; the separate active project
  `mrkgjemisgbsugfyllwr` (`oasis-baklawa-dev`) was never touched.

### Schema drift found during execution

Mid-execution, the file's original pricing-fallback columns failed with a real Postgres
error (`column p.b2b_price does not exist`). Direct `information_schema.columns`
inspection of `tcxvcatsqqertcnycuop` (VERIFIED) confirmed: **`products.b2b_price`,
`products.b2b_price_inr`, `products.export_price`, and `products.export_price_usd` do
not exist on live production.** The real B2B fallback column is `products.price_b2b`;
no export product-row fallback column exists at all. The generated
`src/integrations/supabase/types.ts` (and this audit's original SQL, which mirrored it)
is stale relative to the deployed schema — this is a genuine, independent finding, not
a guess. `scripts/audits/product_integrity_read_only.sql` has been corrected to query
the real column (`price_b2b`) and use a typed `NULL` where no export fallback exists;
channel-rule pricing resolution (from `product_pricing_rules`) is entirely unaffected by
this gap and was not changed.

### Results (VERIFIED — executed against `tcxvcatsqqertcnycuop`)

**Scale:** 364 products (all with SKUs), 11 catalogue-ready, 36 `sku_code_rules` (13
active packaging codes, 0 inactive, 0 duplicates), 117 pricing rules (104 approved).

**Audit A — catalogue-ready integrity (all 11 rows reviewed).** **4 of 11
catalogue-ready products have no blockers across the SQL-reconstructable dimensions.
Product Truth and Central-preview dimensions remain unverified** — this SQL cannot and
does not reproduce `buildProductReadinessSnapshot()` (client-side TypeScript) or any
Central-side preview validator; see the "Code-to-Data Authority Map" note on Product
Truth. Of the other 7 catalogue-ready products: 4 are legacy pilot SKUs blocked on
missing packaging (pre-existing gap, predates the packaging-segment SKU convention); 2
blocked on missing MRP; 1 blocked on missing B2B price; 1
(`OAS-AS-BKL-ASS-RBOX-0002`) has a genuine SKU-vs-saved-packaging-code mismatch that the
file's new `packaging_ready_under_current_gate` / `sku_packaging_code_mismatch` columns
now surface directly (see "Current-gate packaging classification" below). Zero
invalid-SKU or missing-hero blockers. Zero pricing review-required disagreements among
currently-valid approved rows.

**Audit B — SKU/packaging consistency (full 364 reviewed via summary + targeted
row).** 322 not-applicable, 41 match, **exactly 1 mismatch** —
`OAS-AS-BKL-ASS-RBOX-0002` (SKU encodes `RBOX`, saved `packaging_code = MAAPET`; both
are individually valid active taxonomy codes — they simply disagree with each other).

**Audit C — internal-classification review candidates.** 3 `HIGH_CONFIDENCE_REVIEW`
rows — `OAS-AS-BKL-ASS-RBOX-0002`, `OAS-AS-BKL-PST-RBOX-0001`,
`OAS-AS-BKL-ROL-MAAPET-0001` — all simultaneously `bom_required = true` and
`is_catalogue_ready = true`. Per the audit's own rule (see section 12 below): these are
**review candidates only, never verified misclassifications** — `sale_type` was never a
persisted column at any point in this application's history, so original intent is
structurally unreconstructable from data alone.

**Audit D — packaging taxonomy integrity.** 318 of 364 products fail the packaging
requirement, all for the same reason (missing code — zero whitespace-only, zero
unknown/invalid codes present in this row set). Only 4 are catalogue-ready — the same 4
legacy pilot SKUs from Audit A. The newly added `packaging_ready_under_current_gate` /
`sku_packaging_code_mismatch` columns are uniformly `false`/`0` across this specific row
set by construction (Audit D's `WHERE` clause already excludes any row with a valid,
active `packaging_code` — the current-gate and SKU-mismatch dimensions only become
non-trivial once a valid code exists, which is exactly the scenario Audit A/B surface
for `OAS-AS-BKL-ASS-RBOX-0002`).

### Current-gate packaging classification (new, resolves closeout requirement #3)

`scripts/audits/product_integrity_read_only.sql` now computes **two separate packaging
evaluations side by side, clearly labeled, and never conflated**:

1. **Legacy blast-radius measurement** (`packaging_present_by_app_truthiness`,
   `blocker_packaging_missing`, `would_pass_app_hasPackagingTaxonomyCode`) — the
   pre-PR-#77 `hasPackagingTaxonomyCode() = !!form.packaging_code` truthiness check.
   Retained intentionally to measure the historical blast radius of NEW-1 (below); this
   is **not** current app behaviour.
2. **Current-gate evaluation** (`packaging_ready_under_current_gate`,
   `blocker_packaging_missing_current_gate`, `sku_packaging_code_mismatch`) — an exact
   SQL reproduction of `evaluatePackagingReadiness()` as merged in PR #77
   (`src/features/productAuthority/catalogueReadyGate.ts`): active-taxonomy membership
   **and** SKU-packaging-segment agreement, both required. This is what the live app
   actually enforces today.

For `OAS-AS-BKL-ASS-RBOX-0002` specifically: `packaging_code = MAAPET`,
`sku_packaging_segment = RBOX`. Both `MAAPET` and `RBOX` are individually valid, active
`sku_code_rules` entries — under the legacy truthiness check this product's packaging
reads as "present" (`packaging_present_by_app_truthiness = true`,
`blocker_packaging_missing = false`); under the current gate it is correctly blocked
(`packaging_ready_under_current_gate = false`, `blocker_packaging_missing_current_gate
= true`, `sku_packaging_code_mismatch = true`). This is the concrete, live, single
product where PR #77's fix changes the catalogue-ready outcome for already-saved data.

### Corrected operator-attention synthesis

**Priority 1** (multiple confirmed blockers, including the live SKU/packaging
disagreement):
- `OAS-AS-BKL-ASS-RBOX-0002` — SKU/packaging mismatch (current gate) + missing MRP +
  BOM-required-yet-catalogue-ready
- `OAS-AS-BKL-PST-RBOX-0001` — missing MRP + BOM-required-yet-catalogue-ready

**Priority 2** (single confirmed pricing/classification blocker):
- `OAS-AS-BKL-PST-BULK-0001` — missing B2B price
- `OAS-AS-BKL-ROL-MAAPET-0001` — BOM-required-yet-catalogue-ready (HIGH_CONFIDENCE_REVIEW,
  no pricing/packaging blocker)

**Priority 3** (pre-existing legacy pilot SKUs, packaging gap predates any code defect
fixed in PR #75/#77):
- `OAS-AS-BKL-0007`
- `OAS-AS-BKL-0020`
- `OAS-AS-BKL-0024`
- `OAS-AS-BKL-0025`

### Compliance confirmation

Zero rows mutated. No migrations applied. Only `tcxvcatsqqertcnycuop` queried —
`mrkgjemisgbsugfyllwr` was never touched. No keys, tokens, service-role credentials, or
customer data exposed in this document or in any session output — only product
IDs/SKUs/booleans/numbers, all of which are internal catalogue identifiers, not customer
data. No internal_bom history is described as verified anywhere in this section —
Audit C's classifications are explicitly review-candidate labels, never
`VERIFIED_MISCLASSIFIED`.

### R1 queue (existing-product impact handling — not authorized to begin without a
separate explicit instruction)

- **R1A — Owner decision worksheet.** A short, human-reviewed document listing the 8
  products above with their exact blockers, for the owner to decide the correct
  resolution per product (e.g., for `ASS-RBOX-0002`: is `RBOX` or `MAAPET` the correct
  packaging? Is MRP simply missing or should the product be un-marked catalogue-ready
  until priced?). No mutation in this step.
- **R1B — Exact-ID correction script.** Once R1A decisions are made, a SQL script
  (or equivalent) that mutates **only the exact product IDs** listed in R1A's approved
  decisions — no bulk/heuristic correction, no `WHERE` clause broader than an explicit
  ID list.
- **R1C — Staging/dry-run verification.** Run R1B against a verified non-production
  target first (or a `BEGIN ... ROLLBACK` dry-run against production) to confirm the
  exact row-level effect before any real mutation.
- **R1D — Separately approved production correction.** Execute R1B against production
  only after explicit, separate approval — distinct from the approval that authorizes
  R1A/R1B/R1C's preparation.
- **R1E — Controlled generated-types/schema reconciliation.** Regenerate
  `src/integrations/supabase/types.ts` from `tcxvcatsqqertcnycuop` (already flagged as
  needed in `docs/AI_STUDIO_CATALOGUE_AUTHORITY_AUDIT.md`), now with concrete evidence
  of exactly which columns drifted (this section's schema-drift finding). Read-only
  generation only — no migration, no schema change to the live database itself unless
  separately authorized.

---

## POST-R1A PRICING-AUTHORITY RECOVERY (2026-07-10)

R1A (the owner product-decision worksheet, produced and returned in-session, not
committed) surfaced a second, distinct application defect on top of the packaging
mismatch already documented above, plus an unsupported classification in Audit C. Both
are fixed in code and mirrored in `scripts/audits/product_integrity_read_only.sql`;
**neither fix mutated any product row.**

### Defect: MRP channel writer/reader mismatch (fixed)

`resolvePricing()` (`src/features/productAuthority/pricingAuthority.ts`) queried
`channelOf("retail")` to compute MRP and never queried the `"mrp"` channel at all. In
production, `"mrp"` and `"retail"` are separate, independently-used `price_channel`
values (28 approved `retail` rows vs. 15 approved `mrp` rows database-wide) — every
approved mrp-channel rule was being silently ignored by the app, and MRP fell through to
the (usually empty) `products.mrp` field. A read-only blast-radius query confirmed **zero
catalogue-ready products had any approved `retail`-channel rule at all**, so `"retail"`
is not retained as an MRP fallback anywhere — removing it created no verified regression.
Fixed: `resolvePricing()` now calls `channelOf("mrp", ...)`; `products.mrp` remains the
only legacy fallback. A new conflict diagnostic (`reviewRequiredChannels` gains `"mrp"`,
surfaced in `pricingBlockers()` as "MRP needs review — pricing sources disagree") fires
when the selected approved mrp-channel rule disagrees with a positive `products.mrp`
value — the channel rule stays authoritative, but the disagreement is no longer silent.
See `pricingAuthority.ts`'s canonical-semantics docblock for the full producer/consumer
contract and the complete traced-consumer table in the accompanying PR description.

### Defect: BOM-audit heuristic overclaimed internal intent (fixed)

Audit C previously labelled every `bom_required = true AND is_catalogue_ready = true`
row `HIGH_CONFIDENCE_REVIEW` for "potential internal misclassification." That wording was
unsupported by the source: **`bom_required` proves only that a BOM is required. It does
not prove the product is internal or non-sellable.** Packing & Assembly
(`main_department = 'packing_assembly'`) products automatically require a BOM by
design — they are expected BOM candidates, not probable internal products — and gift
hampers and other sellable manufactured products can legitimately require a BOM too.
Fixed: Audit C now classifies packing-assembly rows as
`EXPECTED_BOM_CANDIDATE_PACKING_ASSEMBLY` (not a review signal) and all other
bom_required-and-catalogue-ready rows as `BOM_CATALOGUE_COHERENCE_REVIEW` (worth a human
look at the combination, explicitly not an internal-intent claim). **Do not recommend
changing `bom_required` or `is_catalogue_ready` for any row based on this audit alone —
external, production-team operational evidence is required first.**

### Results (VERIFIED — rerun against `tcxvcatsqqertcnycuop`, exact committed SQL text)

Both changed blocks (the `pricing_summary`/`pricing_summary_raw` CTEs in Audit A, and
Audit C's classification `CASE`) were re-executed read-only, using the literal committed
file text, against the same 11 catalogue-ready rows as the original Phase 1 pass:

- `OAS-AS-BKL-ASS-RBOX-0002`: `resolved_mrp` is now **750** (was `null`); `blocker_mrp_missing`
  is now **false** (was `true`). The product's only remaining SQL-reconstructable blocker
  is the pre-existing SKU-vs-packaging-code mismatch (`blocker_packaging_missing_current_gate
  = true`, unchanged by this fix).
- `OAS-AS-BKL-PST-RBOX-0001`: `resolved_mrp` is now **350** (was `null`);
  `blocker_mrp_missing` is now **false**. This product now has **zero** SQL-reconstructable
  blockers.
- `OAS-AS-BKL-PST-BULK-0001`: unchanged — still blocked on missing B2B price
  (`blocker_b2b_price_missing = true`); its `mrp`-channel rule (₹105/pcs) is not required
  by its `b2b_horeca` sale type and does not affect this blocker.
- `OAS-AS-BKL-0007`: `resolved_mrp` is now **25** (the approved mrp-channel rule, taking
  precedence over `products.mrp = 40` per the declared write-authority rule) and
  `mrp_field_conflict = true` — the ₹25-vs-₹40 disagreement is surfaced directly in this
  new column. It does not gate a blocker (`blocker_mrp_review_required = false`) because
  `0007`'s derived sale type (`b2b_horeca`) does not require MRP at all — the same rule
  `pricingBlockers()` applies app-side. `0007` remains blocked on missing packaging
  (unchanged).
- Every other catalogue-ready row's `resolved_mrp` / blocker set is unchanged by this fix
  (their `mrp`-channel and `products.mrp` values already agreed, or no `mrp`-channel rule
  existed).

**Updated scale:** of the 11 catalogue-ready products, **5 of 11** now have zero
blockers across the SQL-reconstructable dimensions (was 4 of 11) —
`OAS-AS-BKL-CSH-BULK-0001`, `OAS-AS-BKL-PST-LOOSE-9922`, `OAS-AS-BKL-PST-MAAPET-0001`,
`OAS-AS-BKL-PST-RBOX-0001` (newly clean), and `OAS-AS-BKL-ROL-MAAPET-0001`. Product Truth
and Central-preview dimensions remain unverified, as before. Audit C's classification
change is a relabeling only — no row's `bom_required` or `is_catalogue_ready` value
changed, and the same 3 rows (`ASS-RBOX-0002`, `PST-RBOX-0001`, `ROL-MAAPET-0001`) still
surface, now as `EXPECTED_BOM_CANDIDATE_PACKING_ASSEMBLY` (the first two, both
`packing_assembly` department) or `BOM_CATALOGUE_COHERENCE_REVIEW` (`ROL-MAAPET-0001`,
`ready_goods_store`/`arabic_sweets`).

### Revised operator-attention synthesis (supersedes the Priority 1/2/3 list above)

**Priority 1** (remaining confirmed blocker after the pricing fix):
- `OAS-AS-BKL-ASS-RBOX-0002` — SKU/packaging mismatch (current gate) only; MRP is now
  resolved (₹750, approved). BOM-required-yet-catalogue-ready is informational
  (`EXPECTED_BOM_CANDIDATE_PACKING_ASSEMBLY`), not itself a blocker.

**Priority 2** (single confirmed pricing blocker):
- `OAS-AS-BKL-PST-BULK-0001` — missing B2B price (unchanged).

**Priority 3** (pre-existing legacy pilot SKUs, packaging gap predates any code defect
fixed in PR #75/#77/pricing-authority recovery):
- `OAS-AS-BKL-0007` — also carries an `mrp_field_conflict` (₹25 approved rule vs. ₹40
  product field) that does not currently gate a blocker (MRP not required for its sale
  type) but is a genuine, unresolved pricing-source disagreement worth owner attention.
- `OAS-AS-BKL-0020`, `OAS-AS-BKL-0024`, `OAS-AS-BKL-0025` — unchanged.

`OAS-AS-BKL-PST-RBOX-0001` and `OAS-AS-BKL-ROL-MAAPET-0001` are removed from the priority
list — the former now has zero SQL-reconstructable blockers; the latter always did, and
its BOM/catalogue-ready combination is now correctly classified as informational, not a
review-worthy pricing/packaging blocker.

---

## Executive Table

**This table describes the original PR #76 pass only (Audits A–D genuinely not
executed at that time). See "PHASE 1 DURABLE CLOSEOUT" above for the actual executed
results, dated the same day, after the Environment Identity blocker below was
independently resolved by the repository owner.**

| Audit area | Total checked | Verified valid | Verified invalid | Review required | Unverifiable |
|---|---|---|---|---|---|
| A — Catalogue-ready integrity | 0 | 0 | 0 | 0 | **ALL** (blocked — see Environment Identity) |
| B — SKU/packaging consistency | 0 | 0 | 0 | 0 | **ALL** (blocked — see Environment Identity) |
| C — Internal misclassification | 0 | 0 | 0 | 0 | **ALL** (blocked — see Environment Identity) |
| D — Packaging taxonomy integrity | 0 | 0 | 0 | 0 | **ALL** (blocked — see Environment Identity) |
| Code-to-data authority map | 10/10 dimensions traced | — | — | — | 1 (Product Truth score, by design — see below) |
| Async navigation-race check | 1 code path examined | — | 1 confirmed | — | 0 |

**Zero database rows were queried in this original pass.** The blocker below explains
why, and is the single governing fact for every "Unverifiable" cell above — as it stood
at the time this table was written.

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
**UNVERIFIABLE at original write time.** See "Environment Identity" below for the full
evidence trail from that pass. **RESOLVED as of PHASE 1 DURABLE CLOSEOUT above:**
`tcxvcatsqqertcnycuop` (`oasis-baklawa`), confirmed by the repository owner directly
from the live deployed browser bundle's embedded `VITE_SUPABASE_URL`.

## 6. Deployed SHA
**UNVERIFIABLE at original write time** — cannot be determined without first confirming
which Vercel project/deployment is live production (see below). **Still not
independently re-verified this session** — the owner's bundle inspection confirmed the
Supabase project reference, not a specific deployed git SHA. Audits A–D were executed
against repository commit `d3b83e702f0471b91542cc78e8b48d9797b68365` (current `main`);
whether that exact SHA is what Vercel currently serves in production was not
re-confirmed via the Vercel API in this pass (that access gap, documented below,
persisted).

## 7. Audited SHA vs Deployed SHA
**UNVERIFIABLE at original write time** — depended on item 6. **Still UNVERIFIABLE this
pass** for the same reason — see item 6.

---

## Environment Identity — BLOCKER (governs items 5–7 and Audits A–D in the ORIGINAL
## PR #76 pass; see "PHASE 1 DURABLE CLOSEOUT" above for how this was resolved)

**Status at original write time: UNVERIFIABLE.** Every safe, read-only avenue available
in this session was exhausted without conclusively identifying which Supabase project
backs the deployed `oasis-ai-studio` production application.

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

A fourth Bugbot review pass found one more issue, a genuine and fully fixable one:
10. **SKU packaging segment used the wrong function's rules (MEDIUM):** The audit's
    `sku_packaging_segment` extraction was modeled on `isStructuredOasisSku()`'s strict
    regex (`^OAS-[A-Z0-9]+-...-\d{4}$`), but the app's actual packaging-segment extraction
    (`skuPackagingSegment()` in `saveFastCreateProduct.ts`, added in PR #75 for Defect 1)
    is a *different, looser* function: it uppercases the trimmed SKU and takes the 5th of
    exactly 6 dash-separated parts whenever the first is `"OAS"` — no character-class or
    digit-suffix requirement at all. A SKU could satisfy `is_structured_sku` (including via
    its permissive `OAS-`-prefix fallback) yet not have exactly 6 parts, or vice versa —
    the app itself treats these as two independent checks, and this audit's SQL now does
    too. Fixed by replacing the regex/`split_part` extraction with an array-based
    reproduction of `skuPackagingSegment()`'s exact logic
    (`string_to_array(upper(btrim(sku)), '-')`, checking length = 6 and `[1] = 'OAS'`,
    taking `[5]`) across all three occurrences of the CTE.

**Post-audit correction (2026-07-10, branch `fix/post-audit-product-authority-safety-2026-07-10`):**
Item 9 above described the app's multi-row approved-pricing selection as fundamentally
unfixable because `resolvePricing()` had no defined ordering. That has since changed:
11. **Multi-row pricing selection is now a defined, deterministic rule (resolves item 9's
    approximation):** `resolvePricing()` now delegates channel selection to
    `getChannelPrice()`/`compareChannelPriceRows()` (`src/features/productTruth/
    channelPricingMoqEngine.ts`) — the same authority already used by the readiness
    snapshot, Central sync payload, Catalogue Builder, and the Channel Rules panel. The
    rule: among approved, currently-valid (validity-window-respecting) rows for a
    product+channel, the newest by `approved_at` wins; ties (including rows with no
    `approved_at`) are broken by the lowest `id`. `product_pricing_rules` queries in
    `ProductEdit.tsx` now also carry an explicit matching `.order()` for defense-in-depth,
    though the app's selection no longer depends on query order to be correct.
    `resolvePricing()` additionally exposes `reviewRequiredChannels` — populated when more
    than one currently-valid approved row for the same product+channel disagrees in value —
    which `pricingBlockers()` surfaces as an explicit blocker rather than silently trusting
    the newest row. This audit's SQL was updated to match exactly: the former
    `first_approved_pricing` CTE (best-effort, explicitly flagged as an approximation) was
    replaced with `newest_approved_pricing` (an exact, provable reproduction of the new
    rule) plus a `pricing_review_required` CTE surfacing the same disagreement diagnostic
    as `blocker_mrp_review_required` / `blocker_b2b_price_review_required` /
    `blocker_export_price_review_required` columns. Item 9's original "REVIEW_REQUIRED,
    not trusted at face value" guidance is retained here for historical accuracy — it now
    describes an explicit, queryable diagnostic instead of an unresolved gap. Audit A
    remains UNVERIFIABLE overall (still not executed — see Environment Identity), so this
    is a code/SQL alignment record, not new data evidence.

**Schema gap confirmation — internal/not-for-sale intent (no fix in this PR):** NEW-2 above
remains the authoritative treatment of this gap and is unchanged by the post-audit fix PR.
Restated briefly per that PR's explicit "document only" scope:
- Historical internal misclassification cannot be conclusively reconstructed because
  `sale_type` has never been a persisted `products` column — there is no field to read the
  original intent back from for products saved before, or outside, PR #75's Defect 2 guard.
- `bom_required = true` and `main_department = 'packing_material'` are the only two
  available signals, and both are weak/indirect (a `bom_required` product can still be
  legitimately sold as a component) — the audit SQL's Audit C therefore classifies matches
  as review candidates only, never as `VERIFIED_MISCLASSIFIED`. (Naming updated by the
  POST-R1A PRICING-AUTHORITY RECOVERY section above: the former `HIGH_CONFIDENCE_REVIEW`
  label overclaimed internal-intent confidence and has been replaced with
  `EXPECTED_BOM_CANDIDATE_PACKING_ASSEMBLY` / `BOM_CATALOGUE_COHERENCE_REVIEW` —
  `POSSIBLE_REVIEW` is unchanged.)
- A durable fix would need a real `sale_type` (or `is_for_sale`) column — a schema/migration
  change that belongs to a separately approved Supabase Core design task, not this frontend
  PR. No schema, migration, or product data change was made here for this gap.

---

## 10. Catalogue-Ready Integrity Results (Audit A)
**UNVERIFIABLE at original write time — not executed then.** Query drafted in
`product_integrity_read_only.sql` (section "AUDIT A"). It reproduces
`evaluateCatalogueReadyGate()`'s blocker list (structured-SKU check, sale-type-aware
MRP/B2B/export price blockers, packaging presence, hero image presence) as SQL, with
Product Truth explicitly left unverifiable per the authority-map note above.
**EXECUTED as of PHASE 1 DURABLE CLOSEOUT above** — see that section for full results
(4 of 11 catalogue-ready products with no SQL-reconstructable blockers at that time;
Product Truth still unverified by design). **Updated by POST-R1A PRICING-AUTHORITY
RECOVERY above — now 5 of 11**, after the MRP channel-consumption fix resolved
`OAS-AS-BKL-PST-RBOX-0001`'s previously-missing MRP.

## 11. SKU/Packaging Consistency Results (Audit B)
**UNVERIFIABLE at original write time — not executed then.** Full 9-category classifier
(`MATCH` through `NOT_APPLICABLE`) is drafted, including the two subtle cases the brief
specifically asked to be tested for: whitespace-only `packaging_code` (drafted to
classify as `SAVED_PACKAGING_MISSING` at the SQL level, distinct from how the
*application* would treat it — see Finding NEW-1 below) and case-mismatch-only agreement
(`CASE_OR_WHITESPACE_NORMALIZATION_ONLY`). **EXECUTED as of PHASE 1 DURABLE CLOSEOUT
above** — 364 products: 322 not-applicable, 41 match, exactly 1 mismatch
(`OAS-AS-BKL-ASS-RBOX-0002`).

## 12. Internal-Classification Results (Audit C)
**UNVERIFIABLE at original write time — not executed then**, and separately,
**structurally limited even once executed** — see Finding NEW-2 below. The drafted
query can only ever produce `HIGH_CONFIDENCE_REVIEW` / `POSSIBLE_REVIEW` /
`UNVERIFIABLE_BECAUSE_SALE_TYPE_WAS_NOT_PERSISTED`, never `VERIFIED_MISCLASSIFIED`,
because no durable field in this schema has ever recorded original sale-type intent.
**EXECUTED as of PHASE 1 DURABLE CLOSEOUT above** — 3 rows flagged (originally labelled
`HIGH_CONFIDENCE_REVIEW`), still never claimed as verified misclassifications. **Updated
by POST-R1A PRICING-AUTHORITY RECOVERY above** — the label itself overclaimed
internal-intent confidence and has been corrected to
`EXPECTED_BOM_CANDIDATE_PACKING_ASSEMBLY` (2 of the 3 rows, both `packing_assembly`
department) / `BOM_CATALOGUE_COHERENCE_REVIEW` (the third); no row's underlying
`bom_required` or `is_catalogue_ready` value changed.

## 13. Packaging Taxonomy Results (Audit D)
**UNVERIFIABLE at original write time — not executed then.** Query drafted; see Finding
NEW-1 for the code-level conclusion this section was specifically asked to reach
(`hasPackagingTaxonomyCode` safety classification), which **was** completed via static
analysis independent of database access. **EXECUTED as of PHASE 1 DURABLE CLOSEOUT
above** — 318 of 364 products fail on missing packaging code, only 4 catalogue-ready
(the same 4 legacy pilot SKUs as Audit A); new current-gate columns added and verified
uniformly consistent for this row set.

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
4. **Data review — BOM/catalogue coherence candidates** (Finding NEW-2 category;
   reclassified by POST-R1A PRICING-AUTHORITY RECOVERY above — the original
   `HIGH_CONFIDENCE_REVIEW` label overclaimed internal-intent confidence):
   `BOM_CATALOGUE_COHERENCE_REVIEW` rows (`bom_required = true AND is_catalogue_ready = true`,
   excluding `packing_assembly`-department rows, which are expected BOM candidates, not
   review candidates) warrant operator review once queryable; cannot be auto-corrected
   without provable original intent or external production-team confirmation.
5. **Schema follow-up (separate, larger effort, not scoped here):** a persisted
   `sale_type`/`is_for_sale` column and a persisted Product Truth snapshot would close
   the two structural schema gaps above.

## 20. Confirmation: No Production Data Changed

**At original write time (PR #76 pass):**
- No SQL was executed against any database in that session — confirmed by the fact that
  no Supabase/Postgres query tool call targeting row data appeared anywhere in that
  audit's tool-call history; only `list_projects` (metadata only) was called.

**As of PHASE 1 DURABLE CLOSEOUT (this pass, after identity was resolved):**
- `scripts/audits/product_integrity_read_only.sql` WAS executed, read-only, against
  `tcxvcatsqqertcnycuop` — `products`, `sku_code_rules`, `product_pricing_rules`,
  `product_media`, and `information_schema.columns` rows WERE read.
- **Zero rows were written, updated, deleted, or otherwise mutated.** Every statement
  ran inside `BEGIN TRANSACTION READ ONLY` with `SET LOCAL statement_timeout = '30s'`,
  followed by unconditional `ROLLBACK`.
- No `is_catalogue_ready`, `sku`, `product_class`, or `packaging_code` value was changed
  anywhere, in any repository, at any point across either pass.
- Only `tcxvcatsqqertcnycuop` was queried. `mrkgjemisgbsugfyllwr` was never touched.
- No migration applied, no schema altered.
- **Confirmed by explicit tool-call log**, not merely asserted.

**As of POST-R1A PRICING-AUTHORITY RECOVERY (this pass, after the MRP-channel and
BOM-audit-classification fixes):**
- The corrected `scripts/audits/product_integrity_read_only.sql` (Audit A's
  `pricing_summary`/`pricing_summary_raw` CTEs, Audit C's classification `CASE`) WAS
  re-executed, read-only, against `tcxvcatsqqertcnycuop`, using the exact committed file
  text, inside `BEGIN TRANSACTION READ ONLY` / `SET LOCAL statement_timeout = '30s'` /
  `ROLLBACK`. **Zero rows were written, updated, deleted, or otherwise mutated.**
- No `products`, `product_pricing_rules`, or `sku_code_rules` row was changed anywhere,
  in any repository, at any point across all three passes.
- Only `tcxvcatsqqertcnycuop` was queried. `mrkgjemisgbsugfyllwr` was never touched.
- No migration applied, no schema altered.

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
