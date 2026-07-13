# QA Test 01 - Authentication And Route Protection

## Objective

Verify login, logout, protected routes, role access, and invalid route behavior.

## Steps

1. Open `/auth`.
2. Verify login form renders without console errors.
3. Sign in using the provided test credentials.
4. Verify landing route `/` loads.
5. Visit each protected route from `AUTONOMA.md`.
6. Verify allowed routes load and restricted routes show a clear blocked state.
7. Visit `/dashboard` and confirm it is not treated as the real dashboard route.
8. Sign out and verify protected routes redirect or block access.

## Failures

- blank page
- role setup failure
- infinite loading
- incorrect access
- route 404 for a valid route
- valid protected data visible after logout
