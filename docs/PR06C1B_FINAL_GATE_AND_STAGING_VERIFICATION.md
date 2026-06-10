# PR06C1b — Final Gate and Staging Verification Plan

**Branch:** `cursor/wave4a0-pr06c1b-packaging-mapping-673c`  
**Migration:** `supabase/migrations/20260610231247_pr06c1b_packaging_product_approve_mapping.sql`  
**Verification SQL:** `scripts/supabase/PR06C1b_packaging_mapping_verify.sql`  
**Gate date:** 2026-06-10  
**Production Central:** `tcxvcatsqqertcnycuop` (oasis-baklawa) — **untouched**

---

## Executive summary

| Gate | Result |
|------|--------|
| Code / static review gate | **PASS → MERGE** |
| Staging migration apply | **NOT APPLIED** (no active staging project) |
| One-draft packaging approval test | **NOT RUN** |
| Wave 4A batch approval | **BLOCKED** until staging verification completes |
| Production | **UNTOUCHED** |

**PR readiness:** **MERGE** (migration scope and mapping logic are correct; safe to merge for review).  
**Wave 4A operational readiness:** **FIX BEFORE MERGE** into live approval flow — staging apply + one-draft test remain mandatory before any packaging draft approvals.

---

## Final gate checklist (static review)

### 1. Migration only changes `approve_catalogue_draft_internal`

| Check | Result | Evidence |
|-------|--------|----------|
| Single migration file | **PASS** | Only `20260610231247_pr06c1b_packaging_product_approve_mapping.sql` in `supabase/migrations/` references this function |
| No schema/table DDL | **PASS** | Migration contains `CREATE OR REPLACE FUNCTION` only (wrapped in `BEGIN`/`COMMIT`) |
| No other objects touched | **PASS** | No `ALTER TABLE`, `DROP`, or helper function changes |

### 2. Tag branch unchanged

| Check | Result | Evidence |
|-------|--------|----------|
| Byte-identical to PR06C1a | **PASS** | Tag branch (`catalogue_tag_drafts` → `product_tags`): 3,944 chars, identical to `scripts/supabase/PR06C1_central_tag_alias_approve_mapping.sql` |

### 3. Alias branch unchanged

| Check | Result | Evidence |
|-------|--------|----------|
| Byte-identical to PR06C1a | **PASS** | Alias branch (`catalogue_alias_drafts` → `product_aliases`): 4,754 chars, identical to PR06C1 script |

### 4. Product create/update branch maps only packaging fields (+ `pack_size` fix)

| Check | Result | Evidence |
|-------|--------|----------|
| Identity/pricing/compliance SET clauses unchanged | **PASS** | Diff vs PR06C1 shows only packaging columns and `pack_size` precedence added |
| New columns (CREATE + UPDATE) | **PASS** | `grams_per_piece`, `pcs_per_kg`, `primary_pack_weight_kg`, `pcs_per_primary_pack`, `carton_type`, `pcs_per_master_carton`, `packs_per_master_carton`, `packs_per_carton` |
| No unrelated column additions | **PASS** | No MOQ, media, BOM, or pricing column changes |

### 5. `pack_size` precedence is correct

| Operation | Expected | Actual in migration | Result |
|-----------|----------|---------------------|--------|
| **UPDATE** | Promote only explicit `packing.pack_size`; never `primary_pack_type` | `coalesce(nullif(packing.pack_size,''), pack_size)` | **PASS** |
| **CREATE** | Prefer `pack_size`, then `pack_preview`, then `primary_pack_type` | `coalesce(nullif(pack_size), nullif(pack_preview), nullif(primary_pack_type))` | **PASS** |

Wave 4A payloads carry `pack_size: "3kg"` and `primary_pack_type: "Tray 3kg"`. UPDATE path will not overwrite master with the tray label.

### 6. Null/empty payload values cannot overwrite existing master values

| Pattern | Applies to | Result |
|---------|------------|--------|
| `coalesce(nullif(payload,'')::numeric, existing_column)` | All 8 packaging numerics on UPDATE | **PASS** |
| `coalesce(nullif(scalar,''), nullif(packing.carton_type,''), carton_type)` | `carton_type` on UPDATE | **PASS** |
| `coalesce(nullif(pack_size,''), pack_size)` | `pack_size` on UPDATE | **PASS** |
| CREATE path | `nullif(..., '')` only — absent keys stay NULL | **PASS** (no overwrite risk on create) |

### 7. UPDATE and CREATE paths both compile

| Check | Result | Evidence |
|-------|--------|----------|
| CREATE `INSERT` includes all 8 packaging columns | **PASS** | Lines 94–101, 139–150 |
| UPDATE `SET` includes all 8 packaging columns | **PASS** | Lines 193–225 |
| PL/pgSQL structure valid | **PASS** | Balanced `IF`/`END IF`, `RETURNING`, exception paths intact |
| App build | **PASS** | `npm run typecheck`, `npm run build`, `npm test` (81 tests) on branch |

