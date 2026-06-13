# AI Studio — Catalogue Builder Collections Fix

_Date: 2026-03-28 · Repo: `oasis-ai-studio`_

## Symptom

Catalogue Builder (`/admin/catalogue-builder`) showed:

> Collections could not be loaded from Supabase. Create and edit actions require a live connection.

## Root cause

**Connected to Supabase, but catalogue collection tables are not available on the live project** (or RLS blocks the authenticated user).

| Check | Result |
|-------|--------|
| Env vars missing | **Unlikely** — app loads, auth works, products list works |
| Wrong table name in code | **No** — code correctly queries `catalogue_collections`, `catalogue_collection_items`, `catalogue_share_links` |
| Migration not applied | **Most likely** — `20260602160000_catalogue_collections_foundation.sql` exists in repo but must be applied on `tcxvcatsqqertcnycuop` |
| RLS blocked | **Possible** — policies require `is_team_member(auth.uid())` |
| localStorage fallback | **Disabled in production** — `VITE_ALLOW_LOCAL_CATALOGUE_FALLBACK` is dev-only |

### Code path

```
CatalogueBuilder → listCollections()
  → supabase.from("catalogue_collections").select("*")
  → on error: setCollectionsPersistenceSource("supabase_unavailable")
  → UI banner (now shows classified error + owner action)
```

## Tables expected

| Table | Purpose |
|-------|---------|
| `catalogue_collections` | Collection metadata (title, type, status) |
| `catalogue_collection_items` | Product membership + sort order |
| `catalogue_share_links` | Share token placeholders |

Migration file: `supabase/migrations/20260602160000_catalogue_collections_foundation.sql`

## Fix applied in code (this PR)

1. **`src/lib/supabase/diagnostics.ts`** — classifies PostgREST errors (`missing_table`, `rls_denied`, `auth`, `network`).
2. **`src/features/catalogueBuilder/collectionStore.ts`** — captures and stores load failure via `setCollectionsLoadFailure`.
3. **`src/pages/CatalogueBuilder.tsx`** — shows exact error code, message, and owner action (e.g. apply migration).

## Owner action required (Supabase)

1. In Supabase SQL editor for project **`tcxvcatsqqertcnycuop`**, apply:
   - `supabase/migrations/20260602160000_catalogue_collections_foundation.sql`
2. Confirm `public.is_team_member(uuid)` exists and returns true for owner/admin test users.
3. Re-test `/admin/catalogue-builder` — banner should clear; collections list should load (empty or populated).

## Not fixed in code (by design)

- No RLS bypass
- No automatic migration execution
- No localStorage write fallback in production

## Validation

After migration + redeploy:

- [ ] Catalogue Builder loads without red error banner
- [ ] "Create collection" succeeds
- [ ] Add product to collection succeeds
