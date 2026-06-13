# Pricing Authority and Upsert Fix

_Date: 2026-03-13 · Sprint: Product Authority Reconciliation + Pricing Ladder_

## Upsert defect

```
duplicate key value violates unique constraint uq_product_pricing_rules_product_channel
```

**Fix:** `ChannelPricingRules.add()` uses `.upsert({ onConflict: "product_id,price_channel" })`.

User message: *"Pricing for this channel already exists. Updating existing row."*

## Governed pricing ladder

Module: `src/features/productTruth/pricingLadder.ts`

| Channel | When blank |
|---------|------------|
| MRP | Required anchor (manual or missing) |
| Retail | Inherits MRP |
| Bulk | Derived: MRP −20% |
| Wholesale | Derived: MRP −30% |
| HoReCa | Inherits **Wholesale** (not B2B) |
| **B2B** | **Manual only — required** |
| Export | Inherits B2B |
| Franchisee | Inherits B2B |
| Own Outlet | Inherits B2B |
| Special | Inherits B2B |
| Costing | Internal only — excluded from Product Truth |

Manual DB values always win. Derived values are display-only — never written back.

## Unit conversion

Module: `src/features/productTruth/priceUnitConversion.ts`

- Uses `grams_per_piece` / `pcs_per_kg` from packaging authority
- `pcs_per_kg = 1000 / grams_per_piece` when needed
- Product Truth Channels shows alternate per-piece or per-kg equivalent
- Missing conversion data → **"Conversion unavailable"** (not 0)

## Product Truth Channels panel

Shows per ladder channel:
- Manual price (if set in `product_pricing_rules`)
- Effective price (manual or derived/inherited)
- Source: `manual` / `derived` / `inherited` / `missing`
- Unit basis from rule `uom` (default kg)
- MOQ from `product_moq_rules`

## Readiness

`evalPricing` blocks until **approved B2B** is present. Message: *"B2B price is required before product can be approved."*

## Tests

- `pricingLadder.test.ts`
- `priceUnitConversion.test.ts`
- `pricingUpsert.test.ts`
- `productTruthReconciliation.test.ts`
