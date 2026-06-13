# Packaging Truth Reconciliation

_Date: 2026-03-13 · Sprint: Product Authority Reconciliation_

## Defect

| Surface | Value shown |
|---------|-------------|
| Product Edit UOM tab | MOQ = **9 trays** |
| Product Truth Packaging | Trays/master carton = **8** |

## Root cause

1. **Wrong field mapped:** Product Truth displayed `master_carton_qty` as "Trays / master carton" but user set **MOQ** (`moq_value` + `moq_uom`), not master carton hierarchy.
2. **Hardcoded fallback:** `productTruthInputFromForm` defaulted `traysPerMasterCarton` to **8** when `master_carton_qty` was empty.
3. **Display fallback:** `PackagingHierarchyPanel` rendered `?? 8`.
4. **Conversion engine:** `uomPackagingEngine` used `?? 8` and `?? 1` for tray/master carton math.

## Fix

| Change | File |
|--------|------|
| `packagingHierarchyFromForm()` — no inferred defaults | `packagingTruth.ts` |
| `productMoqFromForm()` — separate MOQ display | `packagingTruth.ts` |
| Packaging panel shows MOQ + master carton separately | `PackagingHierarchyPanel.tsx` |
| Missing values → **"Not configured"** | `formatPackagingValue()` |
| Removed `?? 8` / `?? 40` from truth input | `productReadiness.ts` |
| Conversion returns `null` when hierarchy incomplete | `uomPackagingEngine.ts` |

## Authoritative sources

| Concept | Product Edit field | DB column |
|---------|-------------------|-----------|
| Order MOQ | `moq_value`, `moq_uom` | `products.moq_value`, `moq_uom` |
| Master carton qty | `master_carton_qty` | `products.master_carton_qty` |
| Piece weight | `approximate_piece_weight_g` | `products.grams_per_piece` (live) |
| Pcs per kg | `pieces_per_kg` | `products.pcs_per_kg` (live) |

## Validation

`productTruthAuthority.test.ts` — MOQ 9 trays with empty master carton does not show 8.

`productTruthReconciliation.test.ts` — MOQ and master carton match after simulated reload.
