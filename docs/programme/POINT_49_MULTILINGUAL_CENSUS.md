# Point 49 — Multilingual Names / Selling Points Census

## Programme status

- Point: 49
- Title: Multilingual product names, aliases, and selling points — canonical closure
- Status: IN PROGRESS (bounded PR dependent on Point 48 #186; `PR merged != Point49 cleared`)
- Starting SHA / ancestry: `5130d665cc0121191a10c904804e14d454ab3352` (Point 48 PR #186 head on `cursor/point48-governed-naming-descriptions-1ef5`)
- Parent baseline: `6f8e16417dcef2323d833072d23a92a32b87a833` (`main` at Point 48 branch creation)
- Repository: `oasisbaklawa2006/oasis-ai-studio` (AI/knowledge plane)
- Upstream authority: Point 48 `governedProductNaming` contract (`AuthoritativeProductFacts`, factual grounding, review envelope)
- Scope boundary: multilingual catalogue truth (names, aliases, selling points, locale-specific descriptions). Point 50 channel-specific copy adaptation remains separate.

## Supported locales (governed matrix)

| Code | Script | Role | Auto-generate | Review required |
|------|--------|------|---------------|-----------------|
| `en` | latin | source | Heuristic from Point48 facts | Yes |
| `hi` | devanagari | target | Pending unless approved Hindi source | Yes |
| `ar` | arabic | target | Alias seed rules only (no invented Arabic) | Yes |
| `tr` | latin | target | Alias seed rules only | Yes |
| *other* | — | — | **Fail closed** | — |

## Generator census

| # | Module / boundary | Output kinds | Provider | Language input | Provenance | Human review | Persistence target | Customer-facing consumption |
|---|-------------------|--------------|----------|----------------|------------|--------------|-------------------|----------------------------|
| 1 | `aliasSeedRules.ts` | `product_name_alias`, `regional_term`, `search_keyword` | **ungoverned heuristic** (pre-Point49) | Regex on `product_name` | None | Fast Create / AliasManager review | `product_aliases` after approval | Search, resolver, WhatsApp matching |
| 2 | `aliasSeedRules.ts` (Point49) | same | **`governedMultilingual` heuristic** | Point48 `AuthoritativeMultilingualSource` only | `multilingualProvenance` | Review-required suggestions | Same — never auto-publish | Same |
| 3 | `catalogueContentGenerators.ts` `hindiDescription` | `hindi_description` | **template** (pre-Point49) | English `product_name` embedded in Devanagari boilerplate | None | Studio operator edit | `catalogue_ai_studio_drafts` | Catalogue language tab |
| 4 | `catalogueContentGenerators.ts` (Point49) | `hindi_description` | **`resolveTemplateHindiDescription`** | Approved Hindi only; else explicit pending marker | `source_version` on suggestion | Review before publish | Draft content | Language tab — pending shown explicitly |
| 5 | `catalogueAiGateway.ts` → `catalogue-ai-copy` | `hindi_description` among 8 keys | **catalogue-ai-copy** edge (env-gated) | Point48 facts prompt | `source_snapshot.ai_generation` | `human_review_required` envelope | Draft row | "Generate Complete Catalogue Draft" |
| 6 | `catalogueAiGateway.ts` (Point49) | `hindi_description` | Same provider + **`validateGovernedHindiDescription`** | Point48 facts + multilingual source pin | Same + `source_version` | Same | Same | Rejects Latin-only "Hindi" and unsafe claims |
| 7 | `governedAliasExtraction.ts` | alias fragments | **oasis-ai-chat** (Point 30) | English prompt | Point 30 provenance | Alias review queue | `product_aliases` after approval | Search/resolver — **not multilingual selling points** |
| 8 | `pilotAliasEngine.ts` / `pilotAliasSeeds.ts` | pilot term suggestions | Static authority preview packs | Curated pilot SKUs | `authority_preview` | Pilot review UI | Local review storage | Pilot readiness dashboard |
| 9 | Language wave scripts (`execute-wave2a/b/c-language.mjs`) | approved aliases | Governed RPC (production, out-of-repo runtime) | Batch reports | `batch001_language_wave*` tags | Human approval reports | `product_aliases` (production) | Live search/WhatsApp — **not AI-generated** |
| 10 | `productLanguage/terms.ts` + `AliasManager.tsx` | six term types | Manual operator entry | Operator input | `manual` / draft payload | Draft approval or direct write | `product_aliases` / draft queue | Channel-scoped discoverability |
| 11 | `productLanguageReadiness.ts` | readiness score | Deterministic counter | Existing alias inventory | None | Informational only | None | Product Truth / intelligence panels |
| 12 | `catalogueLanguageFields.ts` | field classification | Static config | N/A | N/A | N/A | N/A | Separates language/messaging fields from general content (Point 50 boundary) |

## Language-wave files (offline production execution)

| Script | Wave | Source tag | Status |
|--------|------|------------|--------|
| `scripts/execute-wave2a-language.mjs` | 2A | `batch001_language_wave2a` | Executed in production (archival) |
| `scripts/execute-wave2b-language.mjs` | 2B | `batch001_language_wave2b` | Executed in production (archival) |
| `scripts/execute-wave2c-language.mjs` | 2C | `batch001_language_wave2c` | Executed in production (archival) |

Reports: `docs/LANGUAGE_WAVE2A_APPROVAL_REPORT.md`, `docs/LANGUAGE_WAVE2B_APPROVAL_REPORT.md`, `docs/BATCH001_LANGUAGE_COVERAGE_REPORT.md`

## Gaps identified and remediated (this PR)

| Issue | Location | Risk | Point49 action |
|-------|----------|------|----------------|
| Hindi template presents English `product_name` inside Devanagari boilerplate as translated truth | `catalogueContentGenerators.ts` | Wrong-language claim | `resolveTemplateHindiDescription` — pending marker when no approved Hindi |
| Alias seeds auto-derived without locale provenance or source version | `fastCreateSuggestions.ts`, `AliasManager.tsx` | Bypasses review; inconsistent names | `governedAliasSeedsFromSource` with `multilingualProvenance` |
| No post-provider Hindi locale/script validator | `catalogueAiGateway.ts` | Latin "Hindi" could enter editor | `validateGovernedHindiDescription` after Point48 grounding gate |
| Unsupported locale could be silently accepted | No central matrix | Unsafe auto-generation | `SUPPORTED_MULTILINGUAL_LOCALES` + `resolveLocale` fail-closed |
| Selling points invented per locale without approved source copy | Implicit in templates | Factual drift | `resolveSellingPointForLocale` — pending unless approved locale copy |
| No deterministic mocked multilingual provider tests | — | Provider regressions | `mockMultilingualProvider` + 22 unit tests |

## Explicitly not in this PR

- Point 50: WhatsApp/web/label channel-specific copy adaptation (`whatsapp_product_message`, `b2b_sales_copy`, etc. tone variants)
- Production `catalogue-ai-copy` / multilingual provider deployment or mutation
- Core schema migration for `product_language_terms` table
- Language wave script re-execution in production
- Auto-publish of any multilingual suggestion

## Governed contract established (this PR)

Canonical module: `src/features/governedMultilingual/`

- `AuthoritativeMultilingualSource` — Point48 facts + pinned `source_version` + optional approved locale copy
- `buildHeuristicMultilingualSuggestions` — deterministic review candidates
- `governedAliasSeedsFromSource` — governed alias seed bridge for Fast Create / AliasManager
- `resolveTemplateHindiDescription` — explicit pending vs approved Hindi
- `resolveSellingPointForLocale` — selling point from approved source only
- `validateGovernedHindiDescription` — locale/script + factual fidelity gate
- `validateProviderMultilingualEnvelope` — requires `human_review_required`, `suggestion_only`, `approved: false`, `source_version`
- `mockMultilingualProvider` — deterministic test harness (no network)

### Fail-closed conditions

1. Missing / blank `product_name` (inherited from Point 48)
2. Missing `source_version` pin
3. Unsupported locale outside `en` / `hi` / `ar` / `tr`
4. Hindi content without Devanagari script (unless explicit pending marker)
5. Arabic content without Arabic script
6. Provider envelope missing review markers or source version
7. Restricted claims (reuses Point 48 `detectUnsafeNamingClaims`)
8. Provider-invalid output or competitor imitation

## Point 48 vs Point 49 vs Point 50 separation

| Concern | Point | Module |
|---------|-------|--------|
| English naming/description factual grounding | 48 | `governedProductNaming` |
| Multilingual names, aliases, selling points, locale descriptions | 49 | `governedMultilingual` |
| Channel tone/adaptation (WhatsApp pitch, B2B voice, export framing) | 50 | `catalogueContentGenerators` channel keys (out of Point49) |

## Tests added

- `src/features/governedMultilingual/governedMultilingual.test.ts` — locale resolution, source-version pinning, factual fidelity, fallback/pending, review serialization, mocked provider scenarios
- Updated `fastCreate.test.ts`, `catalogueAiGateway.test.ts` integration assertions

## Completion gates

Point 49 PR merge does **not** clear the programme stage. Remaining runtime evidence required:

- Multilingual human-review workflow certification in production
- Operator sign-off on pending-locale UX (Hindi/Arabic/Turkish)
- Mission Control gate certification per `oasisbaklawa2006/Oasis-Baklawa-Central/APPVERSE_MISSION_CONTROL.md`
- Point 48 #186 must merge first; then rebase and rerun full CI matrix
