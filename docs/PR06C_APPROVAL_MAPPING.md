# PR-06C Catalogue Approval Mapping (Central)

## PR-06C1a (SQL) — tag + alias via `approve_catalogue_draft_internal`

**Script:** `scripts/supabase/PR06C1_central_tag_alias_approve_mapping.sql`

**Does not:** add `finalize_catalogue_draft_approval`, replace thin approve wrappers, or change product mapping.

### Central master tables

| Draft table | Master | Key columns |
|-------------|--------|-------------|
| `catalogue_tag_drafts` | `product_tags` | `tag_key` (UNIQUE), `tag_label`, `is_active`, `sort_order` |
| `catalogue_alias_drafts` | `product_aliases` | `alias_text`, `canonical_name`, `product_id` |

There is **no** `public.tags` table on Central. Product–tag links use `product_tag_mapping` (out of scope for vocabulary-only Tag Manager drafts).

### Payload mapping (tolerant of current Catalogue app drafts)

**Tag** (`scope: tag_vocabulary`)

| Payload field | Maps to |
|---------------|---------|
| `name` or `tag_label` | `product_tags.tag_label` |
| `group_name` (default `general`) | prefix in `tag_key` via `catalogue_slugify_tag_part` |
| explicit `tag_key` | used as-is when provided |
| derived | `tag_key` = `{group_slug}:{label_slug}` |
| `create` | INSERT `product_tags`; on `tag_key` conflict, approve existing row id |
| `delete_request` | DELETE `product_tags` where `id = target_record_id` |
| `update` | **rejected** (not used by UI) |

**Alias** (`scope: product_alias`)

| Payload field | Maps to |
|---------------|---------|
| `alias` or `alias_text` | `product_aliases.alias_text` |
| `canonical_name` or `product_name` | `product_aliases.canonical_name` |
| (fallback) | `products.name` for `product_id` |
| `product_id` | required |
| `language`, `script`, `alias_type`, `source`, `is_active` | ignored until optional columns added (PR-06C1b UI) |

### Return contract

Same as Central baseline: `jsonb` with `ok: true|false`. Unmapped types still return `approve_blocked_mapping_not_finalized`.

### Staging execution

1. `PR06B_preflight_read_only.sql` (sections 1–9)
2. `PR06C1_central_tag_alias_approve_mapping.sql`
3. Verification SQL in script comments / below

### Rollback

Restore previous `approve_catalogue_draft_internal` from backup or pg_dump; `DROP FUNCTION IF EXISTS public.catalogue_slugify_tag_part(text);` Master rows created by approve are not auto-reverted.
