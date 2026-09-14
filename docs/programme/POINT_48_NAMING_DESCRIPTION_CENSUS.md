# Point 48 — Governed AI Naming / Description Census

## Purpose

Point 48 governs AI-assisted product naming and catalogue descriptions. Generated text is suggestion-only and must never become canonical product truth without human review.

## Current authority

| Surface | Authority | Point 48 treatment |
| --- | --- | --- |
| Fast Create naming/description hints | `fastCreateSuggestions.ts` | Governed heuristic suggestions grounded in product facts |
| Catalogue AI copy | `catalogueAiGateway.ts` → `catalogue-ai-copy` | Structured, review-only provider output with Point26 provenance |
| Compliance facts | Point30/34 contracts | Inputs only; Point48 cannot invent or approve them |
| Publication | Point54 | Explicitly out of scope; Point48 creates no publication authority |

## Fail-closed rules

- Product identity must be resolved before suggestions are accepted.
- Provider response must explicitly declare `human_review_required: true`, `suggestion_only: true`, and `approved: false`.
- Missing/invalid catalogue fields are rejected.
- Unsupported medical, nutritional, competitor-brand, superlative, and invented ingredient/origin claims are rejected.
- Pending AI text remains review-only.
- Point34 factual-composition safeguards remain intact; Fast Create still removes invented ingredients, allergens and nutrition values.
- Point26 inference provenance remains the canonical provider/audit boundary.

## Rebase closure

This implementation is rebased onto the current AI Studio `main`, preserving Points 26, 28, 34 and 38–47 rather than replaying the stale pre-consolidation Point48 branch.

New canonical module: `src/features/governedProductNaming/`.

Integration surfaces:

- `src/features/catalogueAiStudio/catalogueAiGateway.ts`
- `src/features/fastCreate/fastCreateSuggestions.ts`

Deterministic unit coverage is provided by `governedProductNaming.test.ts`; the mock provider performs no network or production mutation.

## Completion boundary

Point48 software closure requires exact-head CI plus runtime provider/human-review evidence. Point49 multilingual generation and Point50 channel-specific copy remain separate downstream points.
