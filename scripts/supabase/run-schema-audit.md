# Run Central Supabase Schema Audit (Owner-run)

## Safety first
- This audit is **read-only** and must use only `SELECT` queries.
- Do **not** run migrations yet.
- Do **not** paste a service role key in chat.

## Option A: Supabase Dashboard SQL Editor (recommended)
1. Open Central Supabase project (owner/admin account).
2. Go to **SQL Editor**.
3. Open `scripts/supabase/schema-audit.sql` from this repo and paste full contents.
4. Run the script.
5. Export or copy result grids for each query block.
6. Paste outputs into `docs/CENTRAL_SCHEMA_AUDIT_TEMPLATE.md` sections.

## Option B: psql with read-only connection
1. Use a read-only DB user/role.
2. Run:
   ```bash
   psql "<readonly-connection-string>" -f scripts/supabase/schema-audit.sql
   ```
3. Save output to file:
   ```bash
   psql "<readonly-connection-string>" -f scripts/supabase/schema-audit.sql > central-schema-audit-output.txt
   ```
4. Use that output to fill `docs/CENTRAL_SCHEMA_AUDIT_TEMPLATE.md`.

## What to copy back
- Project/database context query output.
- Tables/columns/PK/FK/index results.
- RLS enabled status + policies.
- Enum values (especially `app_role`).
- Public functions/RPC list.
- Storage buckets metadata.
- Table/function grants.

## Reminders
- Never share secrets in chat (`service_role`, DB passwords, JWT secrets).
- Keep this phase inspection-only until migration design is approved.
