# PR06C1b Production Apply Pack

**Status:** Ready for **owner-executed** production apply  
**Preview verification:** **PASS** on branch `pr06c1b-verify` (`dqqhpdfmgcuopuylnkyh`) — 2026-06-11  
**Production project:** `tcxvcatsqqertcnycuop` (oasis-baklawa / Central)  
**Agent policy:** Do **not** auto-apply. Do **not** approve Wave 4A drafts. Do **not** bulk-run.

---

## Prerequisites (must be true before apply)

| # | Gate | Status |
|---|------|--------|
| 1 | PR06C1b code merged to `main` | Owner confirm |
| 2 | Preview branch one-draft test passed | **PASS** (draft `50ba3fea-a161-453e-ae61-d86f80b0b070`) |
| 3 | Production function still PR06C1a baseline | **Confirmed** (`PR06C1a_BASELINE`, no `packaging_scalars` in def) |
| 4 | Owner explicit sign-off for production SQL | Required |
| 5 | Maintenance window / reviewer available for post-apply spot-check | Recommended |

---

## 1. Exact migration file to apply

**Single file — function replace only (no table DDL):**

```
supabase/migrations/20260610231247_pr06c1b_packaging_product_approve_mapping.sql
```

**What it changes:**
- `CREATE OR REPLACE FUNCTION public.approve_catalogue_draft_internal` — product branch adds 8 packaging scalar mappings + `pack_size` precedence fix
- Tag branch (`catalogue_tag_drafts`) — **unchanged** vs PR06C1a
- Alias branch (`catalogue_alias_drafts`) — **unchanged** vs PR06C1a

**What it does NOT change:**
- No `ALTER TABLE`
- No RLS / policy changes
- No `approve_catalogue_product_draft` wrapper (already exists on production)
- No product master data (until a draft is approved)

---

## 2. Exact pre-apply read-only checks

Run on **`tcxvcatsqqertcnycuop` only**. All queries are `SELECT` — no writes.

### 2a. Project ref assertion (mandatory)

Before any SQL client connection, confirm target:

| Check | Expected |
|-------|----------|
| Dashboard project name | `oasis-baklawa` |
| Project ref in URL | `tcxvcatsqqertcnycuop` |
| Connection host contains | `tcxvcatsqqertcnycuop` |

```bash
# If using psql, echo the host before connecting:
echo "$DATABASE_URL" | grep -q tcxvcatsqqertcnycuop && echo "REF OK" || echo "STOP — wrong project"
```

### 2b. Function baseline — must be PR06C1a, not PR06C1b

```sql
-- EXPECT: PR06C1a_BASELINE (apply only if this row appears)
SELECT
  CASE
    WHEN pg_get_functiondef(p.oid) LIKE '%packing,packaging_scalars,grams_per_piece%'
    THEN 'ALREADY_HAS_PR06C1b — STOP, do not re-apply'
    WHEN pg_get_functiondef(p.oid) LIKE '%catalogue_tag_drafts%'
     AND pg_get_functiondef(p.oid) LIKE '%catalogue_alias_drafts%'
    THEN 'PR06C1a_BASELINE — safe to apply PR06C1b'
    ELSE 'UNEXPECTED — investigate before apply'
  END AS pre_apply_function_state
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'approve_catalogue_draft_internal';
```

### 2c. Wrapper exists

```sql
-- EXPECT: true
SELECT EXISTS (
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'approve_catalogue_product_draft'
) AS has_approve_wrapper;
```

### 2d. Migration history — PR06C1b not yet recorded

```sql
-- EXPECT: 0 rows (if your project tracks named migrations)
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE name ILIKE '%pr06c1b%'
   OR version = '20260610231247';
```

> Production uses dashboard-applied migrations; absence in `schema_migrations` is normal. The function baseline check (2b) is the authoritative gate.

### 2e. Pending packaging drafts inventory (awareness only)

```sql
SELECT id, status, operation, target_record_id,
       payload->>'source' AS source,
       payload #>> '{sku_draft,sku}' AS sku,
       submitted_at
FROM catalogue_product_drafts
WHERE status = 'pending_approval'
ORDER BY submitted_at DESC
LIMIT 20;
```

**Do not approve any packaging drafts until post-apply verification passes.**

### 2f. Test SKU baseline snapshot (for post-apply spot-check reference)

```sql
SELECT id, sku, pack_size, grams_per_piece, pcs_per_kg, primary_pack_weight_kg,
       pcs_per_primary_pack, carton_type, pcs_per_master_carton,
       packs_per_master_carton, packs_per_carton, mrp, price_b2b, hsn_code, category
FROM products
WHERE sku = 'OAS-AS-BKL-0001';
```

**Current production baseline (2026-06-11):** `pack_size=3kg`, `grams_per_piece=null`, `pcs_per_kg=0`, `mrp=60`, `price_b2b=850`, `hsn_code=21069099`, `category=Lebanese Baklawa`.

### 2g. Backup confirmation (owner)

