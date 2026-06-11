# Staging Environment Recovery / Provisioning Assessment

**Task:** PR06C1b verification environment  
**Date:** 2026-06-10  
**Investigation only** — no migrations applied, no branches created, no production writes  
**Production Central:** `tcxvcatsqqertcnycuop` (oasis-baklawa, `ACTIVE_HEALTHY`)

---

## Executive summary

| Question | Answer |
|----------|--------|
| Fastest safe path | **Supabase preview branch** on `tcxvcatsqqertcnycuop` (dashboard or MCP after cost confirm) |
| `aruyieslaxjhnamlstpx` recoverable? | **Unknown / not in org** — not recoverable via agent; owner must locate in dashboard |
| Branch from production possible? | **Yes** (Pro plan; $0.01344/hr per branch) — schema from production migrations; **no production data** |
| Temporary verification env possible? | **Yes** — branch (preferred) or backup-restore to new project |
| Production-only testing | **Reject** — prior PR06C1a incident; explicit programme constraint |
| Wave 4A safe after verification? | **Yes, only after** staging: apply PR06C1b → 1 draft → 1 approve → verify SQL |

**Recommended:** Create a short-lived preview branch `pr06c1b-verify`, seed minimal test rows, apply PR06C1b migration on the branch only, run the one-draft test, delete the branch. Do **not** merge the branch to production.

---

## PR06C1b verification requirements

| Step | What | Production impact |
|------|------|-------------------|
| 1 | Apply `20260610231247_pr06c1b_packaging_product_approve_mapping.sql` | None (staging/branch only) |
| 2 | Insert **one** `catalogue_product_drafts` packaging update | None |
| 3 | Call `approve_catalogue_product_draft` as reviewer | None |
| 4 | Run `scripts/supabase/PR06C1b_packaging_mapping_verify.sql` | Read-only |
| 5 | Confirm 8 packaging columns + `pack_size` on test SKU | None |

**Test SKU (production baseline for reference):**

| Field | Value |
|-------|-------|
| SKU | `OAS-AS-BKL-0001` |
| UUID | `c7c0c5aa-1d2f-4088-88f1-1e5aacd321a0` |
| Current `pack_size` | `3kg` |
| Current `grams_per_piece` | `null` |
| Current `pcs_per_kg` | `0` |

Branches start **without** this row — a minimal seed or selective `pg_dump` of one product is required.

---

## Current org inventory (MCP `list_projects`, 2026-06-10)

| Ref | Name | Status | Role / notes |
|-----|------|--------|--------------|
| `tcxvcatsqqertcnycuop` | oasis-baklawa | **ACTIVE_HEALTHY** | Live Central / production |
| `qalcsnemypavgjyocibd` | oasis-erp-v1 | INACTIVE | Paused; SQL connection **timeout** |
| `aahmmmyxgukvbvhzukrm` | oasisbaklawa2006@gmail.com's Project | INACTIVE | Paused; likely legacy |
| `ujvutydlqzlpamhlgjqg` | B2B simple | INACTIVE | Paused |
| `aruyieslaxjhnamlstpx` | *(not listed)* | **Not in org** | Documented as “intended staging” in `docs/SUPABASE_ENV_MAP.md` only |

Production has PR06C1a migrations applied (`pr06c1_central_tag_alias_approve_mapping`, etc.). **PR06C1b is not** in production migration history.

---

## Option 1 — Supabase preview branch (recommended)

Create an isolated branch off `tcxvcatsqqertcnycuop`. Schema is derived from production migration history; data is **not** copied (Supabase docs: branches are “data-less” by design).

### How to provision

**Dashboard (fastest for owner):**

1. User menu → enable **Branching via dashboard** (if not already on).
2. Open `oasis-baklawa` → branch dropdown → **Create branch** (requires Owner/Admin first time).
3. Name: `pr06c1b-verify`.
4. Wait for health (Clone → Pull → Migrate → Seed pipeline; typically **5–20 minutes**).

**CLI / MCP (alternative):**

- MCP `get_cost`: **$0.01344/hour** per branch (Micro compute baseline).
- MCP `create_branch` requires `confirm_cost_id` and states: migrations from main are applied; **production data does not carry over**.
- Agent `list_branches` on production returned a permissions error — **owner action in dashboard likely required**.

