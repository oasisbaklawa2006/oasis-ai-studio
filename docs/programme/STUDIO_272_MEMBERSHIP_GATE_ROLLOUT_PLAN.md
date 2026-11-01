# Studio #272 — individually approved onboarding before the membership route guard

Status: PLAN (nothing executed). Production read-only evidence taken 2026-11-01.

## Why this matters
PR #274 makes every protected Studio route require `has_ai_studio_permission_v1('ai_studio.app.access')`.
Core #272 seeds membership for exactly two Owners (`admin@oasisbaklawa.com`, `purecocoa@live.in`, matched by
email and active `SUPER_ADMIN`). **Everyone else is locked out the moment the guard is live.**
No role-based or bulk grant is made: no Central administrator, `ADMIN`, `super_admin` or employee is granted
automatically.

## Population that would be locked out (active, accepted, not deleted; by role, 1 Nov 2026)
Eligible human-staff roles per the Core allowlist: FINANCE_EXEC 16, SALES_EXECUTIVE 14 (+1 SALES_EXEC),
SUPPORT_EXECUTIVE 12, SUPER_ADMIN/super_admin 5 (2 seeded Owners, 3 canonical `super_admin` NOT seeded), ADMIN 4,
CATALOGUE_CONTRIBUTOR 3, OPERATIONS_MANAGER 2, FINANCE_HEAD 2, PRODUCTION_MANAGER 1 — about 60 identities.
Ineligible by design (can never receive Studio membership): buyers, pending, GATE_SECURITY, PACKING_SUPERVISOR,
TV_DISPLAY, SECURITY_CONTROL, SYSTEM_SERVICE, STORE_*, HOD_*/PROD_* and other operational roles.
The 3 canonical `super_admin` accounts keep their Core `is_admin()` rights but lose Studio entry until approved.

## Sequence (each step is a gate; do not skip)
1. Core #272 migration released through the protected workflow (owner approval + independent review). The membership
   table then contains only the two Owners. #274 stays unmerged; the Studio route guard is not yet live.
2. `admin@oasisbaklawa.com` enrols a TOTP factor (currently none; `purecocoa@live.in` already has a verified factor).
   Until then only `purecocoa@live.in` can perform AAL2 administration.
3. The Owner builds a written onboarding list: one named person, one profile, one reason each. Suggested first wave:
   the people who author products today (e.g. CATALOGUE_CONTRIBUTOR holders) with `product_editor` or `viewer`.
   Appointing a Studio Manager (`studio_admin` or any `users.manage` grant) is Owner-only.
4. The Owner applies each entry through Settings → Users & Access (AAL2, recorded reason). Verify each in the audit
   history reader. Staff who must keep working on day one are on the list before step 5.
5. Verify live: each listed person enters; an unlisted ADMIN and a `super_admin` are refused; a suspended member is
   refused; an explicit `app.access` deny blocks everything.
6. Only then merge and deploy #274 (independent approval, protected release). Rollback = revert the Studio deploy;
   Core membership data is untouched.

## Not changed by this plan
Studio roles do not authorise production Product Master writes (Core #407 governs those). Hard delete, pricing
approval and publication stay separately governed. `public.is_admin()` is unchanged.
