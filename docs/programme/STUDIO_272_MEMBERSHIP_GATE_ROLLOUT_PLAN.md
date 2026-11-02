# Studio #272 — staged production onboarding and AAL2 certification

Status: Core #476 is deployed; AI Studio PR #274 remains OPEN and UNMERGED.
This document describes release gates, not an instruction to grant new permissions.

## Certified production facts (2 November 2026)
- Core merge 645899439fe0a84806238b9114649eb2c3785a75; protected release run 41361801135 SUCCESS.
- Production migration 20261101030000 is present in the migration ledger.
- Exactly two active Owner memberships are seeded; all other memberships require individual approval.
- Of 60 active, accepted staff identities whose Core roles are Studio-eligible, 58 have no membership.
  This is an eligibility census, not proof that all 58 currently work in AI Studio.
- `purecocoa@live.in` has one verified TOTP factor; `admin@oasisbaklawa.com` has no verified factor.
  Enrollment alone is not AAL2: a valid TOTP challenge must be verified in the current session.
- Backend privileged RPC and audit reads require an AAL2 JWT; Studio roles never expand Core
  Product Master, financial, hard-delete or publication privileges.

## Why preview onboarding must precede production deployment
PR #274 enforces Core membership on every protected Studio route. Deploying it to production
before onboarding could lock out existing Studio staff. The Users & Access console cannot be
used on the current production Studio build because it is introduced by PR #274.

## Controlled sequence
1. Keep PR #274 unmerged. Its exact-head Vercel PREVIEW is the only proposed onboarding UI.
   Before using its access-changing RPC, verify that the preview's PUBLIC Supabase project URL
   points to intended production project tcxvcatsqqertcnycuop. This cannot be inferred from a
   READY deployment or GitHub CI. Do not disclose secrets or use a service-role key.
2. On the verified preview, sign in as one of the two explicitly approved Owners. The
   Users & Access screen performs a real Supabase TOTP challenge and verifies current AAL2
   before rendering its privileged UI. The second Owner must enroll TOTP on their own device.
   No shared OTP, token or authenticator setup key may be placed in a PR, issue or chat.
3. Owner chooses a named first-wave list based on real Studio job responsibilities,
   assigning a specific role and written reason for each. Do not bulk-grant by Central role.
4. With a verified AAL2 user session, apply only those approved entries through the Core
   set_ai_studio_access_v1 RPC in preview. Verify version-bound changes and append-only audit;
   confirm production membership counts change only by approved named entries.
5. Test the preview with representative approved users and negative cases: unapproved Core
   ADMIN/SUPER_ADMIN, revoked and suspended identities, explicit app.access deny, network
   error, and AAL1 attempting an access change. Test that access changes cannot authorize
   Product Master writes or unrelated Core permissions.
6. Obtain independent owner review on exact PR head. Only after verified onboarding,
   negative UAT and production-configuration checks may PR #274 merge and deploy.
   Rollback is reverting the Studio frontend; leave canonical membership ledger intact.

## Scope preserved
- Global Core is_admin() and Core staff provisioning remain unchanged.
- No paid Supabase preview branch, mass role propagation, MFA bypass, product authority change,
  or unapproved production data modification is permitted.
- The Studio preview is READY at commit d098ae667c3ee671f6d6c265a3f99f2b34ffbd45,
  but project environment-variable metadata could not be inspected due Vercel 403.
  Backend-target confirmation and live sign-in/UAT remain unverified.
