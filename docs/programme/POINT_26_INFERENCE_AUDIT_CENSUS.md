# Point 26 — AI Inference / Audit Authority Census

**Baseline SHA:** `6f8e16417dcef2323d833072d23a92a32b87a833`  
**Repository:** `oasisbaklawa2006/oasis-ai-studio`  
**Status:** CLOSURE EVIDENCE REFRESH (2026-09-06)  
**Machine-readable source:** `src/shared/ai/inferenceCensus.ts`  
**Certification:** `npm run certify:point26-inference-audit`

## Scope separation

| Programme point | Scope | Census filter |
| --- | --- | --- |
| **Point 26** | AI audit / safety / inference authority | `programme_scope: point26-audit` |
| **Point 30** | Governed extraction / enrichment | `programme_scope: point30-extraction` |
| **Points 27–40** | Product workflow features | Out of this census closure |

## LLM inference boundaries

### 1. `catalogue-ai-copy` (Point 26 primary)

| Attribute | Value |
| --- | --- |
| Client gateway | `src/features/catalogueAiStudio/catalogueAiGateway.ts` |
| Edge function | `catalogue-ai-copy` (Central-deployed) |
| Prompt | Structured JSON schema; `buildCatalogueContentPrompt` (client reference only — edge owns runtime prompt) |
| Structured output | Yes — eight governed content keys |
| Validation | `validateAiCatalogueContent` before editor state |
| Fail-closed | Non-2xx, missing `human_review_required`, malformed JSON → `{ ok: false }` |
| Human review | Required — `human_review_required: true` from edge |
| Canonical mutation | No — draft/editor only; operator save + approval workflow |
| Provenance | `InferenceOperationProvenance` extracted from edge payload (provider/model/prompt_version when present) |
| Fallback | **None** — gateway explicitly refuses `oasis-ai-chat` |
| Auth | Staff JWT + `VITE_CATALOGUE_AI_ENABLED=true` |
| Retries | Edge-owned (Point 24); client single attempt |

### 2. `oasis-ai-chat` (Point 30 — alias suggestions)

| Attribute | Value |
| --- | --- |
| Client module | `src/features/governedAiExtraction/fastCreateEnrichment.ts` |
| Edge function | `oasis-ai-chat` (streaming chat proxy) |
| Structured output | No — comma-separated alias fragments |
| Validation | `sanitizeAiFragments` + `extractGovernedAliases` |
| Fail-closed | HTTP error or zero valid fragments → no aliases applied |
| Human review | Aliases in `pendingAiAliases` until approved |
| Canonical mutation | No — `getPersistableFastCreateAliases` excludes pending |
| Provenance | `GovernedAiProvenance` with service, status, fail_closed |
| Timeout | 15s `AbortSignal.timeout` |
| Auth | Anon/publishable key (alias path only) |

### 3. `generate-product-attributes` (Point 30 — compliance heuristic)

| Attribute | Value |
| --- | --- |
| Client modules | `ComplianceAiPanel`, `fastCreateEnrichment`, `complianceSuggestions` |
| Edge function | `generate-product-attributes` (in-repo heuristic placeholder) |
| Live LLM | Not configured in repo copy — heuristic until provider wired in deployment |
| Structured output | Yes — governed wrapper or legacy flat shape normalized |
| Validation | `parseAiComplianceResponse` rejects `approved: true` |
| Fail-closed | Invalid shape → client heuristic fallback with degraded provenance |
| Human review | `prepareFormForComplianceSave` strips unapproved compliance fields |
| Canonical mutation | No without approver role |

## Non-LLM boundaries (census completeness)

- **Template generator** — `catalogueContentGenerators.ts` (deterministic, no provider)
- **Tesseract OCR** — Point 29 intake (out of Point 26 scope)
- **Product resolver runtime** — deterministic lexicon/scoring at edge

## Shadow / risk register

| ID | Severity | Status |
| --- | --- | --- |
| catalogue-gateway-no-oasis-fallback | — | **Resolved** |
| alias-stream-json-leak | — | **Resolved** |
| catalogue-provenance-service-marker | — | **Resolved** (legacy `oasis-ai-chat` blobs accepted; new saves use `catalogue-ai-copy`) |
| compliance-panel-unmounted | Medium | Tracked separately |
| edge-fn-not-in-repo | Low | Documented — client contract + smoke scripts |
| generate-product-attributes-no-live-llm | Low | Client fail-closed regardless |

## CI / certification gates

```bash
npm run typecheck
npm run test -- src/shared/ai/inferenceCensus.test.ts src/shared/ai/inferenceProvenance.test.ts
npm run check:boundaries
npm run certify:point26-inference-audit
```

Evidence artifact: `audit-artifacts/point26-inference-audit/census-evidence.json`

## Safety

- No production data mutation from this closure lane.
- No Supabase migration or Edge Function deployment from AI Studio repo.
- `PR MERGED != Point 26 cleared` until runtime provider evidence required by #459 is reconciled on target environment.
