#!/usr/bin/env bash
set -euo pipefail

page="src/pages/ProductEdit.tsx"
service="src/features/productAuthority/atomicProductAggregateSave.ts"

rg -q "saveProductAggregateAtomic" "$page"
rg -q 'client\.rpc\("save_product_aggregate_v1"' "$service"
rg -q "expectedUpdatedAt" "$page"
rg -q "expectedAggregateRevision" "$page"
rg -q "_expected_aggregate_revision" "$service"
rg -q "aggregate_revision" "$service"
rg -q "refreshAggregateRevision" "$page"
rg -q "createProductDraftEnvelope" "$page"
rg -q "draftIdempotencyKeyRef\.current = createProductDraftIdempotencyKey" "$page"

if rg -q '\.from\("products"\)\.(insert|update)' "$page"; then
  echo "ProductEdit must not fall back to a non-atomic direct product write" >&2
  exit 1
fi

if rg -q "syncChannelPricingFromForm\(" "$page"; then
  echo "ProductEdit must not perform a post-product pricing write" >&2
  exit 1
fi

echo "Full Editor atomic-save client contract: PASS"
