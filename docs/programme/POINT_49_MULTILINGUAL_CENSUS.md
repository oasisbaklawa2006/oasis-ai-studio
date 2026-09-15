# Point 49 — Multilingual Names / Selling Points Census

## Purpose

Point 49 governs multilingual product aliases, selling points and Hindi catalogue copy derived from approved Point 48 product facts. Multilingual output remains review-only until explicitly approved.

## Canonical authority

| Surface | Authority | Point 49 treatment |
| --- | --- | --- |
| Fast Create aliases | `governedMultilingual` | Source-versioned suggestions only |
| Alias Manager | `governedAliasSeedsFromSource` | Reviewable generated aliases; no invented identity |
| Catalogue Hindi template | `resolveTemplateHindiDescription` | Approved Hindi or explicit pending marker |
| Catalogue AI Hindi output | `validateGovernedHindiDescription` | Script and factual-fidelity gate |
| Other locales | Governed locale matrix | `en`, `hi`, `ar`, `tr`; unsupported locales fail closed |
| Publication | Point 54 | No publication authority in Point 49 |

## Fail-closed invariants

- A pinned Point 48 `source_version` is mandatory.
- Provider output must remain suggestion-only, unapproved and human-review-required.
- Unsupported locales are rejected.
- Hindi copy must use Devanagari and may not masquerade English product-name text as translated truth.
- Arabic copy and aliases must contain Arabic script; Latin-only values cannot be accepted as Arabic truth.
- Unapproved locale copy is represented as pending, not fabricated.
- Selling points remain pending when no approved locale source exists.
- Fast Create continues to preserve Point 34 factual-composition safeguards; Point 49 does not restore inferred ingredients, allergens or nutrition.
- Point 26 inference provenance remains intact in the Catalogue AI gateway.

## Current-main integration

The closure is rebased onto the consolidated AI Studio main after Point 48 and Point 27 software closure. It includes:

- `src/features/governedMultilingual/types.ts`
- `src/features/governedMultilingual/governedMultilingualContract.ts`
- `src/features/governedMultilingual/governedMultilingualProvider.ts`
- `src/features/governedMultilingual/governedMultilingual.test.ts`
- governed alias generation in Fast Create and Alias Manager
- governed Hindi template generation
- post-provider multilingual validation in `catalogueAiGateway.ts`

## Completion boundary

Software closure requires both green exact-head CI and green GitHub merge-ref/current-merge CI. The merge-ref/current-merge check is the integration authority for compatibility with the then-current `main`. Runtime multilingual review evidence remains a separate certification/UAT item. Point 50 owns channel-specific copy and remains separate.