- [ ] Confirm Supabase automatic backup is current (Pro: 7-day retention)
- [ ] Optional: note latest backup timestamp from Dashboard → Database → Backups

---

## 3. Exact apply instruction

**Do not run via agent automation.** Owner executes manually after ref assertion.

### Option A — psql (recommended)

```bash
# 1. Set production session pooler URL (Dashboard → Connect → Session mode)
#    MUST contain tcxvcatsqqertcnycuop
export DATABASE_URL='postgresql://postgres.[ref]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres'

# 2. Assert ref
echo "$DATABASE_URL" | grep -q tcxvcatsqqertcnycuop || { echo "WRONG PROJECT — abort"; exit 1; }

# 3. Apply exactly this file from repo checkout at merged main
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20260610231247_pr06c1b_packaging_product_approve_mapping.sql
```

### Option B — Supabase Dashboard SQL Editor

1. Open project **`tcxvcatsqqertcnycuop`** (verify ref in browser URL).
2. SQL Editor → New query.
3. Paste **entire contents** of `supabase/migrations/20260610231247_pr06c1b_packaging_product_approve_mapping.sql`.
4. Run once. Expect success with no errors.
5. **Do not** run on any other project or preview branch.

### Option C — Supabase CLI (if linked to Central)

```bash
supabase link --project-ref tcxvcatsqqertcnycuop
# Apply single migration file only — do not db push entire pending queue blindly
psql "$(supabase db url)" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20260610231247_pr06c1b_packaging_product_approve_mapping.sql
```

### Apply scope guardrails

| Do | Don't |
|----|-------|
| Apply **only** the one migration file above | `supabase db push` without reviewing pending migrations |
| Apply to `tcxvcatsqqertcnycuop` | Apply to preview branch `dqqhpdfmgcuopuylnkyh` again |
| Stop on first SQL error (`ON_ERROR_STOP=1`) | Approve any draft during apply window |

---

## 4. Exact post-apply verification SQL

Run on **`tcxvcatsqqertcnycuop`** immediately after apply.

### 4a. Full verification script (read-only)

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/supabase/PR06C1b_packaging_mapping_verify.sql
```

### 4b. Expected results

| Query | Expected output |
|-------|-----------------|
| 1 `definition_check` | `PASS: packaging_scalars + pack_size precedence present` |
| 2 `branch_preservation_check` | `PASS: tag + alias branches preserved` |
| 3 payload dry-run | `expected_pack_size=3kg`, `expected_grams=18`, `expected_pcs_per_kg=55.56`, `expected_carton_type=666` |

### 4c. Additional production sanity check

```sql
-- EXPECT: HAS_PR06C1b
SELECT
  CASE
    WHEN pg_get_functiondef(p.oid) LIKE '%packing,packaging_scalars,grams_per_piece%'
    THEN 'HAS_PR06C1b'
    ELSE 'MISSING_PR06C1b — apply failed'
  END AS post_apply_state
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'approve_catalogue_draft_internal';
```

### 4d. Confirm no accidental master mutation during apply

```sql
-- EXPECT: same as pre-apply snapshot (2f) — packaging still null/0 until a draft is approved
SELECT sku, grams_per_piece, pcs_per_kg, mrp, price_b2b
FROM products
WHERE sku = 'OAS-AS-BKL-0001';
```

**Apply alone must not change product rows.** If `grams_per_piece` or `pcs_per_kg` changed without a draft approval, stop and investigate.

### 4e. Optional one-draft production spot-check (after 4a–4d pass)

Only if owner wants production RPC proof before Wave 4A-1:

1. Record before snapshot (2f).
2. Submit **one** packaging update draft for `OAS-AS-BKL-0001` via governed app path (not bulk SQL).
3. Approve **one** draft in Approval Inbox.
4. Confirm packaging fields match preview branch results; `mrp` / `price_b2b` / `hsn_code` / `category` unchanged.

This is **optional** — preview branch already proved mapping. Skip if minimizing production writes.

---

## 5. Rollback plan

Function replacement is reversible. **Approved master data is not auto-reverted.**

### When to rollback

- Post-apply verify query 1 or 2 returns `FAIL`
- Unexpected behavior on first production packaging approval
- Owner decision to halt Wave 4A

### Rollback steps

1. **Assert ref** — `tcxvcatsqqertcnycuop` only.

2. **Re-deploy PR06C1a function** from repo:

```bash
# Extract and run the approve_catalogue_draft_internal block from:
# scripts/supabase/PR06C1_central_tag_alias_approve_mapping.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/supabase/PR06C1_central_tag_alias_approve_mapping.sql
```

> This file also includes `catalogue_slugify_tag_part` (idempotent). It restores pre-PR06C1b product branch behavior.

3. **Verify rollback:**

```bash
psql "$DATABASE_URL" -f scripts/supabase/PR06C1b_packaging_mapping_verify.sql
```

| Query | Expected after rollback |
|-------|-------------------------|
| 1 | `FAIL: expected PR06C1b mappings missing` |
| 2 | `PASS: tag + alias branches preserved` |

4. **Data cleanup (if a packaging draft was approved after PR06C1b):**

```sql
-- Restore from pre-approve snapshot; example for OAS-AS-BKL-0001 only
UPDATE products SET
  grams_per_piece = NULL,
  pcs_per_kg = 0,
  primary_pack_weight_kg = 0,
  pcs_per_primary_pack = 0,
  carton_type = NULL,
  pcs_per_master_carton = NULL,
  packs_per_master_carton = NULL,
  packs_per_carton = NULL
