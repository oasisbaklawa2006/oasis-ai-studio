# Repo Ownership Guardrails

## Why this exists

Catalogue Product AI Studio was built in this repo (`oasis-ai-studio`) after an
earlier attempt landed it in the wrong repo (Oasis-Baklawa-Central, PR
#223/#224/#225 — since decommissioned there). This document records the
resulting three-repo ownership split so oasis-ai-studio does not, in turn,
absorb Central's operations workflows or oasis-supabase-core's backend/schema
authority, and `scripts/check-repo-boundaries.sh` enforces it in CI.

## Ownership split

- **oasis-ai-studio** (this repo) owns:
  - Catalogue Product AI Studio frontend (`/admin/catalogue-product-studio`)
  - Product intelligence workflows
  - Content draft studio
  - Image prompt studio
  - Packaging/variant readiness
  - Export/copy preview
  - The AI-Studio save/submit/approve/reject draft workflow UI
  - **Generated Supabase client/types usage only** — this repo reads and
    writes rows through the Supabase client using generated types; it does
    not own the schema those types describe.

- **Oasis-Baklawa-Central** owns:
  - Operations/admin frontend
  - Product master administration
  - Orders, finance, dispatch, warehouse
  - Inventory execution, production execution
  - The approval inbox
  - The buyer catalogue
  - The operational catalogue connector/intake

- **oasis-supabase-core** owns:
  - Supabase migrations
  - RLS policies
  - Backend schema authority
  - Edge Functions
  - Database DDL
  - Creation of the catalogue AI-Studio draft/audit tables
    (`catalogue_ai_studio_drafts`, `catalogue_ai_studio_draft_audit_log`)

### Important nuance: reading/writing vs. owning schema

oasis-ai-studio is **allowed** to read and write `catalogue_ai_studio_drafts`
and `catalogue_ai_studio_draft_audit_log` through the Supabase client and
generated types — that's the whole point of the draft workflow UI this repo
owns. The boundary check never forbids those table names appearing in `src`
or in generated types. What it forbids is this repo **owning the schema**:
writing the migrations, RLS policies, or DDL that create or alter those (or
any other) tables. That authority belongs to oasis-supabase-core.

### Known legacy debt: pre-existing `supabase/` content

This repo currently contains `supabase/migrations/` and `supabase/functions/`
content that predates the ownership split above. `check-repo-boundaries.sh`
reports that pre-existing content as a **warning only** — it is not this
guardrail's job to retroactively fail CI over historical debt, and migrations
are explicitly out of scope for guardrail changes. The check instead fails
only on **new** migration files, new Edge Function files, or newly added DDL
statements introduced since the base branch — i.e. schema ownership actually
being reintroduced going forward. Migrating the legacy `supabase/` content out
of this repo is a separate, deliberate effort, not something this check
performs or blocks on.

## Mandatory pre-PR ownership gate

Before opening a PR against this repo, run:

```
npm run check:boundaries
```

A PR that adds a new Supabase migration file, a new Edge Function, new DDL
(`CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`, `CREATE POLICY`, `ALTER POLICY`,
`ENABLE ROW LEVEL SECURITY`, `CREATE FUNCTION`, `CREATE TRIGGER`) under
`supabase/`, or Central operations routes/pages (e.g. `/admin/orders`,
`AdminFinance`, `DispatchManagement`) in `src/` will fail this check and must
not be merged as-is. `.github/workflows/repo-boundaries.yml` runs the same
check on every push/PR to `main`.

## If you hit this guardrail

1. New schema/migration/RLS/Edge Function work belongs in
   `oasis-supabase-core`, not here.
2. New Central operations routes/pages belong in `Oasis-Baklawa-Central`, not
   here.
3. If you believe the ownership split itself needs to change, update this
   document and the script's forbidden-pattern list together, deliberately —
   don't just delete the check.
