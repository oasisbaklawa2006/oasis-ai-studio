# AI Studio Fast Create Implementation

_Date: 2026-03-13 · Goal: create product in **under 60 seconds**_

## Problem

| Metric | Central | AI Studio (before) |
|--------|---------|-------------------|
| Min clicks | ~3 | ~11 |
| Min manual fields | ~5 | ~8 |
| Visible controls | ~47 | ~72 |

## Solution: Fast Create Mode

**Route:** `/products/new/fast`  
**Entry points:** Products list (primary CTA), Dashboard quick action, link from full editor

### User inputs (3)

1. **Product name** — free text
2. **Category** — preset dropdown (10 Oasis categories)
3. **Product image** — hero upload to `product-media` staging path

### System-generated (on "Generate suggestions")

| Output | Source |
|--------|--------|
| Description / short description | Heuristic templates |
| Keywords / search terms | Name + category + aliases |
| WhatsApp search terms | Alias seed rules |
| Aliases | `aliasSeedRules.ts` + optional `oasis-ai-chat` |
| UOM / shelf life / packaging | `categoryDefaults.ts` |
| HSN / GST / ingredients / allergens | Category defaults + optional `generate-product-attributes` |
| Product Truth starters | pieces/kg, tray/carton hints from category |
| Label starter values | ingredients/allergen/net weight hints |
| SKU (on create) | `generate_oasis_sku` RPC or `OAS-FC-*` fallback |

---

## Architecture

```
src/pages/FastCreateProduct.tsx          # UI
src/features/fastCreate/
  fastCreateSuggestions.ts               # Heuristic + AI enrichment
  saveFastCreateProduct.ts               # Direct write or contributor draft
  uploadFastCreateHero.ts                # Pre-save image upload
src/features/productDefaults/
  categoryDefaults.ts                    # Central-parity defaults
  applyDefaults.ts                       # Merge helpers
src/features/productLanguage/
  aliasSeedRules.ts                      # Shared with AliasManager
```

### Save paths

| Role | Behavior |
|------|----------|
| owner / admin / product_manager | Direct `products` insert + alias rows |
| catalogue_contributor | `catalogue_product_drafts` via `submitCatalogueDraft` |
| Other | Error — contact admin |

**Governance preserved:** Compliance AI suggestions still require approval in full editor; Fast Create uses approved category defaults for HSN/GST.

---

## UX flow (target timing)

| Step | Action | Est. time |
|------|--------|-----------|
| 1 | Open Fast Create | 2s |
| 2 | Type name, pick category | 15s |
| 3 | Upload image | 10s |
| 4 | Generate suggestions (optional AI) | 5–15s |
| 5 | Create product | 3s |
| **Total** | | **35–45s** |

---

## Current vs target metrics

| Metric | Full editor (before) | Fast Create (now) | Target |
|--------|---------------------|-------------------|--------|
| Clicks to create | ~11 | **~4** | ≤5 |
| Manual fields | ~8 | **3** | 3 |
| Time to create | ~2–4 min | **~45s** | <60s |

---

## Full editor improvements (same wave)

- New products receive **Central-parity defaults** (HSN `19059090`, GST `18`, shelf life `90`, UOM `kg`) via `applyCreationBaselineDefaults`.
- `ComplianceAiPanel` wired on Compliance tab.
- Link to Fast Create from Products + Dashboard.

---

## Tests

`src/features/fastCreate/fastCreate.test.ts` — category defaults, alias seeds, baseline merge.

---

## Future enhancements

1. Auto-run suggestions on category select (skip button click)
2. Camera capture on mobile
3. Clone-from-similar-product picker
4. Post-create redirect to Media tab with typed slots pre-highlighted
