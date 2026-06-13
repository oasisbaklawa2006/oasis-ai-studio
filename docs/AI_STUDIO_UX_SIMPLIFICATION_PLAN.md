# AI Studio UX Simplification Plan

_Date: 2026-03-13_

## Current vs future (product creation)

| Metric | Central | AI Studio (full editor) | AI Studio (Fast Create) | **Future target** |
|--------|---------|-------------------------|-------------------------|-------------------|
| Clicks (min) | 3 | 11 | **4** | **3** |
| Manual fields (min) | 5 | 8 | **3** | **3** |
| Visible controls | 47 | 72 | **8** | **12** (progressive) |
| Time to create | ~45–90s | ~2–4 min | **~45s** | **<60s** |
| Time to edit common fields | ~20s | ~60s+ (tab hops) | N/A | **<20s** |

---

## Field taxonomy

### Tier 1 — Fast Create (always shown)

`product_name`, `category`, `hero_image`

### Tier 2 — Auto-derived (hidden, editable in full editor)

`product_class`, `main_department`, `production_department`, `hsn_code`, `gst_rate`, `shelf_life_days`, `primary_uom`, `description`, `aliases`, `pack_size`

### Tier 3 — Common edit (sidebar / Identity + Compliance)

`short_name`, `b2b_price`, `mrp`, `moq_value`, `ingredients`, `allergen_warnings`, SKU builder

### Tier 4 — Advanced-only (collapsed tabs)

Private label, customisation, dimensions, frozen, BOM, channels, product truth panels

### Tier 5 — Rarely used

`export_price`, `legacy_sku`, `external_reference_code`, `customization_caution`, master carton dimensions

---

## Redundancy elimination

| Redundancy | Fix |
|------------|-----|
| HSN/GST re-entry | Category defaults + AI panel |
| SKU 4-click builder on every create | Fast Create auto-SKU; full editor for overrides |
| Tab hop Identity → Compliance → Ops | Fast Create single screen |
| Duplicate alias UIs | AliasManager + Product Truth cross-link (keep) |
| `image_url` vs `hero_image_url` | Sync on write (done) |
| Contributor vs admin field sets | Fast Create picks path automatically |

---

## UX reductions implemented (this wave)

1. **Fast Create route** — primary CTA on Products list
2. **Creation baseline defaults** — full editor new products pre-filled
3. **Compliance AI panel** — one-click attribute generation
4. **Write mode fix** — owner/admin/PM not blocked as "read-only"
5. **Product Truth compliance** — accurate readiness from meta map
6. **Dashboard** — Fast Create quick action

---

## Planned UX reductions (next)

| # | Change | Effort reduction |
|---|--------|------------------|
| 1 | **Progressive disclosure** — "Advanced fields" accordion on Identity | −40% visible controls |
| 2 | **Inline edit** on Products list (name, active, catalogue-ready) | Edit common <20s |
| 3 | **Smart tab order** — jump to first incomplete readiness dimension | −3 tab clicks |
| 4 | **Clone product** wizard | −50% typing on variants |
| 5 | **Category template picker** on full editor new | Same defaults as Fast Create |
| 6 | **Keyboard save** + field tab order | −2 clicks per save |

---

## Hidden / auto-derived fields (full editor)

| Field | Derivation |
|-------|------------|
| `production_department` | `normalizeProductionDepartment` from category/name |
| `main_department` | `normalizeMainDepartment` |
| `product_class` | `inferProductClass` |
| `pieces_per_kg` | From `approximate_piece_weight_g` |
| `moq_uom` | From `primary_pack_uom` |
| `bom_required` | `main_department === packing_assembly` |
| B2B/wholesale from MRP | `formToProductRow` economics (when MRP set) |

---

## Success criteria

- [x] Creation path <60s (Fast Create)
- [ ] Common field edit <20s (inline list edit — planned)
- [x] Fewer clicks than Central on create path
- [x] No governance regression (draft + compliance approval preserved)