WHERE sku = 'OAS-AS-BKL-0001'
  AND id = 'c7c0c5aa-1d2f-4088-88f1-1e5aacd321a0';
-- Adjust values to match your saved before snapshot.
```

5. **Do not rollback** without owner approval (`docs/SUPABASE_ENV_MAP.md`).

### Rollback limitations

| Reverted by function rollback | Not reverted |
|-------------------------------|--------------|
| Future approvals use PR06C1a mapping | Already-written `products` packaging columns |
| | `catalogue_approval_audit` rows |
| | Approved draft status |

---

## 6. Wave 4A-1 go/no-go checklist

Wave 4A-1 = governed submission + inbox approval for **first 10 SKUs** in Batch 001 packaging wave. **Not** bulk approve.

### GO criteria (all required)

| # | Criterion | Owner sign-off |
|---|-----------|----------------|
| 1 | PR06C1b applied to `tcxvcatsqqertcnycuop` | ☐ |
| 2 | `PR06C1b_packaging_mapping_verify.sql` queries 1–2 = `PASS` | ☐ |
| 3 | Post-apply query 4d confirms no accidental master mutation | ☐ |
| 4 | Preview branch test documented (draft `50ba3fea-…`, packaging fields matched) | ☑ (done) |
| 5 | PR #44 / PR06C1b merged to `main` | ☐ |
| 6 | Wave 4A draft payloads reviewed (no SKU 0025; collision report clear) | ☐ |
| 7 | Submit guardrails active (`CONFIRM_LIVE_SUBMIT=true` for live submit) | ☐ |
| 8 | Reviewer available for **individual** inbox approvals | ☐ |

### NO-GO conditions (any triggers halt)

- [ ] Pre-apply check 2b returns `ALREADY_HAS_PR06C1b` before intended apply (skip re-apply)
- [ ] Post-apply verify query 1 or 2 = `FAIL`
- [ ] Any plan to bulk-approve multiple packaging drafts in one session
- [ ] PR06C1b not on production but Wave 4A submissions queued for approval
- [ ] Wrong project ref in connection string

### Wave 4A-1 execution rules (after GO)

1. **Submit only** — use governed scripts; dry-run default; no bulk live submit without explicit confirm.
2. **Approve max 10 SKUs** in Wave 4A-1 — one at a time via Approval Inbox; human payload review each.
3. **Spot-check after first 2 approvals** — confirm `pack_size` is authority value (e.g. `3kg`), not `primary_pack_type` label (`Tray 3kg`); confirm `mrp`/`price_b2b` unchanged.
4. **No Central sync** or downstream propagation until Wave 4A-1 spot-check passes.
5. **Pause** if any approval writes unexpected identity/pricing fields.

### Wave 4A-1 verdict template

| State | Condition |
|-------|-----------|
| **NO-GO** | PR06C1b not applied + verified on production |
| **NO-GO** | Bulk approve planned or in progress |
| **GO** | Production apply + verify PASS + owner sign-off + individual 10-SKU plan confirmed |

**Current recommendation (pre-apply):** Wave 4A-1 = **NO-GO** until production apply pack executed and post-apply checks pass.

**After successful production apply + verify:** Wave 4A-1 = **GO** for governed submit + individual approvals (not bulk).

---

## Related artifacts

| Artifact | Path |
|----------|------|
| Migration | `supabase/migrations/20260610231247_pr06c1b_packaging_product_approve_mapping.sql` |
| Verify SQL | `scripts/supabase/PR06C1b_packaging_mapping_verify.sql` |
| PR06C1a rollback source | `scripts/supabase/PR06C1_central_tag_alias_approve_mapping.sql` |
| Preview verification | Branch `pr06c1b-verify` / `dqqhpdfmgcuopuylnkyh` |
| Final gate doc | `docs/PR06C1B_FINAL_GATE_AND_STAGING_VERIFICATION.md` |
| Env map | `docs/SUPABASE_ENV_MAP.md` |
| Implementation notes | `docs/PR06C1B_PACKAGING_APPROVAL_MAPPING.md` |

---

## Execution log (owner fills in)

| Step | Date/time | Operator | Result |
|------|-----------|----------|--------|
| Pre-apply checks 2a–2g | | | |
| Migration apply | | | |
| Post-apply verify 4a–4d | | | |
| Optional production spot-check 4e | | | |
| Wave 4A-1 GO declared | | | |
