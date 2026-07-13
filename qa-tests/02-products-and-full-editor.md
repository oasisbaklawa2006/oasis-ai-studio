# QA Test 02 - Products And Full Editor

## Objective

Verify product search, listing, product switching, and Full Product Editor rendering.

## Steps

1. Open `/products`.
2. Search each `AUTO-` SKU from `scenarios.md`.
3. Confirm each product appears exactly once.
4. Open each product.
5. Verify Identity, Product Truth, SKU, packaging, pricing, MOQ, media, label, ingredients/nutrition, and BOM sections render.
6. Switch between products and confirm no stale product data remains.
7. Refresh on a product detail route and confirm the same product reloads.
8. Use browser Back/Forward and confirm product state remains correct.

## Failures

- duplicate or missing search results
- stale data after switching
- broken tabs
- save buttons enabled without clear state
- missing readiness explanation
- failed network requests not surfaced to user
