# Phase 2A — Product Intelligence & WhatsApp Runtime Foundation

## Investigation Report (Architecture Approval Gate)

**Status:** INVESTIGATION ONLY — no implementation until approved  
**Baseline:** Catalogue Pilot v1.0 (`f6da79c`, `index-BqAFGGeW.js`, tag `v1.0-catalogue-pilot`)  
**Date:** 2026-06-22  
**Supabase:** `tcxvcatsqqertcnycuop` (live Central, read-only for resolver)

---

## Executive summary

Oasis AI Studio already contains a **read-only product resolver prototype** (`src/features/productResolver/`) that scores WhatsApp-style utterances against product names, SKUs, and flat aliases. It is **not wired to UI or runtime**, and it is **separate from Product Master search** (`productSearch.ts`).

Phase 2A can deliver production-grade natural-language matching **without modifying catalogue architecture** by:

1. **Hardening and extending the existing resolver module** (additive only)
2. **Adding a confidence-band governance layer** (HIGH / MEDIUM / LOW)
3. **Expanding the catalog loader** to read upstream fields (name, short_name, category, subcategory) via existing adapters
4. **Building an admin utterance sandbox** (preview only — no ordering)
5. **Shipping a 95%+ test matrix** across baklawa, kunafa, dates, and fusion ranges

**Current baseline:** 100% (33/33) on a **17-SKU baklawa-only** fixture.  
**Phase 2A target corpus:** not yet tested — includes kunafa, dates, fusion, and catalogue-pilot acceptance products.

---

## Constraints (non-negotiable)

| Rule | Implication |
|------|-------------|
| Catalogue frozen | Resolver **reads** `products` / `product_aliases`; never changes write contracts |
| No SKU architecture changes | No `SkuBuilder`, taxonomy, or RPC changes |
| No Product Truth redesign | Readiness engine unchanged; optional read-only gate display only |
| No alias redesign | No `AliasManager` / draft / approve flow changes |
| No Central Sync redesign | Snapshot export unchanged |
| No ordering / ERP / inventory / labels | Runtime is **identify + rank + govern** only |

---

# Deliverable 1 — Resolver Architecture Report

## 1.1 Current state

### Module: `src/features/productResolver/`

| File | Responsibility |
|------|----------------|
| `normalizeUtterance.ts` | Lowercase, strip punctuation/quantities, remove EN+Hinglish fillers |
| `resolveProduct.ts` | Token-overlap scoring, candidate ranking, ambiguity detection |
| `loadResolverCatalog.ts` | Supabase read: `products(id, sku, name)` + `product_aliases(alias_text, canonical_name)` |
| `types.ts` | `ResolverCatalog`, `ProductResolverResult`, `ResolverConfig` |
| `index.ts` | Public exports |

### Public API (today)

```typescript
normalizeUtterance(input: string): string

resolveProductFromCatalog(
  input: string,
  catalog: ResolverCatalog,
  config?: ResolverConfig,  // default: min 0.72, delta 0.08, max 3 candidates
): ProductResolverResult

loadResolverCatalog(skuFilter?: string[]): Promise<ResolverCatalog>
```

### Result shape (today)

```typescript
{
  input, normalized_text,
  matched_sku, matched_product, matched_product_id,  // null if clarify
  confidence: number,                                // 0–1 float
  clarification_required: boolean,
  candidates: ResolverCandidate[]                    // ranked, max 3
}
```

**Missing for Phase 2A:** `confidence_band`, `reason`, `alternatives` label, category/subcategory signals, short_name, fuzzy spelling, `term_type` weighting.

### Scoring algorithm (as-built)

```
1. SKU fast-path (OAS-* pattern) → skip normalization
2. For each product: SKU exact (1.0), SKU partial (0.95), name token overlap (cap 0.92)
3. For each alias: alias_text overlap (cap 0.94), canonical_name (cap 0.90)
4. Dedupe by product_id — keep highest confidence
5. Sort desc, take top 3
6. clarification_required IF:
   - top.confidence < 0.72 OR
   - top.confidence - second.confidence < 0.08
```

### Related but separate: `productSearch.ts`

| Aspect | Product Master search | Product resolver |
|--------|----------------------|------------------|
| Purpose | Admin list filtering | WhatsApp / NL identification |
| Algorithm | ILIKE + optional pg_trgm RPC | Token overlap on normalized utterance |
| Output | Up to 50 rows, `match_score` | Top 3 + clarify flag |
| Channel scope | None | Not implemented |
| Utterance normalization | No | Yes |