### Post-create setup (required because branch has no data)

1. **Minimal seed** via branch SQL editor or `psql` to branch credentials:
   - One `products` row mirroring `OAS-AS-BKL-0001` (use production snapshot above).
   - One auth user with `is_catalogue_reviewer()` = true (or use service-role + `SET LOCAL role` only if your RPC allows — prefer real reviewer JWT).
2. **Apply PR06C1b only on branch** (not via merge to main):
   ```bash
   psql "$BRANCH_DATABASE_URL" -f supabase/migrations/20260610231247_pr06c1b_packaging_product_approve_mapping.sql
   ```
3. Run verify SQL, one draft, one approve, re-query product.
4. **Delete branch** when done (stops hourly billing).

### Option matrix

| Dimension | Assessment |
|-----------|------------|
| **Setup effort** | **Low–medium** — one dashboard click + ~30-line seed SQL + manual PR06C1b apply on branch |
| **Cost** | **~$0.01344/hr** compute + minor disk/egress; **~$0.05–0.15** for a 4-hour session; delete immediately after |
| **Time to verification** | **1–3 hours** wall clock (branch spin-up 5–20 min + seed 15 min + test 30–45 min) |
| **Verification suitability** | **High** for function/RPC mapping test; **medium** for full auth/UI path (branch has separate Auth) |
| **Rollback capability** | **Excellent** — delete branch; production untouched. Test product data discarded with branch. |

### Risks

| Risk | Mitigation |
|------|------------|
| Accidental **merge branch → production** deploys PR06C1b early | Do not create merge request; delete branch after test; apply PR06C1b to production only via controlled migration run |
| Branch has **no product rows** | Run minimal seed before draft test |
| **Reviewer auth** differs on branch | Create test reviewer in branch Auth or run approve via SQL editor as superuser with `auth.uid()` stub (document who approved) |
| Branch **auto-pauses** | First connection may timeout; retry wakes branch |
| Migration history on branch may **diverge** from repo `supabase/migrations/` | Production uses dashboard-applied migrations (130+ versions); branch pulls from production history — PR06C1b still applied manually on branch |

---

## Option 2 — Recover `aruyieslaxjhnamlstpx` (intended staging)

### Findings

- Ref `aruyieslaxjhnamlstpx` appears **only** in `docs/SUPABASE_ENV_MAP.md` as “intended staging (not verified)”.
- **Not present** in org `ougpjedkzjepjigynivr` project list via MCP.
- Agent cannot query or restore it.

### Recoverability assessment

| Scenario | Likelihood | Action |
|----------|------------|--------|
| Project in **another Supabase org** | Possible | Owner searches all orgs in dashboard |
| Project **paused** outside this token’s scope | Possible | Locate in dashboard → Restore project |
| Project **deleted** (>90 days paused on free tier) | Possible | Restore from downloaded `.backup` to new project |
| Typo / deprecated ref | Possible | Update `SUPABASE_ENV_MAP.md` with correct ref |

### Option matrix

| Dimension | Assessment |
|-----------|------------|
| **Setup effort** | **Unknown** — blocked on owner locating project |
| **Cost** | $0 if restorable pause; ~$10/mo if new project needed |
| **Time to verification** | **0 hours** if found and Central-current; **4–8+ hours** if backup restore required |
| **Verification suitability** | **High** if project is a true Central clone with live product data |
| **Rollback capability** | Good if dedicated staging; poor if stale schema |

### Risks

- Schema may be **months behind** production Central.
- May not have PR06C1a function baseline.
- **False confidence** if staging was never kept in sync.

**Verdict:** Do not block on this ref until owner confirms it exists. If not found within one dashboard check, use Option 1 or 3.

---

## Option 3 — Restore inactive org project

Three **INACTIVE** projects exist. `execute_sql` on `qalcsnemypavgjyocibd` failed with **connection timeout** (expected for paused projects).

### Restore steps (owner, dashboard)

