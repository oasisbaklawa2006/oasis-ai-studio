# Pricing Upsert Fix

_Date: 2026-03-13 · Sprint: Product Authority Reconciliation_

## Defect

```
duplicate key value violates unique constraint uq_product_pricing_rules_product_channel
```

Editing or re-adding channel pricing attempted **INSERT** when a row already existed for `(product_id, price_channel)`.

## Root cause

`ChannelPricingRules.add()` used `.insert()` only. MOQ rules already used `.upsert({ onConflict: ... })` — pricing did not.

## Fix

```ts
await supabase
  .from("product_pricing_rules")
  .upsert({ product_id, price_channel: "retail", ... }, { onConflict: "product_id,price_channel" })
  .select("*")
  .single();
```

| Rule | Behavior |
|------|----------|
| Row exists for product+channel | **UPDATE** |
| Row missing | **INSERT** |

## Tests

- `pricingUpsert.test.ts` — verifies upsert + onConflict in `ChannelPricingRules`
- `productTruthReconciliation.test.ts` — channel prices survive reload via mapper

## Related: Product Truth channels blank

Separate defect — Product Truth did not load `product_pricing_rules`. Fixed by wiring `loadChannelAuthority()` in `ProductEdit.tsx` and `channelAuthorityMappers.ts`.
