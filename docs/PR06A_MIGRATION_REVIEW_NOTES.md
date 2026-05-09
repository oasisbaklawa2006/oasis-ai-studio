# PR06A Migration Review Notes (Draft Only)

## What this draft adds
This PR adds a **DO-NOT-RUN** SQL draft migration file:
- `scripts/supabase/PR06A_DO_NOT_RUN_draft_approval_migration.sql`

Proposed additive scope in that draft:
1. Role seed for `catalogue_contributor` if missing.
2. Permission seeds for `catalogue.*.submit` and `catalogue.approvals.*`.
3. Draft/submission tables:
   - `catalogue_product_drafts`
   - `catalogue_media_submissions`
   - `catalogue_alias_drafts`
   - `catalogue_bom_drafts`
   - `catalogue_moq_drafts`
   - `catalogue_pricing_drafts`
   - `catalogue_tag_drafts`
   - `catalogue_approval_audit`
4. Index strategy (status/submitted_by/target_record_id/created_at + GIN payload indexes).
5. RLS enablement and initial policy pattern for draft workflows.
6. SECURITY DEFINER helper and product approval/reject function skeletons.
7. Audit trail writes for approve/reject actions.

## What this draft intentionally does NOT change
- Does not execute SQL.
- Does not create actual migration in `supabase/migrations`.
- Does not modify frontend business flows.
- Does not harden or alter existing master table RLS policies yet.
- Does not modify master table schema.

## Execution risks
1. **Permissions table schema variance**
   - The draft includes a mandatory check: verify exact `permissions` columns before execution.
2. **Role/permission mapping assumptions**
   - Role IDs and permission IDs may require join logic adjustments depending on existing constraints.
3. **Central schema compatibility gaps**
   - Product create/update mapping from draft payload is intentionally conservative and incomplete.
4. **RLS dependency on helper functions**
   - Function permissions, ownership, and search_path hardening must be reviewed before real execution.
5. **Policy naming conflicts**
   - Existing policy names in Central may collide if naming conventions are not normalized.

## Exact pre-run checks required (before PR-06B execution)
1. Confirm extension availability for `gen_random_uuid()` (`pgcrypto`).
2. Confirm `roles`, `permissions`, `role_permission_map`, `user_role_map` actual column names and constraints.
3. Confirm `auth.users(id)` FK compatibility for submitted/reviewed user IDs.
4. Confirm master table required columns for product creation/update (minimum viable mapping).
5. Confirm no existing table/policy/function naming collisions with proposed objects.
6. Validate policy behavior in staging with real role assignments:
   - contributor submit,
   - reviewer read all,
   - reviewer approve/reject,
   - submitter cancel own pending only,
   - no delete for authenticated users.

## Rollback considerations
- Because design is additive, rollback can be a controlled drop sequence in reverse dependency order:
  1. Drop approval functions
  2. Drop helper functions
  3. Drop RLS policies
  4. Drop draft/audit tables
  5. Remove seeded role-permission mappings
  6. Remove seeded permissions and optional role only if not in active use
- Rollback SQL is **not** provided in PR-06A; to be authored in PR-06B review package.

## Master table / policy status confirmation
- Existing master tables are untouched.
- Existing master table RLS policies are untouched.
- Known risks (permissive policies, profiles RLS disabled) remain deferred for dedicated hardening PR.

## Open questions before PR-06B
1. Which exact `permissions` columns are canonical in Central (`permission_key`, `module_name`, `permission_name` vs alternatives)?
2. Should `catalogue.approvals.review` be mapped only to `super_admin`, or also `finance_head` from day 1?
3. What is the minimum required product payload for approved `create` operation in Central `products`?
4. How should media submissions map to master media representation (`products.image_url` vs separate media table)?
5. Should draft table policy names be prefixed with environment/app namespace to avoid conflicts?
6. Do we require soft-delete semantics for drafts instead of any hard delete path?
7. Should approval audit snapshot store pre-state, post-state, or both?
