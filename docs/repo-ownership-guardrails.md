# Repo Ownership Guardrails

## Why this exists

Catalogue Product AI Studio was built in this repo (`oasis-ai-studio`) after an
earlier attempt landed it in the wrong repo (Oasis-Baklawa-Central,
PRs #223, #224 and #225 — since decommissioned there). This document records the
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
are explicitly out of scope for guardrail changes. This applies to *any*
already-tracked file anywhere under `supabase/`, not just migrations/
functions: an edit to a pre-existing file is always a warning, even if the
edit touches DDL, because the check never diffs an existing file's changed
lines (see below). The check instead hard-fails only on **new** paths —
whether they arrive untracked, staged, or committed since the base branch —
i.e. schema ownership actually being reintroduced going forward:
- any new `supabase/migrations/*.sql` file, or any new file under
  `supabase/functions/**`, fails outright by location alone;
- a new `*.sql` file anywhere *else* under `supabase/` (e.g.
  `supabase/schema/new_table.sql`) fails only if its content contains a DDL/
  RLS/backend-ownership statement (`CREATE TABLE`, `ALTER TABLE`, `DROP
  TABLE`, `CREATE POLICY`, `ALTER POLICY`, `ENABLE ROW LEVEL SECURITY`,
  `CREATE FUNCTION`, `CREATE TRIGGER`) — a stray non-schema `.sql` file
  outside migrations isn't itself a boundary violation.

Migrating the legacy `supabase/` content out of this repo is a separate,
deliberate effort, not something this check performs or blocks on.

## G5 archival Core snapshot admission — one-time only

Production Edge Functions, database migrations, RLS and runtime deployments remain owned **exclusively** by
`oasis-supabase-core`. Studio must not create or maintain backend logic. A historical `supabase/functions/**`
copy exists in this frontend repository. It is consumed by BOTH the frontend test-only TypeScript
re-export bridges and the legacy Studio Edge Function
`supabase/functions/whatsapp-studio-inbox-bridge/index.ts`. The Edge Function imports
`processErpInboundRow` directly and calls it when processing ERP inbound rows.
Consequently, this copy is not inert: redeploying the legacy Studio function
would bundle whatever source is present in the Studio checkout.

Core PR [#493](https://github.com/oasisbaklawa2006/oasis-supabase-core/pull/493) was independently reviewed and
merged (`fb47a9508dad3d676776ae8fe0172b67c8284d71`) to correct a genuine TypeScript union-narrowing problem in
the canonical ERP inbox source. An **explicitly separately approved** one-time source provenance synchronization
may update the pre-existing historical Studio copy to precisely that already-approved Core Git blob. This is a
one-off archival refresh, **not** permission to author, deploy, or modify Edge backend functionality in Studio.

### Edge Runtime redeployment hazard and release containment

- **Never deploy or redeploy** `whatsapp-studio-inbox-bridge` or any other
  Supabase Function from an AI Studio checkout, whether manually using the CLI,
  through CI, from a cached preview artifact, or through a generic deploy action.
  This restriction applies **before and after** the one-time snapshot refresh.
- A frontend/Vercel deployment must never trigger a Supabase Functions or
  migration deployment. Supabase production auto-deployment remains disabled.
  Keep `BRIDGE_ENABLED=false` and its scheduler disabled unless separately
  certified and explicitly authorized through the existing Core release process.
- The only authorized production Edge source is the reviewed canonical
  `oasis-supabase-core` repository. If a bridge redeployment is ever needed,
  it requires a **separate** Core-owned protected release, exact deployment
  provenance, positive/negative runtime validation and rollback evidence.
  This policy-only PR and downstream Studio #290 grant **no runtime release**.
- The source-level union-narrowing fix is expected to preserve valid/skipped
  mapping behavior, but matching a Git blob or passing a TypeScript build
  does **not** demonstrate deployed runtime equivalence. Any deployment must
  prove its own runtime and security gates rather than relying on the
  frontend CI results.
- Before admitting Studio #290, reviewers must confirm that no Studio
  build/release path deploys `supabase/functions/**` and no automation can
  publish the legacy bridge from Studio. If this cannot be verified, treat
  the proposed exception as **BLOCKED** until corrected. Historical deployment
  instructions in older Studio documentation are superseded by this policy.

The narrow rule in `.cursor/BUGBOT.md` identifies the only permitted existing path, historical Studio blob,
approved Core blob and immutable merge provenance. The proposed downstream Studio PR
[#290](https://github.com/oasisbaklawa2006/oasis-ai-studio/pull/290) must independently prove those hashes and a
negative-test matrix through its Core Backend Authority CI guard. If any other backend path is changed, or
either blob does not match, the guard **must fail**. A future source refresh requires another independent policy
decision, not a generic bypass.

**Release order:** this policy proposal must first pass independent CODEOWNER/security review and protected
merge; only then may the separate source-synchronization PR be re-reviewed against this approved rule. Both
require their own exact-head checks and human approvals. Nothing here authorizes Studio production deployment or
weakens the default rejection of new migration/Edge Function work.

## Mandatory pre-PR ownership gate

Before opening a PR against this repo, run:

```bash
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
