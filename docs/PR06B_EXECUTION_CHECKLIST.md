# PR06B Execution Checklist

## Critical safety gate
- Not safe to execute until every created draft table has complete RLS.
- All approve/reject flows must use RPCs, not direct reviewer UPDATE policies.

## What PR06B adds
- Executable additive SQL migration draft at:
  - `scripts/supabase/PR06B_draft_approval_migration.sql`
- Adds (only):
  - `catalogue_contributor` role seed
  - confirmed permission seeds (`permission_key`, `module_name`, `permission_name`)
  - draft tables + `catalogue_approval_audit`
  - indexes
  - draft-table RLS enablement
  - complete RLS policies for all draft tables
  - helper functions:
    - `get_my_role_keys()`
    - `has_catalogue_permission(permission_key text)`
    - `is_catalogue_reviewer()`
  - approve/reject RPC skeletons for product/media/alias/bom/moq/pricing/tags

## Explicitly not changed in PR06B
- No frontend business flow updates.
- No `app_role` or `user_roles` usage.
- No master table RLS hardening (`products`, `product_variants`, `profiles` unchanged).
- No direct schema refactor of Central master tables.

## Pre-execution checks (required)
1. Confirm migration reviewed/approved by Central owner.
2. Confirm backups/snapshot and rollback plan exist.
3. Confirm `pgcrypto` extension availability.
4. Confirm permissions/role map constraints in Central.
5. Confirm `super_admin` role exists and remains sole day-one reviewer role.
6. Confirm this migration is run in staging first.
7. Validate policy behavior after run:
   - contributor submit pending draft
   - contributor cannot hard-delete draft
   - reviewer can read all drafts
   - reviewer can reject via RPC
   - approve RPCs raise mapping-not-finalized where designed

## Exact migration risk notes
1. Approve RPCs for all draft types are intentionally conservative; several raise `Approval mapping not finalized for this draft type` until schema mapping is finalized.
2. Product approve RPC raises `Product approval mapping not finalized` by design until PR-07 maps Central products fields exactly.
3. Existing master-table security risks remain unchanged (`products` permissive policy, `product_variants` permissive policy, `profiles` RLS disabled).
4. New SECURITY DEFINER functions must be reviewed for ownership and `search_path` hardening during deployment.
5. Dynamic SQL in generic reject helper must be reviewed carefully and kept constrained to expected draft table names during production hardening.

## Post-run verification
- Verify objects created:
  - all draft tables + audit table
  - indexes
  - helper functions
  - approve/reject RPCs
  - RLS policies for all draft tables
- Verify no changes to master table policies occurred.
- Capture SQL editor output and object list for PR record.
