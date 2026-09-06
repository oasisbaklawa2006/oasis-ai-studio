# Point 43 — Benchmark Photography Governance Canonical Closure

**ASM:** AI Studio Product Master media / photography authority  
**Mission Control authority:** Central #459 — Point 43 = benchmark photography governance  
**Starting SHA:** `54f7c526087580575db334039d52bb08f01aa150` (Point 42 PR #167 exact head)  
**Mandatory merge predecessor:** PR #167 (Point 42)  
**Boundary:** No image generation, no production mutation, no mobile camera/enhancement/QA/outputs (Points 44–47)

## Exact baseline census

| Surface | Path | Role |
| --- | --- | --- |
| Point 42 families | `src/features/mediaReadiness/controlledPhotographyFamilies.ts` | Authoritative family → slot → SOP chain (upstream) |
| Readiness profiles | `src/features/productTruth/readinessProfiles.ts` | Slot requirements per profile (upstream via Point 42) |
| Image prompt SOP templates | `src/features/catalogueAiStudio/catalogueContentGenerators.ts` | Local text prompts (`IMAGE_PROMPT_BLOCK_META`) — Oasis-neutral, no brand names |
| Image prompt composer | `catalogueContentGenerators.ts` → `composeCatalogueImagePrompt` | Per-slot template + optional operator instruction |
| Media authority | `src/features/mediaReadiness/mediaAuthorityContract.ts` | Approved-only row authority |
| Catalogue media slots | `src/features/catalogueAiStudio/catalogueMediaSlots.ts` | Studio Media tab adapters (Point 42 + Point 43) |
| CSS styling | `src/index.css` | Luxury catalogue visual tokens — **not** photo governance |
| Build meter benchmark | `src/components/BuildMeterBar.tsx` | 70% completion benchmark — unrelated to photography |

## Benchmark governance contract (Point 43)

| Domain | Oasis-neutral constraint | Protected by |
| --- | --- | --- |
| Composition | Centered product hierarchy; no competing props unless lifestyle slot | exact_product_fidelity, point42_required_slots |
| Lighting | Soft even studio light; no colour casts altering product | exact_product_fidelity |
| Product fidelity | Preserve exact shape, colour, count, arrangement | exact_product_fidelity, downstream_qa_authority |
| Packaging/text preservation | All label/carton text legible and unmodified; no generative overlays | packaging_text_preservation, downstream_qa_authority |
| Background | Clean neutral for catalogue/hero; contextual for lifestyle without brand impersonation | exact_product_fidelity |
| Crop/occupancy | 1:1 square crop; hero frame fill without clipping; close-up texture without identity loss | point42_required_slots |

## Family overlays (reconciled with Point 42 — no parallel taxonomy)

| Family key | Overlay slots | Key benchmark requirements |
| --- | --- | --- |
| `baklawa_small_sweets` | primary, catalogue, close_up | Centered hero, white/neutral background, macro texture |
| `gift_box` | pack_front, open_pack, primary | Label text preserved; closed/open pack composition |
| `export_pack` | label_front, packaging_reference, master_carton | HSN/regulatory text readable; carton markings unmodified |
| `hamper` | hamper_arrangement, close_up, primary | Warm arrangement; contextual table setting without third-party props |
| `general` | primary | Standard centered hero, neutral background |

## Bateel / brand-safety audit

| Area | Status |
| --- | --- |
| Customer-facing product authority | **No Bateel** — prompts, copy, and governance use Oasis-neutral language |
| CSS comments (`src/index.css`) | **Remediated** — "Bateel-style" → "luxury catalogue" |
| Internal benchmark provenance | `luxury_catalogue_reference` token in contract — never surfaced to buyers |
| `docs/PR_SEQUENCE.md` PR-09 | Separate Bateel UI rebuild track — not photo governance |
| Point 42 `downstreamAuthority.bateelGovernance` | Internal routing key only — points to Point 43 module |

## Fail-closed policy rules

1. Third-party brand names in operator instructions → `forbidden_brand_reference`.
2. Instructions to add/remove/alter text on packaging → `packaging_text_preservation` conflict.
3. Instructions to alter product shape/colour/count → `exact_product_fidelity` conflict.
4. Instructions to skip required slots → `point42_required_slots` conflict.
5. Instructions to bypass QA → `downstream_qa_authority` conflict.
6. Point 42 family resolution failure propagates — no fallback to invented families.

## Downstream points (strictly separate)

| Point | Scope | Point 43 boundary |
| --- | --- | --- |
| **44** | Mobile camera capture | Referenced only in `downstreamAuthority` |
| **45** | Photo enhancement | Not touched |
| **46** | Photography QA scoring | Authority reserved — Point 43 does not score images |
| **47** | Photography output formats | Not touched |

## Files touched

| File | Change |
| --- | --- |
| `src/features/mediaReadiness/benchmarkPhotographyGovernance.ts` | **NEW** — Point 43 canonical governance contract + instruction validation |
| `src/features/mediaReadiness/benchmarkPhotographyGovernance.test.ts` | **NEW** — 15 focused policy + fail-closed tests |
| `src/features/catalogueAiStudio/catalogueMediaSlots.ts` | Wire `catalogueBenchmarkGovernance*` adapters |
| `src/features/catalogueAiStudio/catalogueMediaSlots.test.ts` | Point 43 adapter wiring tests |
| `src/features/mediaReadiness/controlledPhotographyFamilies.ts` | Update census downstream path for Point 43 |
| `src/index.css` | Neutralize Bateel CSS comments |
| `docs/programme/POINT_43_BENCHMARK_PHOTOGRAPHY_GOVERNANCE_CENSUS.md` | **NEW** — this census |

## Gate state

| Gate | Status |
| --- | --- |
| Branched from Point 42 #167 head `54f7c526` | **PASS** |
| Benchmark governance contract implemented | **PASS** |
| Reconciled with Point 42 five families — no parallel taxonomy | **PASS** |
| Bateel brand-safety remediated | **PASS** |
| Points 44–47 kept separate | **PASS** |
| PR dependent on #167 | **DRAFT** — await #167 merge, then rebase |
| Merge | **STOP** — await review from `dineshmutrejabackup-cmd` |
