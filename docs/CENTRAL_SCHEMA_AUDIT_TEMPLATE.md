# Central Supabase Audit Report Template

> Fill this after running `scripts/supabase/schema-audit.sql` in Central Supabase.

## A. Project ref confirmation
- Supabase URL:
- Parsed project ref:
- Expected project ref (`tcxvcatsqqertcnycuop`) match: Yes / No
- Audit timestamp:

## B. Existing tables
- List all `public` tables:

## C. Existing columns
- Notes on critical columns by table:

## D. `app_role` enum values
- Enum found: Yes / No
- Values:

## E. Auth/profile/user_roles structure
- `profiles` present: Yes / No
- `user_roles` present: Yes / No
- Related FKs:

## F. Product/catalogue/label/BOM/pricing tables found
- Product tables:
- Catalogue tables:
- Label tables:
- BOM tables:
- Pricing/MOQ tables:

## G. Missing tables needed for Catalogue App
- Missing tables list:
- Blocking gaps:

## H. RLS enabled status
- RLS-enabled tables:
- RLS-disabled tables:
- Any master tables without RLS:

## I. Existing policies
- Summary by table:
- Overly broad policies:
- Missing write/read policies:

## J. Existing RPC/functions
- Function list:
- Approval/auth related RPCs:
- Potential compatibility RPCs:

## K. Storage buckets
- Buckets found:
- Public/private status:
- Bucket policy concerns:

## L. Safety concerns
- Privilege concerns:
- RLS/policy concerns:
- Function security-definer concerns:

## M. Recommended migration plan
- Phase 1 (non-breaking prep):
- Phase 2 (draft/approval layer):
- Phase 3 (cutover):

## N. Decision: reuse vs create draft tables
- Reuse existing master tables for direct writes? Yes / No
- Introduce draft tables? Yes / No
- Rationale:
