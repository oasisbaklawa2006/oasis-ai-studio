# Phase 2A — Product Intelligence Runtime (Resolver Only)

**Status:** Implemented  
**Baseline:** Catalogue Pilot v1.0 (frozen)  
**Scope:** Identify-only resolver + admin preview sandbox  
**Date:** 2026-06-22

---

## Architecture

```
Customer utterance
       │
       ▼
normalizeUtterance()     ← Hinglish fillers, pack qty, phrase synonyms
       │
       ▼
buildCatalogLexicon()    ← products + aliases (read-only)
       │
       ▼
scoreEntryTerms()        ← token overlap + intent boosts
       │
       ▼
pickExactAliasWinner()   ← exact alias precedence (when not ambiguous)
       │
       ▼
confidenceBands.ts       ← HIGH / MEDIUM / LOW + action mapping
       │
       ▼
ProductUtteranceResolution
```

### Module layout

| File | Role |
|------|------|
| `src/features/productIntelligence/runtime/types.ts` | Types, thresholds (0.72 / 0.85 / 0.08 delta) |
| `src/features/productIntelligence/runtime/synonymMap.ts` | Static Oasis/Hinglish token + phrase synonyms |
| `src/features/productIntelligence/runtime/normalizeUtterance.ts` | Filler strip, pack qty extraction, phrase expansion |
| `src/features/productIntelligence/runtime/scoring.ts` | Token overlap, Levenshtein tolerance, intent boosts |
| `src/features/productIntelligence/runtime/catalogLexicon.ts` | Loader v2 + in-memory lexicon builder |
| `src/features/productIntelligence/runtime/confidenceBands.ts` | Band assignment and action rules |
| `src/features/productIntelligence/runtime/resolveProductUtterance.ts` | Main resolver |
| `src/features/productIntelligence/runtime/fixtures/phase2aCatalog.ts` | Test corpus (17 baklawa + 10 acceptance) |
| `src/pages/ResolverPreview.tsx` | Admin sandbox at `/admin/resolver-preview` |

### Loader v2

`loadRuntimeCatalog()` reads live catalogue (read-only):

- `products.name`, `product_name`, `short_name`, `sku`, `category`, `subcategory`
- `product_aliases` via `aliasSchemaAdapter` (legacy `alias_text` + migration schema)

No catalogue schema changes. No DB migration.

---

## Confidence model

| Band | Condition | Action |
|------|-----------|--------|
| **HIGH** | confidence ≥ 0.85 and not ambiguous | `auto_suggest` |
| **MEDIUM** | 0.72 ≤ confidence < 0.85 and not ambiguous | `operator_review` |
| **LOW** | confidence < 0.72 **or** ambiguous (top-2 delta < 0.08) | `ask_clarification` |

### Ambiguity rules

1. **Generic delta:** top two candidates within 0.08 → LOW / clarification
2. **Midya alone:** bulk + gift pack both exist → LOW (even if bulk alias matches)
3. **Nut + asiyah generic:** e.g. `cashew assiyah`, `pistachio asiyah` (no qualifier) → LOW
4. **Exact alias override:** utterance matches a catalogue alias exactly → resolve to that product (unless midya rule applies)

### Synonym map (static)

Approved additive config includes: `pista↔pistachio`, `kaju↔cashew`, `midya/midea/mediya`, `assiyah/asiyah`, `kunafa/kunefe`, `baklava↔baklawa`, `channa/chana`, `mithai↔sweet`, phrase rules for `dates pista`, `channa badam`, `kunafa cheese`, etc.

---

## Sample resolver outputs

Fixture corpus (`phase2aCatalog.ts`):

