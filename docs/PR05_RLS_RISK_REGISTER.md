# PR-05 RLS Risk Register (Central Supabase)

## 1) `products` permissive policy risk
- Finding: `OASIS_ADMIN_FULL_CONTROL` has effectively `ALL true true` behavior.
- Risk: Any authenticated path covered by this policy may mutate product masters without approval workflow.
- Impact: High (integrity + auditability).
- Mitigation (future PR-06+): replace broad policy with permission-checked/RPC-mediated writes.

## 2) `product_variants` permissive policy risk
- Finding: `OASIS_AUTHENTICATED_FULL_ACCESS` has effectively `ALL true true` behavior.
- Risk: Authenticated users can perform unrestricted variant writes.
- Impact: High.
- Mitigation: remove broad access and route write paths through approved roles/RPCs.

## 3) `profiles` RLS disabled risk
- Finding: RLS disabled on `profiles`.
- Risk: Overexposure or unintended reads/writes depending on grants.
- Impact: High (privacy + control).
- Mitigation: enable RLS after compatibility audit and implement least-privilege policies.

## 4) Mixed role-check logic risk
- Finding: Existing policy/function logic is inconsistent across patterns:
  - direct `users.role` checks,
  - helper function checks (`get_user_role()` style),
  - uppercase role literals (`ADMIN`, `SUPER_ADMIN`) while actual `role_key` values are lowercase (`super_admin`).
- Risk: policy bypasses, false denials, brittle behavior.
- Impact: High.
- Mitigation: standardize on `roles` + `user_role_map` + `permissions` + `role_permission_map` with normalized `role_key` checks.

## 5) `pricing_slabs` compatibility risk
- Finding: current `pricing_slabs` may not fully represent channel-wise and approval-state-rich pricing from Catalogue App.
- Risk: lossy mappings or forced denormalization in master tables.
- Impact: Medium/High.
- Mitigation: keep rich pricing payload in `catalogue_pricing_drafts` until Central pricing schema is expanded.

## 6) `product_bom` model simplification risk
- Finding: `product_bom` appears simpler than Catalogue App BOM authoring expectations.
- Risk: missing fields/relationships during direct mapping.
- Impact: Medium.
- Mitigation: stage BOM changes in `catalogue_bom_drafts.payload` and validate mapping in approval RPC before apply.

## 7) Frontend-only restriction risk
- Finding: current control model can be bypassed if DB policies remain broad.
- Risk: unauthorized writes despite UI gating.
- Impact: High.
- Mitigation: enforce permission checks and approval logic in DB layer (RLS + SECURITY DEFINER RPCs).