**Recommendation:** Keep separate. Phase 2A builds on **resolver only**. Optionally share a future `scoringUtils` package — not required for 2A.

## 1.2 Proposed Phase 2A architecture

```
┌─────────────────────────────────────────────────────────────┐
│  UPSTREAM (frozen catalogue — read only)                    │
│  products · product_aliases · (optional localStorage meta)  │
└───────────────────────────┬─────────────────────────────────┘
                            │ loadResolverCatalog v2
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Lexicon Index (in-memory, per request or short TTL cache)  │
│  entries: sku, name, short_name, category, subcategory,     │
│           alias_text, canonical_name, inferred channel      │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Utterance Pipeline                                         │
│  normalize → extract qty (advisory) → tokenize → score      │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Resolver Engine (resolveProductFromCatalog v2)             │
│  + synonym map (static, additive)                           │
│  + optional fuzzy (trigram/edit distance)                   │
│  + source weights (sku > whatsapp alias > name > category)  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Governance Layer                                           │
│  confidence_band: HIGH | MEDIUM | LOW                         │
│  action: auto_suggest | operator_review | ask_clarification   │
│  reason: human-readable string                              │
└───────────────────────────┬─────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
   Admin Utterance Sandbox          Future: Edge Function
   (/admin/resolver-preview)        (post-2A, not in scope)
```

### New package location (proposed)

```
src/features/productIntelligence/
  runtime/
    resolveProductUtterance.ts    # orchestrator
    confidenceBands.ts            # HIGH/MEDIUM/LOW mapping
    catalogLexicon.ts             # extended loader + index
    synonymMap.ts                 # additive Hinglish/customer map (read-only config)
    types.ts
    runtime.test.ts
    fixtures/
      baklawa-range.json
      kunafa-range.json
      dates-range.json
      fusion-range.json
```

**Alternative:** Extend `src/features/productResolver/` in place. Either is acceptable; prefer **`productIntelligence/runtime/`** to keep catalogue pilot module untouched and signal runtime vs readiness split.

### Catalog loader v2 (read-only extensions)

| Field | Source | Notes |
|-------|--------|-------|
| `product_name` | `products.product_name` | Fallback `name` |
| `short_name` | `products.short_name` | New scoring target |
| `category` | `products.category` | Weak signal / disambiguation |
| `subcategory` | `products.subcategory` | Weak signal |
| `aliases` | `aliasSchemaAdapter.queryProductAliasesForProduct` | Dual schema — **must replace direct `alias_text` query** |

No schema migrations required for loader v2.

### API v2 (proposed)

```typescript
type ConfidenceBand = 'HIGH' | 'MEDIUM' | 'LOW';
type ResolverAction = 'auto_suggest' | 'operator_review' | 'ask_clarification';

type ProductResolverResultV2 = ProductResolverResult & {
  confidence_band: ConfidenceBand;
  action: ResolverAction;
  reason: string;
  alternatives: Array<{
    sku: string;
    product_name: string;
    confidence: number;
    matched_term: string;
    match_source: string;
  }>;
  extracted_quantity?: string | null;  // advisory only in 2A
};
```

### Deployment surfaces (Phase 2A only)

| Surface | Scope |
|---------|-------|
| **Vitest suite** | 95%+ correct first match |
| **CLI audit script** | `scripts/run-resolver-phase2a-audit.mjs` |
| **Admin sandbox page** | Paste utterance → JSON result (no writes) |
| **Edge function** | Out of scope for 2A approval gate |

---

# Deliverable 2 — Product Intelligence Report

## 2.1 Capability layers (today)

| Layer | Module | Role | Phase 2A |
|-------|--------|------|----------|
| **Language authority UI** | `productLanguage/`, `AliasManager` | Term types, drafts, localStorage metadata | **Frozen** — read metadata only if present |
| **Discoverability readiness** | `productIntelligence/` | 0–5 score, snapshot `language_intelligence` block | **Frozen** — no changes |
| **Product Master search** | `productSearch.ts` | Admin search with RPC/fallback | **Frozen** |
| **Resolver prototype** | `productResolver/` | NL matching tests | **Extend** |
| **WhatsApp outbound** | `whatsappPreview.ts`, SharePanel | Catalogue text / deep links | **Frozen** |
| **WhatsApp inbound runtime** | — | Not built | **Phase 2A foundation only** |

## 2.2 Capability readiness (from audit docs)

