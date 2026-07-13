# QA Test 03 - Catalogue Product AI Studio

## Objective

Verify the Catalogue Product AI Studio as a governed content workspace.

## Steps

1. Open `/admin/catalogue-product-studio`.
2. Select `Classic Pistachio Baklawa`.
3. Verify product identity, SKU, category, packaging, pricing, media and readiness display.
4. Select `Rose Almond Dragees`.
5. Verify missing media is truthfully shown.
6. Select `Luxury Ramadan Hamper`.
7. Verify hamper/label/media partial states are not misrepresented as complete.
8. Test deep links to Full Product Editor without saving changes.
9. Use browser Back/Forward and confirm selected product restoration.
10. Verify draft/version/audit presentation where visible.
11. Do not run AI generation if it consumes credits or persists output unless staging explicitly allows it.

## Failures

- stale product data
- fake AI availability
- deep links point to wrong product or tab
- generated text overwrites manual edits without warning
- media slots show unavailable media as present
