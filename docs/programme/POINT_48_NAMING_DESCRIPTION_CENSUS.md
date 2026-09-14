# Point 48 — Governed AI Naming / Descriptions Census

## Programme status

- Point: 48
- Title: AI-assisted product naming and descriptions — canonical closure
- Consolidation base: current `main` after Points 26, 28, 38–40 and 42–47
- Repository: `oasisbaklawa2006/oasis-ai-studio`
- Scope boundary: naming + description suggestion contract only. Point 49 multilingual/selling points, Point 50 channel copy, Point 51 mobile creation, and Point 54 publication authority remain separate.

## Generator census

| # | Module / boundary | Fields | Provider | Provenance | Human review | Persistence target |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `catalogueContentGenerators.ts` | catalogue title/descriptions/channel copy | Local template | Deterministic template | Studio operator review | `catalogue_ai_studio_drafts` |
| 2 | `catalogueAiGateway.ts` → `catalogue-ai-copy` | Same catalogue copy schema | Governed Edge Function | Point 26 inference provenance + source snapshot | Mandatory review envelope | Draft content + audit |
| 3 | `fastCreateSuggestions.ts` | `short_name`, `description`, `short_description` | `governedProductNaming` heuristic | `namingProvenance` | Review-only suggestions | Governed Fast Create handoff |
| 4 | `generate-product-attributes` / governed extraction | Compliance fields | Point 30 path | Governed extraction provenance | Compliance approval | Separate factual/compliance authority |
| 5 | `productTextParser` / text intake | Identity/pricing extraction | Deterministic parser | Intake provenance | Review required | Draft patch only |

## Current-main reconciliation

This consolidation preserves later canonical work already on `main`:

- Point 26 inference authority remains the provider/provenance authority.
- Point 34 factual composition remains fail-closed: Fast Create does not invent ingredients, allergens, or nutrition.
- Points 38–40 workflow, correction, and immutable audit history remain unchanged.
- Points 42–47 media governance remain unchanged.

## Governed contract

Canonical module: `src/features/governedProductNaming/`

- `AuthoritativeProductFacts` — sole grounding input.
- `buildHeuristicNamingSuggestions` — deterministic review candidates.
- `validateGovernedCatalogueCopy` — post-provider factual-claim gate.
- `validateProviderReviewEnvelope` — requires human review and prevents provider self-approval.
- `mockCatalogueAiCopyProvider` — deterministic offline provider harness.

### Fail-closed conditions

1. Missing or blank `product_name`.
2. Provider envelope missing human-review markers.
3. Schema-invalid catalogue copy.
4. Unsupported medical or nutritional claims.
5. Competitor-brand imitation.
6. Unsupported superlatives.
7. Invented ingredient/origin claims without authoritative factual support.

## Fast Create correction

The previous ungoverned marketing filler such as `Premium Oasis`, `signature`, and `crafted with quality ingredients` is replaced by fact-grounded naming suggestions. Point 34 protections are retained: ingredients, allergens, and nutrition remain absent unless supplied through their governed factual paths.

## Catalogue AI correction

`catalogueAiGateway.ts` now applies three independent gates before content can enter editor state:

1. Point 48 review-envelope validation.
2. Existing structured schema validation.
3. Point 48 factual-grounding validation.

Only after these pass is Point 26 inference provenance extracted and retained.

## Verification requirements

Software closure requires exact-head typecheck, tests, build, boundaries, lint/security and review. Runtime certification remains separately evidential for the live `catalogue-ai-copy` provider and operator review UX; it must not be inferred from unit CI alone.