| Capability | Score | Phase 2A impact |
|------------|-------|-----------------|
| Product Language UI | 85% | Unchanged |
| Product Truth integration | 75% | Optional sandbox link from Product Truth admin |
| Snapshot language block | 70% | Unchanged |
| Search consumption | 65% | Unchanged (resolver is parallel path) |
| Central WhatsApp consumption | 15% | 2A raises to ~40% (identify layer only) |
| Typed `product_language_terms` table | 0% | **Deferred** — not required if flat aliases + synonym map |

## 2.3 Data available for matching (live Central)

| Signal | Available | Used by resolver today |
|--------|-----------|------------------------|
| `products.name` / `product_name` | Yes | Partial (`name` only in loader) |
| `products.short_name` | Yes | **No** |
| `products.sku` | Yes | Yes |
| `products.category` / `subcategory` | Yes | **No** |
| `product_aliases.alias_text` | Yes (legacy) | Yes |
| `product_aliases.alias` (migration) | No on live | Adapter handles on read |
| `term_type` / `whatsapp_keyword` | UI/localStorage only | **No** |
| `search_products_with_aliases` RPC | **Not deployed** | N/A for resolver (in-process scoring) |

## 2.4 Intelligence gaps to close in Phase 2A

| Gap | Priority | Approach (no catalogue change) |
|-----|----------|--------------------------------|
| Loader uses `name` not `product_name` | P0 | Map in loader v2 |
| Loader bypasses `aliasSchemaAdapter` | P0 | Route reads through adapter |
| No short_name / category scoring | P1 | Add weak signals in scorer |
| No confidence bands | P0 | Governance layer |
| No `reason` string | P0 | Template from match_source + ambiguity |
| Hinglish beyond filler strip | P1 | Static `synonymMap.ts` (pista↔pistachio, kaju↔cashew) |
| Spelling tolerance | P1 | Optional Levenshtein per token (threshold 0.85) |
| Kunafa/dates/fusion untested | P0 | New test fixtures |
| "pc" / "pcs" not stripped | P2 | Extend `FILLER_WORDS` + quantity patterns |
| UI sandbox | P1 | New admin route |

---

# Deliverable 3 — Confidence Model

## 3.1 Current model

| Parameter | Value | Effect |
|-----------|-------|--------|
| `min_threshold` | 0.72 | Below → clarify |
| `ambiguity_delta` | 0.08 | Top-two closer than this → clarify |
| `max_candidates` | 3 | Alternatives cap |

Binary output: `clarification_required: boolean` + float `confidence`.

**No HIGH/MEDIUM/LOW exists in codebase today.**

## 3.2 Proposed confidence bands (Phase 2A)

### Band assignment

| Band | Conditions | Action | UX label |
|------|------------|--------|----------|
| **HIGH** | `!clarification_required` **AND** `confidence ≥ 0.85` | `auto_suggest` | Safe to pre-fill product suggestion |
| **MEDIUM** | `!clarification_required` **AND** `0.72 ≤ confidence < 0.85` | `operator_review` | Show top match; human confirms |
| **LOW** | `clarification_required` **OR** `confidence < 0.72` **OR** zero candidates | `ask_clarification` | Present numbered alternatives or ask rephrase |

### Ambiguity override

Even if `confidence ≥ 0.85`, if `top - second < 0.08` → force **LOW** (current behavior preserves safety).

### Reason strings (templates)

| Situation | Example `reason` |
|-----------|------------------|
| SKU exact | `Matched SKU exactly: OAS-AS-BKL-0020` |
| Alias exact | `Matched WhatsApp alias "midya bulk pista"` |
| Name token | `Matched product name tokens (2/2): Classic Pistachio Midya Bulk` |
| Ambiguous | `Multiple products score within 0.08 — clarification required` |
| Below threshold | `Best confidence 0.68 below 0.72 threshold` |
| No match | `No product matched normalized text "xyz"` |
| Fuzzy | `Fuzzy match on alias "kaju tart" → Cashew Tart (distance 1)` |

### Source weight multipliers (proposed)

Applied **after** base token score, before cap:

| `match_source` | Multiplier | Rationale |
|----------------|------------|-----------|
| `sku` | 1.00 | Definitive |
| `alias` (whatsapp_keyword inferred) | 0.98 | Chat-primary |
| `alias` (generic) | 0.95 | Approved alias |
| `short_name` | 0.90 | Compact catalogue name |
| `name` | 0.88 | Official name |
| `canonical_name` | 0.85 | Display fallback |
| `category` | 0.60 | Weak — never alone above MEDIUM |

Caps remain: alias ≤ 0.94, name ≤ 0.92, etc.

### Tuning protocol

