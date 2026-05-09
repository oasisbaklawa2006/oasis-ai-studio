# Central Supabase Checklist

## Required environment variables
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Verify project ref = `tcxvcatsqqertcnycuop`
1. Ensure `.env` uses a URL like:
   - `https://tcxvcatsqqertcnycuop.supabase.co`
2. Optional local runtime check (when env is loaded):
   - import `assertExpectedProjectRef` from `src/shared/supabase/health.ts`
   - call `assertExpectedProjectRef("tcxvcatsqqertcnycuop")` in a local dev-only check.

## Confirm auth matches Oasis Central
- In Supabase Dashboard (Central project):
  - verify enabled auth providers (Email, Google, Apple, etc.) match Oasis requirements.
  - verify redirect URLs include the active frontend origin(s).
- In app config:
  - ensure only `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` are used.

## Confirm no Lovable Cloud references
Run:
- `rg -n "lovable|@lovable.dev/cloud-auth-js|lovable-tagger" src package.json vite.config.ts`

Expected:
- no runtime imports of `@lovable.dev/cloud-auth-js`
- no `lovable-tagger` in Vite plugins
- only legacy reference comments/files retained intentionally

## Regenerate Supabase types later (when DB access is approved)
Example command (do not run until access is approved):
- `supabase gen types typescript --project-id tcxvcatsqqertcnycuop --schema public > src/integrations/supabase/types.ts`

## Schema audit runbook (once DB access is available)
1. Pull schema metadata (tables, views, enums, policies, functions).
2. Compare current write surfaces (`docs/WRITE_SURFACE_MAP.md`) with actual tables/RPC.
3. Verify RLS and grants for each write path.
4. Produce gap report:
   - missing objects
   - policy mismatches
   - naming mismatches
5. Only after approval: create migration PR(s) separately.