```json
{"query":"pista bulbul","resolved_sku":"OAS-AS-BKL-PST-BULK-0017","confidence_band":"HIGH","action":"auto_suggest"}
{"query":"kaju tart","resolved_sku":"OAS-AS-BKL-CSH-BULK-0004","confidence_band":"HIGH","action":"auto_suggest"}
{"query":"kunafa cheese","resolved_sku":"OAS-FR-KNF-KNF-MAAPET-0002","confidence_band":"HIGH","action":"auto_suggest"}
{"query":"frozen kunafa","resolved_sku":"OAS-FR-KNF-KNF-MAAPET-0002","confidence_band":"HIGH","action":"auto_suggest"}
{"query":"midya","resolved_sku":null,"confidence_band":"LOW","action":"ask_clarification","alternatives":["OAS-AS-BKL-PST-BULK-0016","OAS-AS-BKL-PST-MAAPET-0003"]}
{"query":"6 pc midya","resolved_sku":"OAS-AS-BKL-PST-MAAPET-0003","confidence_band":"HIGH","action":"auto_suggest"}
{"query":"dates pista","resolved_sku":"OAS-CH-DAT-PST-LOOSE-0002","confidence_band":"HIGH","action":"auto_suggest"}
{"query":"channa badam","resolved_sku":"OAS-FS-FUS-ASS-BULK-0002","confidence_band":"HIGH","action":"auto_suggest"}
{"query":"assiyah pista","resolved_sku":"OAS-AS-BKL-PST-BULK-0015","confidence_band":"HIGH","action":"auto_suggest"}
{"query":"OAS-AS-BKL-CSH-BULK-0004","resolved_sku":"OAS-AS-BKL-CSH-BULK-0004","confidence_band":"HIGH","action":"auto_suggest"}
```

---

## Test results

### Phase 2A corpus (`phase2aResolver.test.ts`)

| Metric | Result |
|--------|--------|
| Required utterance cases | 10/10 PASS |
| Baklawa range cases | 8/8 PASS |
| Unambiguous first-match rate | **100%** (15/15, target ≥95%) |
| Ambiguous cases never auto-suggest | **PASS** (midya, cashew/pistachio asiyah) |
| Normalize + confidence band unit tests | PASS |

### Full suite

```
npm test        → 221 passed (39 files)
npm run typecheck → PASS
npm run build   → PASS
```

---

## Admin preview

Route: `/admin/resolver-preview` (RoleGate: `testing`)

- Text input + Resolve button
- Top match, confidence band, action, reason
- Alternatives table (SKU, product, matched term, source, confidence)
- **Read-only** — no writes, no ordering, no WhatsApp

---

## Limitations

1. **Fixture vs live parity:** Tests use `phase2aCatalog.ts` fixture; live catalogue alias coverage may differ until aliases are fully populated in production.
2. **Token overlap heuristic:** Not ML-based; edge cases with novel spellings may need new synonyms or aliases.
3. **Batch001 vs acceptance overlap:** `kaju tart` / `tart kaju` disambiguation relies on exact alias precedence; new overlapping products require alias discipline.
4. **No learning loop:** Synonym map is static config; changes require code deploy (approved for Phase 2A).
5. **English/Hinglish only:** No Arabic script normalization in this phase.

---

## Explicit exclusions (unchanged)

- No edge function, webhook, order creation, ERP, inventory
- No catalogue schema migration
- No `product_language_terms` deployment
- No WhatsApp runtime send/receive

---

## Next phase boundaries (2B+)

| In scope later | Out of scope for 2A |
|----------------|---------------------|
| WhatsApp ingress + operator review UI | ✓ deferred |
| Order draft creation from resolved SKU | ✓ deferred |
| `product_language_terms` DB table | ✓ deferred |
| Confidence tuning from production telemetry | ✓ deferred |
| ERP / inventory coupling | ✓ deferred |

---

## GO / NO-GO

**GO** for Phase 2A resolver preview sandbox.

Criteria met:

- [x] Resolver runtime under `src/features/productIntelligence/runtime/`
- [x] Read-only catalogue loader v2 with alias schema adapter
- [x] Confidence bands and action rules per approved spec
- [x] Static synonym map (no DB migration)
- [x] Admin preview at `/admin/resolver-preview`
- [x] Test corpus ≥95% unambiguous first-match
- [x] Ambiguous cases include correct alternatives, no wrong auto-suggest
- [x] No catalogue authoring architecture changes
- [x] `npm test`, `typecheck`, `build` pass
