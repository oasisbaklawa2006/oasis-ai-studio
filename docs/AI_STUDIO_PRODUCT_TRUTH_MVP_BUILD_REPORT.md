# AI Studio Product Truth MVP — build report

**Repo:** `oasisbaklawa2006/oasis-ai-studio`  
**Branch:** `cursor/ai-studio-product-truth-mvp`  
**Base:** `main` (includes PR #19 security/compliance baseline)

## Summary

Internal Product Truth MVP foundation: readiness governance, UOM/packaging engine, channel/pricing/MOQ validation, admin panels on Product Edit, and tests. **Oasis Central not touched.**

## Files changed

| Area | Paths |
|------|--------|
| Engines | `src/features/productTruth/types.ts`, `uomPackagingEngine.ts`, `channelPricingMoqEngine.ts`, `productReadiness.ts` |
| UI | `src/features/productTruth/ProductTruthAdminSection.tsx`, `panels/*` |
| Product Edit | `src/pages/ProductEdit.tsx` — **Product Truth** tab (saved products) |
| Migration (additive, not run) | `supabase/migrations/20260602120000_product_truth_snapshot_additive.sql` |
| Tests | `src/features/productTruth/*.test.ts` (14 new tests) |
| Docs | This report |

## Migration

**Yes — additive only:** optional `products.product_truth_snapshot jsonb`.  
**Not executed** in this prompt. App computes readiness client-side from existing form + channel data.

## Readiness model

Eight dimensions: `content_status`, `media_status`, `pricing_status`, `uom_status`, `packaging_status`, `compliance_status`, `production_mapping_status`, `central_sync_status`.

Badges: `draft`, `ai_generated`, `human_edited`, `pending_approval`, `approved`, `rejected`, `locked`, `published`, `legacy_incomplete`.

**Central sync blocked** when compliance, pricing, UOM, packaging, media, or production mapping incomplete. Legacy products show `legacy_incomplete` without breaking load.

## UOM / packaging model

- Base conversions: pcs ↔ kg, kg ↔ tray, tray ↔ master carton
- APIs: `convertOrderedQtyToBaseQty`, `calculateReadyGoodsPickQty`, `calculateProductionDemandQty`, `calculateDispatchPackagingQty`, `validateConversionRule`, `applyRoundingRule`
- Partial pack/carton + tolerance % supported on hierarchy type

## Channel / pricing / MOQ

Channels: retail, b2b, horeca, wholesale, franchise, export, corporate, wedding, internal.

APIs: `validateOrderQtyAgainstChannelRules`, `validateMOQ`, `validateIncrement`, `getChannelPrice`, `getInvalidQtyMessage`, `priceBlocksPublish`, `isPriceEffective`.

Pricing records support MRP, selling price, status, effective dates, approver metadata (types; full CRUD remains on existing Channels components).

## UI panels

Product Edit → **Product Truth** tab (sub-tabs):

1. Readiness — score, blockers, next action, dimension badges  
2. UOM — conversion summary + examples  
3. Packaging — hierarchy summary  
4. Channels — matrix vs `PRODUCT_TRUTH_CHANNELS`  
5. Preview — qty/UOM/channel calculator  

## Tests run

```text
npm run typecheck — pass
npm run build      — pass
npm run test       — pass (22 tests)
```

Covers: incomplete/complete readiness, compliance blocks sync, pcs↔kg, tray, master carton rounding, B2B 10 kg invalid / 16 kg valid, retail 1 pc, pending/expired price.

## Known gaps

- Channel prices/MOQ not yet wired live from DB into Product Truth tab (empty until Channels tab data passed in future hook)
- `product_truth_snapshot` column not synced to DB from UI yet
- Edge function deploy unchanged
- No operational orders / Central connector logic

## PR

_(updated after create)_

## Merge recommendation

**Approve merge** after quick UI smoke on Product Edit → Product Truth for an existing SKU. No production DB migration required for MVP behavior.
