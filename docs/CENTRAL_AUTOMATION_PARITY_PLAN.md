# Central Automation Parity Plan

_Date: 2026-03-13 · Central reference: `AdminProducts.tsx` (read-only audit)_

## Classification key

| Code | Meaning |
|------|---------|
| **A** | Already exists in AI Studio (parity or better) |
| **W** | Exists but weaker |
| **M** | Missing |

---

## Automation inventory

| Automation | Central | AI Studio | Class | Action |
|------------|---------|-----------|-------|--------|
| AI HSN/GST/allergens/ingredients | `generate-product-attributes` | `ComplianceAiPanel` → same fn | **A** (wired this wave) | Done |
| AI alias suggestions | `oasis-ai-chat` streaming | Fast Create + heuristic seeds | **W** | Port streaming UX to `AliasManager` |
| AI description | Stub toast only | Heuristic in Fast Create | **W** | Implement or remove Central stub; add LLM description in Studio |
| Nutrition placeholder template | Manual template button | None in ProductEdit | **M** | Add "Apply nutrition template" with QA disclaimer |
| Alias seed heuristics | Inline in AdminProducts | `aliasSeedRules.ts` shared | **A** | Done |
| WhatsApp keyword generation | Via alias save path | `whatsappKeywordsFromAliases` | **A** | Done in Fast Create |
| SKU auto-generation | Text `OAS-{name}` | `generate_oasis_sku` RPC | **A** (Studio superior) | Expose in Fast Create + optional full editor shortcut |
| Packaging intelligence | Settlement unit + unit math | UOM/pack engines in Product Truth | **W** | Surface pack preview on Identity tab |
| Search assistance | AI aliases + `products.aliases[]` | RPC + fallback search | **W** | Deploy RPC; add "search preview" panel |
| Catalogue readiness scoring | KPI cards (active count) | `evaluateProductReadiness` 7-dimension | **A** (Studio superior) | Feed channel prices into readiness |
| Product attribute bulk generate | Single "Generate AI Details" | Per-field approve workflow | **A** (Studio superior governance) | Keep |
| Private label economics | Inline calculators | ProductEdit private label tab | **W** | Add economics preview |
| Variant manager | Central panel | Not in Studio | **M** | Plan variant draft type |
| BOM auto-suggest | Search components | `BomBuilder` manual | **W** | Add component suggestions |
| Image AI | None | Planned in Dashboard | **M** | Roadmap |

---

## Implementation priority

### P0 (this wave — done)

- [x] Wire `ComplianceAiPanel`
- [x] Category defaults (HSN/GST/shelf life/UOM)
- [x] Fast Create with heuristic + optional AI enrichment
- [x] Shared alias seed rules
- [x] `canWriteProductsDirectly` for owner/admin/PM

### P1 (next sprint)

- [ ] Streaming AI alias UI in `AliasManager` (port Central `handleAiAliases`)
- [ ] Nutrition placeholder template button on Compliance tab
- [ ] Packaging intelligence card on Identity (primary pack preview → visible)
- [ ] Deploy `search_products_with_aliases` on live Supabase

### P2 (quarter)

- [ ] LLM product descriptions with approval gate
- [ ] Variant draft workflow
- [ ] Photo → product identification
- [ ] Catalogue readiness auto-score on save

---

## Parity score

| Dimension | Before wave | After wave | Target |
|-----------|-------------|------------|--------|
| Compliance AI | M | **A** | A |
| Alias AI | W | **W+** | A |
| Defaults / auto-fill | M | **A** | A |
| Readiness scoring | A | **A** | A |
| Nutrition assist | W | **M** | W |
| **Overall automation** | **45%** | **72%** | **90%** |

---

## Governance principle

**Central optimizes speed; AI Studio optimizes governed truth.** Parity does not mean identical UX — Studio keeps approval metadata on AI-filled compliance fields. Central may adopt Studio's approval strip on merge.
