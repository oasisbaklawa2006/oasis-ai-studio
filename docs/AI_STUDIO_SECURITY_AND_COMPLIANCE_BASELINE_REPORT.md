# AI Studio security & compliance baseline report

**Repo:** `oasisbaklawa2006/oasis-ai-studio`  
**Branch:** `cursor/ai-studio-security-compliance-baseline`  
**Scope:** AI Studio / Catalogue Product Truth only — not Oasis Central, not Golden Chain.

## Summary

Single combined PR for Phase 0.1 security/tooling and Phase 1 AI compliance safety (suggestion-only GST/HSN and related fields).

## Files changed

| Area | Files |
|------|--------|
| Env / git | `.gitignore`, `.env.example`, `.env` removed from git index |
| Tooling | `package.json` (`typecheck` script), `vitest.config.ts` (explicit repo root) |
| CI | `.github/workflows/release-quality-gate.yml` |
| AI compliance core | `src/shared/ai/complianceConstants.ts`, `complianceSuggestions.ts`, `complianceApproval.ts` |
| UI | `src/features/compliance/ComplianceAiPanel.tsx`, `src/pages/ProductEdit.tsx` |
| Permissions | `src/lib/permissions.ts` (`compliance_approve`) |
| Edge function | `supabase/functions/generate-product-attributes/index.ts` |
| Tests | `src/shared/ai/complianceSuggestions.test.ts`, `complianceApproval.test.ts` |
| Docs | This report |

## `.env` tracking

- **Was tracked:** yes — removed from index via `git rm --cached .env`
- **Local file:** retained on disk (not committed)
- **`.env.example`:** variable names only (`VITE_SUPABASE_*`)

## Secrets scan (names only)

| Pattern | Finding |
|---------|---------|
| `SERVICE_ROLE` / `SUPABASE_SERVICE_ROLE` | `supabase/functions/test-integration/index.ts` — reads `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` (env reference, not a committed secret) |
| `JWT_SECRET`, `POSTGRES_PASSWORD`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | **No matches** in repo |

**Risk:** low for committed secrets; ensure production keys stay in Supabase/Vercel env only.

## Compliance behavior

| Rule | Implementation |
|------|----------------|
| AI response contract | `suggestion_only: true`, `approved: false`, legal disclaimer on edge function + client types |
| UI disclaimer | Compliance tab: “AI suggestion only. Manual approval required.” |
| Apply ≠ approve | Apply fills form with pending meta; **Approve for save** required (owner/admin/product_manager) |
| Save guard | `prepareFormForComplianceSave` restores baseline for unapproved AI fields |
| Contributor drafts | `stripComplianceFromDraftPayload` when unapproved AI compliance present |
| Roles | Contributors may generate/apply; only owner/admin/product_manager may approve |

## Migration

**No** — type-level / client guards only; no schema changes.

## Tests run

```text
npm run typecheck  — pass
npm run build      — pass
npm run test       — pass (8 tests)
```

## Risks

- Edge function `generate-product-attributes` uses heuristic placeholders until a model provider is configured.
- Deploy edge function to Central Supabase project separately when ready (out of this PR’s deploy scope).
- Manual edits by non-approvers are saved as `approved: false` until an approver approves or overwrites.

## What remains (out of scope)

- PR-06C1b frontend alignment (tags/aliases/ApprovalInbox `data.ok`)
- Full Product Truth MVP, UOM/channel/snapshot engine
- Real LLM provider wiring for compliance suggestions
- Deploy edge function to production Supabase

## PR

_(filled after `gh pr create`)_

## Merge recommendation

**Approve merge** after review: repo-only + CI gate; live DB already has separate C1a SQL on Central. This PR does not run migrations or deploy. Mark PR ready and merge when owner accepts compliance UX on Product Edit.