1. Open project card → **Restore project** (available if within 90-day pause window).
2. Wait until status = `ACTIVE_HEALTHY`.
3. Verify schema: `approve_catalogue_draft_internal`, `catalogue_product_drafts`, `products` with Batch 001 SKUs.

### Option matrix

| Dimension | Assessment |
|-----------|------------|
| **Setup effort** | **Medium** — restore + schema validation + likely data refresh from production backup |
| **Cost** | Free tier resume = $0; Pro = ~$10/mo while active |
| **Time to verification** | **2–6 hours** (restore 5–30 min + validation + possible re-seed) |
| **Verification suitability** | **Low–medium** until proven Central-equivalent |
| **Rollback capability** | Pause project again; no production impact |

### Risks

- `oasis-erp-v1` / legacy projects may **not** be Central catalogue schema.
- Stale data vs current `tcxvcatsqqertcnycuop`.
- Two active DBs increase **wrong-target** risk (document ref in `SUPABASE_ENV_MAP.md` before any SQL).

**Verdict:** Fallback only if branching unavailable. Prefer `oasis-erp-v1` restore **only after** schema spot-check confirms catalogue tables + PR06C1a function.

---

## Option 4 — New temporary project + production backup restore

Clone production **data + schema** into a dedicated verification project.

### Steps

1. Dashboard → `tcxvcatsqqertcnycuop` → **Database backups** → download latest `.backup` (Pro: 7-day backups included).
2. `create_project` in `ap-south-1` (MCP cost: **~$10/month**).
3. Restore backup via `pg_restore` / pooler connection (Supabase restore guide).
4. Apply PR06C1b migration on **new project only**.
5. Run one-draft test; **pause or delete** project after sign-off.

### Option matrix

| Dimension | Assessment |
|-----------|------------|
| **Setup effort** | **High** — backup download, new project, restore, credential wiring |
| **Cost** | **~$10/mo** minimum (Pro); delete within days to limit spend |
| **Time to verification** | **3–8 hours** (restore time scales with DB size; Central has 300+ products) |
| **Verification suitability** | **Highest** — real product rows, real reviewer roles, full RPC fidelity |
| **Rollback capability** | **Excellent** — delete project; zero production coupling |

### Risks

- Restore may include **PII** — treat project as sensitive, restrict access, delete promptly.
- Wrong connection string → accidental production writes (use ref assertion checklist).
- Higher cost if left running.

**Verdict:** Best when branching auth/seed friction blocks the test, or when full-data fidelity is mandatory before Wave 4A-1 (10 SKUs).

---

## Option 5 — Local `supabase start`

Repo `supabase/config.toml` points to legacy ref `wgajrxyoararisiwjzox`, not Central.

| Dimension | Assessment |
|-----------|------------|
| **Setup effort** | Medium — local Docker, migration replay |
| **Cost** | $0 |
| **Time** | 2–4 hours to align schema |
| **Verification suitability** | **Low** — `is_catalogue_reviewer()` / `auth.uid()` / production-specific roles unlikely to match |
| **Rollback** | N/A (local only) |

**Verdict:** Useful for SQL syntax check only; **not** sufficient for governed approval verification.

---

## Option 6 — Production-only test (`tcxvcatsqqertcnycuop`)

| Dimension | Assessment |
|-----------|------------|
| **Setup effort** | Lowest |
| **Cost** | $0 marginal |
| **Time** | ~30 minutes |
| **Verification suitability** | Technically valid |
| **Rollback** | Poor — master writes + audit rows; cleanup script needed |

### Why reject

1. Programme rule: **do not apply to production** / **no production impact**.
2. **PR06C1a incident** (2026-06-02): staging intent executed on live Central (`docs/SUPABASE_ENV_MAP.md`).
3. Approving even one packaging draft **mutates** `products` and `catalogue_approval_audit`.
4. Sets precedent for Wave 4A bulk approvals on production.

**Verdict:** **Reject.** Non-negotiable for this programme.

---

## Comparison table