### 8. Verification SQL is read-only

| Check | Result | Evidence |
|-------|--------|----------|
| Active statements are SELECT-only | **PASS** | Queries 1–3 use `SELECT` / `WITH sample AS (...)` |
| Write steps commented out | **PASS** | `INSERT` and `approve_catalogue_product_draft` in section 4 are `--` comments |
| No DDL/DML in executable SQL | **PASS** | Grep confirms no uncommented `INSERT`/`UPDATE`/`DELETE`/`CREATE`/`DROP`/`ALTER` |

### 9. Rollback plan exists

| Check | Result | Evidence |
|-------|--------|----------|
| Documented rollback procedure | **PASS** | See [Rollback plan](#rollback-plan) below |
| Prior function definition preserved | **PASS** | `scripts/supabase/PR06C1_central_tag_alias_approve_mapping.sql` is the pre-PR06C1b baseline |
| Master data caveat documented | **PASS** | Per `docs/PR06C_APPROVAL_MAPPING.md`: approved master rows are not auto-reverted |

---

## Rollback plan

If PR06C1b must be reverted on a database **after** apply:

1. **Re-deploy prior function** — run `scripts/supabase/PR06C1_central_tag_alias_approve_mapping.sql` (the `CREATE OR REPLACE FUNCTION approve_catalogue_draft_internal` block only) against the target environment.
2. **Verify rollback** — re-run verify SQL query #2; query #1 should return `FAIL` (packaging_scalars absent), confirming reversion to PR06C1a behavior.
3. **Data cleanup (staging only)** — if a test packaging draft was approved, manually restore product packaging columns from a pre-test snapshot or reject-before-approve next time.
4. **Do not rollback production** unless owner explicitly requests it (`docs/SUPABASE_ENV_MAP.md`).

Approved packaging values written to `products` during a failed test are **not** rolled back by function replacement alone.

---

## Production baseline (read-only, pre-migration)

Queried production Central **without applying migration**:

| Probe | Production (current) | Expected after PR06C1b on staging |
|-------|----------------------|-----------------------------------|
| `packaging_scalars` in function def | `NO_PACKAGING` | `HAS_PACKAGING` |
| Tag + alias branches present | `TAG_ALIAS_PRESENT` | `TAG_ALIAS_PRESENT` |

Production function remains at PR06C1a behavior. **No migration applied. No draft approvals executed.**

---

## Repository validation (branch)

| Command | Result |
|---------|--------|
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** |
| `npm test` | **PASS** (81/81) |

---

## Staging environment status

| Item | Status |
|------|--------|
| Dedicated staging Supabase project | **Not available** — only `tcxvcatsqqertcnycuop` (production) is `ACTIVE_HEALTHY`; other org projects are `INACTIVE` |
| Supabase branch (preview DB) | **Not provisioned** for this task |
| Migration applied anywhere | **NO** |
| Verify SQL run post-apply | **BLOCKED** — requires staging apply first |

**Constraint honored:** migration was **not** applied to production to satisfy “do not apply to production.”

### Staging provisioning options (human/ops)

1. Create a Supabase **branch** on `tcxvcatsqqertcnycuop` (recommended), or
2. Activate a separate staging project and restore a recent Central snapshot, or
3. Use local `supabase start` with migrations through PR06C1a, then apply PR06C1b only.

---

## Staging verification plan (step-by-step)

Execute **only on staging** after PR06C1b merge + migration apply. Do **not** bulk-run Wave 4A. Do **not** touch production.

### Step 1 — Apply migration to staging only

```bash
# Point CLI at STAGING (not tcxvcatsqqertcnycuop production)
supabase link --project-ref <staging-ref>
supabase db push
# OR apply single file:
psql "$STAGING_DATABASE_URL" -f supabase/migrations/20260610231247_pr06c1b_packaging_product_approve_mapping.sql
```

### Step 2 — Run read-only verification SQL

```bash
psql "$STAGING_DATABASE_URL" -f scripts/supabase/PR06C1b_packaging_mapping_verify.sql
```

**Expected:**

- Query 1: `PASS: packaging_scalars + pack_size precedence present`
- Query 2: `PASS: tag + alias branches preserved`
- Query 3: dry-run payload extracts (`pack_size=3kg`, `grams=18`, `carton_type=666`)

### Step 3 — Identify safe test product

| Field | Value |
|-------|-------|
| SKU | `OAS-AS-BKL-0001` |
| Name | Cashew Kitta |
| UUID | `c7c0c5aa-1d2f-4088-88f1-1e5aacd321a0` |

**Before snapshot (staging):**

```sql
SELECT id, sku, name, pack_size,
       grams_per_piece, pcs_per_kg, primary_pack_weight_kg, pcs_per_primary_pack,
       carton_type, pcs_per_master_carton, packs_per_master_carton, packs_per_carton,
       mrp, price_b2b, hsn_code, category
FROM products
WHERE sku = 'OAS-AS-BKL-0001';
```

Save all columns — used to confirm unrelated fields unchanged.

### Step 4 — Create ONE packaging test draft (staging only)

Use payload shape from verify SQL section 3 / Wave 4A batch preview:

```json
{
  "packaging_authority_republish": true,
  "source": "pr06c1b_staging_gate_test",
  "identity": { "product_name": "Cashew Kitta" },
  "sku_draft": { "sku": "OAS-AS-BKL-0001" },
  "uom": { "primary_uom": "KG" },
  "packing": {
    "pack_size": "3kg",
    "primary_pack_type": "Tray 3kg",
    "carton_type": "666",
    "packaging_scalars": {
      "grams_per_piece": 18,
      "pcs_per_kg": 55.56,
      "primary_pack_weight_kg": 3,
      "pcs_per_primary_pack": 167,
      "pcs_per_master_carton": 167,
      "packs_per_master_carton": null,
      "packs_per_carton": 1
    }
  }
}
```

```sql
INSERT INTO catalogue_product_drafts (
  source_app, target_table, target_record_id, operation, payload, status, submitted_by
) VALUES (
  'catalogue_app', 'products', 'c7c0c5aa-1d2f-4088-88f1-1e5aacd321a0', 'update',
  '<payload_jsonb>'::jsonb,
  'pending_approval', auth.uid()
) RETURNING id;
```

**Exactly one draft.** No batch insert. No Wave 4A file bulk submit.

### Step 5 — Approve ONE test packaging draft only

As a catalogue reviewer on staging:

```sql
SELECT approve_catalogue_product_draft('<draft_id>');
```

### Step 6 — Confirm mapped packaging fields updated

| Column | Expected after approve |
|--------|------------------------|
| `pack_size` | `3kg` (not `Tray 3kg`) |
| `grams_per_piece` | `18` |
| `pcs_per_kg` | `55.56` |
| `primary_pack_weight_kg` | `3` |
| `pcs_per_primary_pack` | `167` |
| `carton_type` | `666` |
| `pcs_per_master_carton` | `167` |
| `packs_per_master_carton` | unchanged (null in payload → coalesce keeps existing) |
| `packs_per_carton` | `1` |

```sql
SELECT sku, name, pack_size,
       grams_per_piece, pcs_per_kg, primary_pack_weight_kg, pcs_per_primary_pack,
       carton_type, pcs_per_master_carton, packs_per_master_carton, packs_per_carton,
       mrp, price_b2b, hsn_code, category
FROM products
WHERE id = 'c7c0c5aa-1d2f-4088-88f1-1e5aacd321a0';
```

### Step 7 — Confirm unrelated fields unchanged

Compare against Step 3 snapshot:

- `name`, `mrp`, `price_b2b`, `hsn_code`, `category`, `gst_rate` must match pre-approve values unless intentionally present in payload (test payload omits pricing).

### Step 8 — Confirm tag/alias paths intact

**Option A (definition check):** verify SQL query #2 → `PASS`.

**Option B (functional smoke, staging only):** submit and approve one tag create draft and one alias create draft using existing PR06C1a payloads; confirm rows land in `product_tags` / `product_aliases`. Skip if definition check already passed and time-constrained.

### Step 9 — Staging cleanup (optional)

Restore test product packaging from Step 3 snapshot if staging DB is long-lived, or leave for dedicated staging branch discard.

### Step 10 — Sign-off gate for Wave 4A

Only after Steps 1–7 pass:

- Proceed with Wave 4A draft **submission** (governed scripts, dry-run default)
- Still **no bulk approve** until spot-check pattern is repeated on 1–2 additional SKUs if desired
- **Never** apply PR06C1b to production without separate production sign-off

---

## Explicit prohibitions (this task)

| Prohibition | Status |
|-------------|--------|
| Apply to production | **NOT DONE** |
| Approve Wave 4A drafts | **NOT DONE** |
| Bulk-run anything | **NOT DONE** |
| Central sync | **NOT DONE** |

---

## Related artifacts

| Artifact | Path |
|----------|------|
| Implementation notes | `docs/PR06C1B_PACKAGING_APPROVAL_MAPPING.md` |
| Investigation packet | `docs/WAVE4A0_PACKAGING_APPROVAL_MAPPING_PACKET.md` |
| PR06C1a baseline script | `scripts/supabase/PR06C1_central_tag_alias_approve_mapping.sql` |
| Verify SQL | `scripts/supabase/PR06C1b_packaging_mapping_verify.sql` |

---

## Sign-off matrix

| Role | Code merge | Staging apply | One-draft test | Production apply |
|------|------------|---------------|----------------|------------------|
| Agent (this task) | Recommended **MERGE** | Blocked (no staging) | Not run | **Denied** |
| Owner / reviewer | Approve PR | Required next | Required next | Separate decision |