1. Run Phase 2A fixture suite
2. Target ≥ 95% **first-match correct** on unambiguous cases
3. Target 100% **correct clarify** on intentional ambiguity cases
4. Adjust only `synonymMap` and fuzzy threshold — not catalogue data

---

# Deliverable 4 — WhatsApp Matching Report

## 4.1 Utterance normalization (as-built)

`normalizeUtterance` handles:

- Lowercase, punctuation strip
- Quantity removal (`\d+`)
- Filler removal: `need`, `chahiye`, `bhejo`, `mujhe`, `kg`, `pieces`, etc.

**Gaps for Phase 2A examples:**

| Input | Normalized (today) | Issue |
|-------|-------------------|-------|
| `6 pc midya` | `pc midya` | `pc` not in filler list |
| `pista midya` | `pista midya` | OK if aliases exist |
| `kaju tart` | `kaju tart` | OK — maps via alias corpus |
| `dates pista` | `dates pista` | Needs dates-range aliases |
| `frozen cheese` | `frozen cheese` | May match multiple kunafa products |

## 4.2 Phase 2A example mapping (predicted)

Based on catalogue pilot acceptance products and alias patterns. **Not yet executed against live DB** — requires implementation + fixture run.

| Utterance | Expected product | Expected band | Dependencies |
|-----------|------------------|---------------|--------------|
| `midya` | Classic Pistachio Midya Bulk | MEDIUM–HIGH | Alias `Midya Bulk Pista` |
| `6 pc midya` | Classic Pistachio Midya Gift Pack 6 pcs | MEDIUM | Pack size disambiguation vs bulk midya |
| `pista bulbul` | Pistachio Bulbul Bulk | HIGH | Alias `Bulbul Pista` |
| `kunafa cheese` | Frozen Cheese Kunafa | HIGH | Alias `Cheese Kunafa Frozen` |
| `frozen kunafa` | Frozen Cheese Kunafa | MEDIUM | May compete with Roasted Kunafa |
| `stuffed dates` | Pistachio Stuffed Dates | HIGH | Alias `Pista Dates` |
| `channa badam` | Channa Badam Barfi | HIGH | Alias `Channa Barfi` |
| `pista midya` | Midya variant | MEDIUM | Bulk vs gift pack ambiguity |
| `kaju tart` | Cashew Tart Bulk | HIGH | Alias `Kaju Tart Bulk` |
| `frozen cheese` | Frozen Cheese Kunafa | MEDIUM–HIGH | Category signal |

**Risk:** Without live aliases on acceptance SKUs, several examples may score **LOW** until alias corpus is populated upstream (catalogue ops — not resolver code).

## 4.3 Spelling / Hinglish strategy (additive)

| Technique | Phase 2A | Catalogue impact |
|-----------|----------|------------------|
| Filler strip (existing) | Yes | None |
| Static synonym map | **New** `synonymMap.ts` | None — read-only config |
| Token substring overlap (existing) | Yes | None |
| Levenshtein per token (≤1 edit) | Proposed | None |
| pg_trgm via RPC | Optional Phase 2B | Would need RPC deploy — **out of 2A scope** |
| Transliteration (Hindi script) | Phase 3 | None |

### Proposed initial synonym map (config only)

```typescript
// Illustrative — not implemented until approval
{ pista: ['pistachio', 'pista'], kaju: ['cashew', 'kaju'],
  midya: ['midya', 'media'], kunafa: ['kunafa', 'knafeh', 'knafa'],
  badam: ['almond', 'badam'], channa: ['chana', 'channa'] }
```

## 4.4 WhatsApp governance flow (Phase 2A — preview only)

```
Customer message
    → normalizeUtterance
    → resolveProductFromCatalog v2
    → confidence_band
         HIGH   → auto_suggest (show product card in sandbox)
         MEDIUM → operator_review (highlight + confirm button)
         LOW    → ask_clarification (numbered candidates)
```

**No message sending, no draft orders, no webhook.**

---

# Deliverable 5 — Test Results

## 5.1 Baseline (existing — baklawa 17-SKU fixture)

| Metric | Result |
|--------|--------|
| Script | `node scripts/run-resolver-prototype-audit.mjs` |
| SKUs covered | 17 (Batch 001 baklawa waves) |
| Aliases | 201 (draft payload fixtures) |
| Utterances | 33 |
| Pass | **33/33 (100%)** |
| Vitest unit tests | **5/5** in `productResolver.test.ts` |

This validates **baklawa cluster disambiguation** (Asiyah family, tart cluster) but **does not cover** kunafa, dates, fusion, or catalogue-pilot acceptance SKUs.

