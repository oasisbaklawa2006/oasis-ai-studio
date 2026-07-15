# Catalogue AI smoke test — 2026-07-16

Target: `tcxvcatsqqertcnycuop` / `catalogue-ai-copy`. Never paste tokens or keys into Git, chat, screenshots, command history, or issue comments.

## Deployment gate

- [x] Core source merged and traceable.
- [x] Deno format and lint pass.
- [x] Contract tests pass (5/5).
- [x] Edge Function type-check passes.
- [x] Production authorization dependency verified read-only: `is_internal_staff(_user_id uuid)`.
- [x] Function v1 deployed with `verify_jwt=true`.
- [x] Missing JWT returns 401.
- [x] Invalid JWT returns 401.
- [ ] Set `AI_STUDIO_ALLOWED_ORIGIN` to the exact production Vercel origin.
- [ ] Set `OPENAI_API_KEY` in Supabase Edge Function secrets (server-side only).
- [ ] Set a cost-approved `OPENAI_CATALOGUE_MODEL`.
- [ ] Keep `AI_STUDIO_AI_ENABLED=false` or absent for the disabled-state smoke test.
- [ ] Set Vercel `VITE_CATALOGUE_AI_ENABLED=true` only after the backend checks pass.

Supabase secrets: <https://supabase.com/dashboard/project/tcxvcatsqqertcnycuop/functions/secrets>

Vercel environment variables: <https://vercel.com/oasisbaklawa2006-6222s-projects/oasis-ai-studio/settings/environment-variables>

## PowerShell execution

Use a fresh PowerShell window. Values below are placeholders; do not commit them.

```powershell
$env:SMOKE_ALLOWED_ORIGIN="https://YOUR-EXACT-PRODUCTION-ORIGIN"
$env:SMOKE_ACCESS_TOKEN="YOUR-TEMPORARY-STAFF-USER-JWT"
$env:SMOKE_PUBLISHABLE_KEY="YOUR-SUPABASE-PUBLISHABLE-KEY"
$env:SMOKE_EXPECT_AI_STATUS="503"
npm run smoke:catalogue-ai
```

Expected disabled-state result:

- [ ] Approved-origin OPTIONS returns 204.
- [ ] Wrong origin returns 403.
- [ ] Unsupported method returns 405.
- [ ] Invalid body returns 400.
- [ ] Authorized staff generation returns 503 while the kill switch is off.

Optional non-staff check:

```powershell
$env:SMOKE_NON_STAFF_ACCESS_TOKEN="TEMPORARY-NON-STAFF-USER-JWT"
npm run smoke:catalogue-ai
```

- [ ] Non-staff JWT returns 401.

## Positive AI test

After the disabled-state checks pass, set `AI_STUDIO_AI_ENABLED=true` in Supabase and rerun with:

```powershell
$env:SMOKE_EXPECT_AI_STATUS="200"
npm run smoke:catalogue-ai
```

- [ ] HTTP 200.
- [ ] Exactly eight governed content fields.
- [ ] `human_review_required=true`.
- [ ] Missing storage/shelf-life facts produce the exact operator-confirmation wording.
- [ ] No price, ingredient, allergen, nutrition, tax, certification, health, legal or unsupported packaging claims.
- [ ] Edge Function logs contain no secret or raw provider payload.

## Browser smoke test

- [ ] Redeploy Vercel after setting `VITE_CATALOGUE_AI_ENABLED=true`.
- [ ] Sign in with the authorized test account.
- [ ] Open AI Studio → Catalogue Product AI Studio → Content Draft Studio.
- [ ] Select a product with known source facts.
- [ ] Generate copy once; confirm a visible human-review state.
- [ ] Confirm generated copy enters draft/editor state only and is not automatically approved, published, messaged, exported or written to compliance fields.
- [ ] Refresh the page and confirm no duplicate generation occurred.
- [ ] Disable `AI_STUDIO_AI_ENABLED` and confirm generation fails safely without affecting manual editing.

## Cleanup

```powershell
Remove-Item Env:SMOKE_ACCESS_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:SMOKE_NON_STAFF_ACCESS_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:SMOKE_PUBLISHABLE_KEY -ErrorAction SilentlyContinue
```

- [ ] Temporary tokens removed from the terminal environment.
- [ ] AI kill switch left in the owner-approved final state.
- [ ] Results recorded without secrets.
