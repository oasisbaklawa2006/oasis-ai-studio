# Point 48 — Governed AI Naming / Descriptions Census

## Programme status

- Point: 48
- Title: AI-assisted product naming and descriptions — canonical closure
- Status: IN PROGRESS (bounded PR; `PR merged != Point48 cleared`)
- Baseline commit (start SHA): `6f8e16417dcef2323d833072d23a92a32b87a833`
- Repository: `oasisbaklawa2006/oasis-ai-studio` (AI/knowledge plane)
- Scope boundary: naming + description suggestion contract only. Point 49 multilingual/selling points, Point 50 channel copy, Point 51 mobile creation, Point 54 publication authority remain separate.

## Generator census

| # | Module / boundary | Fields | Provider | Language input | Provenance | Human review | Persistence target | Catalogue integration |
|---|-------------------|--------|----------|----------------|------------|--------------|-------------------|----------------------|
| 1 | `catalogueContentGenerators.ts` | `catalogue_title`, `short_description`, `long_description`, B2B/export/WhatsApp/Hindi/storage | **template/heuristic** (local, no network) | Uses existing product fields only | None (deterministic template) | Operator edits in Catalogue Product AI Studio before save | `catalogue_ai_studio_drafts` content columns | Primary local draft bootstrap |
| 2 | `catalogueAiGateway.ts` → `catalogue-ai-copy` edge | Same 8 catalogue copy keys | **catalogue-ai-copy** Edge Function (governed; env-gated `VITE_CATALOGUE_AI_ENABLED`) | Prompt built from `CatalogueAiSourceFacts` + tone | `source_snapshot.ai_generation` via `catalogueAiGenerationMerge.ts` | `human_review_required` envelope + studio review workflow | Draft row content + audit log | "Generate Complete Catalogue Draft" action |
| 3 | `fastCreateSuggestions.ts` (pre-Point48) | `short_name`, `description`, `short_description` | **ungoverned heuristic** | Category defaults | None | Fast Create form review | `products` on explicit save | Fast Create intake |
| 4 | `fastCreateSuggestions.ts` (Point48) | same | **`governedProductNaming` heuristic contract** | Authoritative facts only | `namingProvenance` on suggestions object | Review-required suggestions only | Same — never auto-publish | Fast Create intake |
| 5 | `generate-product-attributes` edge | compliance fields (HSN/GST/ingredients/etc.) | Mock/heuristic edge | product_name + category | Point 30 governed extraction | Compliance approval panel | Compliance fields on product | **Out of Point48 scope** (Point 30) |
| 6 | `oasis-ai-chat` via `governedAliasExtraction` | aliases only | Streaming chat proxy | English prompt | Point 30 provenance | Alias review queue | `product_aliases` after approval | Search/resolver aliases — **not naming/description** |
| 7 | `productTextParser` / `textIntake` | parsed identity/pricing fields | Regex/heuristic parser | Free text / voice transcript | Intake suggestions | `reviewRequired: true` | Draft patch only | Fast Create text/voice intake — extraction, not generative copy |

## Duplicates and gaps identified

### Duplicate generators (naming/description)

- **Catalogue template vs catalogue-ai-copy**: Both produce the same 8-field catalogue copy set. Template is the offline bootstrap; AI is the governed provider path. Not merged — distinct operator actions with shared field schema.
- **Fast Create heuristic vs catalogue template**: Both could emit `description` / `short_description`. Point48 unifies factual grounding rules via `governedProductNaming` for Fast Create; catalogue template already refuses to invent facts (missing-field placeholders).

### Ungoverned / unsafe paths (remediated in this PR)

| Issue | Location | Risk | Point48 action |
|-------|----------|------|----------------|
| Invented marketing copy ("Premium Oasis", "signature", "crafted with quality ingredients") | `fastCreateSuggestions.ts` | Unsupported superlatives / implied ingredients | Replaced with `buildHeuristicNamingSuggestions` |
| Default allergen/ingredient strings without authoritative source | `fastCreateSuggestions.ts` | Factual hallucination (compliance) | **Flagged, not changed** — Point 30 compliance scope |
| Provenance service mismatch (`oasis-ai-chat` marker vs `catalogue-ai-copy` gateway) | `catalogueAiGenerationMerge.ts` | Broken audit trail | Normalized to `catalogue-ai-copy`; legacy blobs still readable |
| No post-provider factual-claim validator on catalogue AI output | `catalogueAiGateway.ts` | Unsafe claims could enter editor | Added `validateGovernedCatalogueCopy` + review envelope check |
| `catalogue-ai-copy` edge function not in repo | `supabase/functions/` | Deployed separately (Core); smoke script exists | No production deployment in this PR |

### Reconciliation with Point 26 / Point 30

- **Point 26 (inference authority)**: Catalogue AI gateway already gated by identity readiness and env flag. Point48 adds fail-closed grounding validation so provider output cannot bypass review with invented claims.
- **Point 30 (governed extraction)**: Extracted compliance fields and parsed intake values are **inputs only**. They do not grant permission to hallucinate product facts in naming/description copy. Fast Create compliance enrichment remains on the Point 30 path (`governedAiExtraction`).

## Governed contract established (this PR)

Canonical module: `src/features/governedProductNaming/`

- `AuthoritativeProductFacts` — sole grounding input
- `buildHeuristicNamingSuggestions` — deterministic review candidates
- `validateGovernedCatalogueCopy` — provider output safety gate
- `validateProviderReviewEnvelope` — requires `human_review_required`, `suggestion_only`, `approved: false`
- `mockCatalogueAiCopyProvider` — deterministic mocked provider for tests (no network)

### Fail-closed conditions

1. Missing / blank `product_name`
2. Provider envelope missing review markers
3. Schema-invalid catalogue copy
4. Restricted claims: medical, nutritional, competitor brands, unsupported superlatives, invented ingredients without authoritative description

## Tests added

- `src/features/governedProductNaming/governedProductNaming.test.ts` — factual grounding, provenance, unsafe-claim rejection, empty/partial facts, review envelope, mocked provider scenarios
- Updated `fastCreate.test.ts`, `catalogueAiGateway.test.ts` integration assertions

## Out of scope (later points)

- Point 49: multilingual expansion / selling points
- Point 50: channel-specific copy variants
- Point 51: mobile creation workflows
- Point 54: publication authority / live provider certification
- Deploying or mutating production `catalogue-ai-copy` edge function

## Completion gates

Point 48 PR merge does **not** clear the programme stage. Remaining runtime evidence required:

- Live `catalogue-ai-copy` provider certification with human-review workflow in production
- Operator sign-off on review UX for naming/description suggestions
- Mission Control gate certification per `oasisbaklawa2006/Oasis-Baklawa-Central/APPVERSE_MISSION_CONTROL.md`