## 5.2 Phase 2A target test matrix (proposed — not yet run)

### Ranges

| Range | Source SKUs | Min utterances | Target |
|-------|-------------|----------------|--------|
| **Baklawa** | Extend existing 17 + acceptance bulk/pack | 40 | 95%+ first match |
| **Kunafa** | Frozen Cheese Kunafa, Roasted Kunafa | 15 | 95%+ |
| **Dates** | Pistachio Stuffed Dates + future | 10 | 95%+ |
| **Fusion** | Channa Badam Barfi + future | 10 | 95%+ |

### Scoring definition

| Case type | "Correct" means |
|-----------|-----------------|
| Unambiguous | `matched_sku === expected` AND `confidence_band !== LOW` |
| Intentionally ambiguous | `action === ask_clarification` AND expected SKU in `candidates` |
| **First-match rate** | Unambiguous correct / total unambiguous |

### Predicted gaps before implementation

| Gap | Impact on 95% target |
|-----|---------------------|
| Acceptance product aliases live in DB but not in 17-SKU fixture | Must build fixtures from live or acceptance report SKUs |
| `loadResolverCatalog` reads `name` not `product_name` | Kunafa/dates may miss if only `product_name` populated |
| `pc` token not stripped | `6 pc midya` may fail or hit wrong product |
| `frozen kunafa` vs `roasted kunafa` | MEDIUM/LOW without strong aliases |
| No fuzzy match | Spelling mistakes (`pistchio`, `kunaffa`) may fail |

### Recommended test file structure

```
src/features/productIntelligence/runtime/
  phase2a-resolver.test.ts       # ≥75 cases
  fixtures/
    utterances-baklawa.json
    utterances-kunafa.json
    utterances-dates.json
    utterances-fusion.json
scripts/run-resolver-phase2a-audit.mjs
```

---

## Implementation plan (post-approval only)

| Step | Effort | Touches catalogue? |
|------|--------|-------------------|
| 1. `catalogLexicon.ts` + adapter-based loader | Small | **No** |
| 2. `confidenceBands.ts` + `reason` builder | Small | **No** |
| 3. `synonymMap.ts` + filler fixes (`pc`, `pcs`) | Small | **No** |
| 4. Optional fuzzy token match | Medium | **No** |
| 5. Phase 2A test fixtures + 95% gate in CI | Medium | **No** |
| 6. Admin sandbox page `/admin/resolver-preview` | Medium | **No** |
| 7. Documentation update | Small | **No** |

**Estimated new files:** ~8–10  
**Estimated modified files:** 0 catalogue paths; optional `package.json` script only

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Alias corpus thin on kunafa/dates/fusion SKUs | High | Gate 2A signoff on fixture pass **after** upstream aliases confirmed |
| `term_type` not in DB | Medium | Synonym map + alias_text; defer typed weights to Phase 2B |
| Resolver vs search divergence | Low | Document two paths; do not merge |
| Over-automation on MEDIUM band | Medium | Default MEDIUM to operator_review in sandbox |
| Scope creep into ordering | High | Strict module boundary; no `draft_orders` |

---

## Approval checklist

Before implementation begins, confirm:

- [ ] Package location: `productIntelligence/runtime/` vs extend `productResolver/`
- [ ] Confidence band thresholds (0.85 / 0.72 / 0.08 delta)
- [ ] Static synonym map approach acceptable (no alias schema change)
- [ ] Admin sandbox route OK (`/admin/resolver-preview`)
- [ ] Test corpus: acceptance 10 SKUs + 17 baklawa batch = minimum
- [ ] 95% metric definition (unambiguous first-match only)
- [ ] Explicit **no** edge function / webhook in Phase 2A

---

## References

| Document | Path |
|----------|------|
| Resolver prototype audit | `docs/PRODUCT_RESOLVER_PROTOTYPE_AUDIT.md` |
| WhatsApp blueprint | `docs/PRODUCT_INTELLIGENCE_TO_WHATSAPP_BLUEPRINT.md` |
| Capability audit | `docs/PRODUCT_INTELLIGENCE_CAPABILITY_AUDIT.md` |
| Catalogue architecture baseline | `docs/catalogue-pilot-closeout/ARCHITECTURE_BASELINE.md` |
| Resolver source | `src/features/productResolver/` |
| Search (frozen) | `src/lib/productSearch.ts` |
| Alias adapter (read path) | `src/lib/aliasSchemaAdapter.ts` |

---

*End of investigation report. Awaiting architecture approval before any code changes.*