| Option | Setup | Cost (typical) | Time to verify | Suitability | Rollback | Recommended |
|--------|-------|----------------|----------------|-------------|----------|-------------|
| **1. Preview branch** | Low–med | ~$0.05–0.50/session | **1–3 h** | High | Excellent | **Yes** |
| **2. aruyieslaxjhnamlstpx** | Unknown | Unknown | Unknown | High if real | Good | Only if owner finds it |
| **3. Restore inactive project** | Medium | $0–10/mo | 2–6 h | Low–med | Good | Fallback |
| **4. Backup → new project** | High | ~$10/mo | 3–8 h | Highest | Excellent | If branch blocked |
| **5. Local supabase** | Medium | $0 | 2–4 h | Low | N/A | No |
| **6. Production** | Lowest | $0 | 30 min | High | Poor | **Reject** |

---

## Recommended path (aligned with owner decision)

### Phase A — Provision (owner, ~30–60 min)

1. Confirm Pro plan on `tcxvcatsqqertcnycuop` (branching requires Pro+).
2. Dashboard → **Create branch** `pr06c1b-verify`.
3. Copy branch **database URL** and **anon/service keys** (Settings → API on branch).

### Phase B — Seed minimal data (~15 min)

Insert one product row (from production snapshot) and ensure a catalogue reviewer exists on the branch. Optional: add `supabase/seed.pr06c1b_verify.sql` to repo for repeatability (not required for this investigation).

### Phase C — PR06C1b test (~45 min)

1. Apply PR06C1b migration on **branch only**.
2. Run `PR06C1b_packaging_mapping_verify.sql` → expect PASS on queries 1–2.
3. Insert **one** packaging draft for `c7c0c5aa-1d2f-4088-88f1-1e5aacd321a0`.
4. Approve once; confirm 8 packaging fields + `pack_size` unchanged at `3kg` with scalars populated.
5. Confirm `mrp` / `price_b2b` unchanged.

### Phase D — Teardown (~5 min)

1. Delete branch `pr06c1b-verify` (stop billing).
2. Update `docs/SUPABASE_ENV_MAP.md` with branch ref pattern or restored staging ref.

### Phase E — Programme unlock (only after Phase C passes)

| Step | Gate |
|------|------|
| Merge PR06C1b to `main` | After code review (already MERGE-ready) |
| Apply PR06C1b to **production** | Separate owner sign-off after staging pass |
| Wave 4A-1 (10 SKUs) | After production PR06C1b apply + spot-check |
| Full packaging rollout | After Wave 4A-1 success |

---

## Estimated time to verification

| Path | Owner-active time | Calendar (with waits) |
|------|-------------------|------------------------|
| **Preview branch (recommended)** | **1.5–2.5 hours** | Same day |
| Backup → new project | 3–5 hours | Same day |
| Restore inactive + validate | 2–4 hours | 1–2 days if schema stale |
| Locate `aruyieslaxjhnamlstpx` | 0–8 hours | Depends on owner |

---

## Wave 4A proceed / production-only decision

| Question | Answer |
|----------|--------|
| Can Wave 4A proceed safely **now**? | **No** — PR06C1b not applied anywhere; no one-draft staging proof |
| Can Wave 4A proceed after recommended path? | **Yes** — staging proof → production PR06C1b apply → Wave 4A-1 (10 SKUs) with inbox review, no bulk approve |
| Should production-only testing be used? | **No — reject.** Fastest ≠ safe; violates programme constraints and repeats PR06C1a incident pattern |

---

## Agent actions taken (this task)

- Listed all org projects via Supabase MCP
- Confirmed `aruyieslaxjhnamlstpx` absent from org
- Confirmed production PR06C1b **not** deployed (`NO_PACKAGING` on function def)
- Confirmed test SKU baseline on production (read-only)
- Quoted branch cost via MCP `get_cost`: $0.01344/hour
- Attempted inactive project SQL → timeout (paused)
- **Did not** create branch, apply migration, or approve drafts

---

## Related docs

- `docs/PR06C1B_FINAL_GATE_AND_STAGING_VERIFICATION.md`
- `docs/PR06C1B_PACKAGING_APPROVAL_MAPPING.md`
- `docs/SUPABASE_ENV_MAP.md`
- [Supabase Branching](https://supabase.com/docs/guides/deployment/branching)
- [Dashboard branching](https://supabase.com/docs/guides/deployment/branching/dashboard)
