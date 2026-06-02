# AI Studio Sprint 1 — Security + Compliance Baseline

## Repo confirmed

- **Remote:** `oasisbaklawa2006/oasis-ai-studio`
- **Branch:** `cursor/ai-studio-sprint-1-security-compliance-baseline`
- Oasis Central repo was not modified.

## Files changed (this sprint)

| Area | Files |
|------|--------|
| Compliance lib | `src/lib/compliance/aiComplianceSafety.ts`, `aiComplianceSafety.test.ts` |
| Product Edit wiring | `src/pages/ProductEdit.tsx` — `ComplianceAiPanel`, save stripping, draft stripping |
| Constants | `src/shared/ai/complianceConstants.ts` — extended sensitive field list |
| Tooling | `package.json` (`typecheck`, `test` with vitest config), `vitest.config.ts` (repo-root resolve) |
| Existing (verified) | `.gitignore`, `.env.example`, `.github/workflows/release-quality-gate.yml`, `src/shared/ai/*`, `src/features/compliance/ComplianceAiPanel.tsx`, `supabase/functions/generate-product-attributes/index.ts` |

## Env / secrets

| Check | Result |
|--------|--------|
| `.env` in `.gitignore` | Yes (`.env`, `.env.local`, `.env.production`) |
| `.env` tracked in git | **No** |
| `.env.example` | Placeholder keys only (no real values) |
| Committed secret name search (`SERVICE_ROLE`, `JWT_SECRET`, `OPENAI_API_KEY`, etc.) | **No matches** in repo |

## CI workflow

`.github/workflows/release-quality-gate.yml` runs on PR/push to `main`:

- `npm ci`
- `npm run typecheck`
- `npm run build`
- `npm run test`

## AI compliance behavior

| Rule | Implementation |
|------|----------------|
| AI output `suggestion_only: true`, `approved: false` | Edge function + `buildAiComplianceResponse` |
| Legal disclaimer | `"AI suggestion only. Final GST/HSN must be approved manually by authorized user."` |
| UI disclaimer | `ComplianceAiPanel` — `"AI suggestion only. Manual approval required."` |
| Apply ≠ approve | Apply sets `createAiSuggestionFieldMeta()` (draft/suggestion) |
| Unapproved values stripped on save | `stripUnapprovedComplianceFields` / `prepareFormForComplianceSave` on direct save; `stripComplianceFromDraftPayload` on contributor drafts |
| Sensitive fields | GST, HSN, shelf life, ingredients, allergens, nutrition, storage, origin, legal/export/health claim fields (form keys when present) |

## Role behavior

| Role | Generate suggestions | Apply as draft | Approve for save |
|------|---------------------|----------------|------------------|
| Contributor | Yes | Yes | No |
| Owner / admin / product_manager | Yes | Yes | Yes |

## Tests run

```bash
npm install
npm run typecheck   # pass
npm run build       # pass
npm run test        # 50 passed
```

Coverage includes: suggestion_only, approved false, disclaimer, save strip, role approve/deny, non-compliance `product_name` preserved (`aiComplianceSafety.test.ts`).

## Remaining risks

- Compliance field meta is session-local (not persisted to DB yet) — page refresh loses pending/approved meta until re-applied.
- Edge function uses heuristic suggestions until a governed model provider is wired.
- Extended sensitive fields (`legal_claims`, etc.) only strip when present on the form object.

## Production deployment note

- Apply no schema migrations for this sprint.
- Deploy app + ensure edge function env uses **publishable/anon** keys in the client; service-role keys must remain server-only.
- Re-run quality gate on merge to `main`.

## Merge recommendation

**Approve and merge** — completes Sprint 1 baseline: env safety, CI gate, AI compliance suggestion-only flow with Product Edit wiring, and role-safe save stripping.
