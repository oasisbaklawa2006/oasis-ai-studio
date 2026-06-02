# PR-06C Catalogue Approval Mapping

## PR-06C1 (tag + alias)

**Script:** `scripts/supabase/PR06C1_catalogue_approve_tag_alias.sql`

**Prerequisites:** `PR06B_draft_approval_migration.sql` applied on staging.

### Functions added/replaced

| Function | Access |
|----------|--------|
| `finalize_catalogue_draft_approval(text, uuid, jsonb, jsonb, jsonb)` | Internal only (REVOKE from PUBLIC/authenticated) |
| `approve_catalogue_tag_draft(uuid)` | authenticated (unchanged grant) |
| `approve_catalogue_alias_draft(uuid)` | authenticated (unchanged grant) |

Reject RPCs and other `approve_catalogue_*` stubs are **not** modified in C1.

### Assumptions

**`tags`**

- Columns: `id`, `name`, `group_name` (both `name` and `group_name` NOT NULL).
- Unique constraint: `(name, group_name)`.
- `delete_request` cascades to `product_tags` via FK ON DELETE CASCADE.

**`product_aliases`**

- Columns used on insert/update: `product_id`, `alias`, `language`, `script`, `alias_type`, `source`, `is_active`.
- `normalized_alias` is GENERATED (`public.normalize_alias(alias)`); unique on `(product_id, normalized_alias)`.
- Create uses `ON CONFLICT (product_id, normalized_alias) DO NOTHING` then loads existing row (matches AliasManager `ignoreDuplicates`).
- `confidence_score` / `created_by` rely on table defaults.

**Payload scopes**

- Tag: `tag_vocabulary` only.
- Alias: `product_alias` only.
- Tag `update` operation: rejected with explicit error (not used by frontend).

### Staging execution order

1. Run `PR06B_preflight_read_only.sql` sections 1–9 on Central staging.
2. Confirm PR06B objects exist and tag/alias column/constraint checks match assumptions.
3. Execute `PR06C1_catalogue_approve_tag_alias.sql` in a single transaction (file includes `BEGIN`/`COMMIT`).
4. Re-run preflight section 9 — `finalize_catalogue_draft_approval` should exist; tag/alias approve bodies updated.
5. Manual E2E (contributor submit → reviewer approve/reject) — see verification SQL below.

### Rollback plan

Re-deploy stub approve bodies from `PR06B_draft_approval_migration.sql` section 10 for tag and alias only:

```sql
-- Restore stubs (raises mapping-not-finalized)
\i path/to/PR06B_draft_approval_migration.sql  -- or copy only approve_catalogue_tag_draft + approve_catalogue_alias_draft
DROP FUNCTION IF EXISTS public.finalize_catalogue_draft_approval(text, uuid, jsonb, jsonb, jsonb);
```

Approved master rows are **not** auto-reverted; rollback draft status manually if needed.

### Manual verification SQL (staging)

```sql
-- After contributor submits a tag create draft, as reviewer:
select id, operation, status, payload
from public.catalogue_tag_drafts
where status = 'pending_approval'
order by submitted_at desc
limit 5;

-- Approve (replace :draft_id)
select public.approve_catalogue_tag_draft(:draft_id);

-- Audit row
select draft_table, action, before_snapshot, after_snapshot
from public.catalogue_approval_audit
where draft_id = :draft_id
order by created_at desc
limit 1;

-- Reject path unchanged
select public.reject_catalogue_tag_draft(:draft_id, 'test reject');
```

Repeat for `catalogue_alias_drafts` / `approve_catalogue_alias_draft`.

### Risks

- Permissive `products` / `product_aliases` RLS unchanged — SECURITY DEFINER bypasses RLS; reviewers can write master via RPC only.
- Tag delete removes `product_tags` links for that tag.
- Duplicate tag approve is idempotent (returns existing row).
- Alias update from draft may change `language`/`script`/`alias_type`/`source` when present in payload (not only `is_active`).
