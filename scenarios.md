# Oasis AI Studio Autonoma Scenarios

## Scenario: standard

Purpose: create a small disposable product-master dataset and then audit Oasis AI Studio around it.

The `standard` recipe creates five product records only, because the current Autonoma SDK implementation registers only the `products` factory. These records intentionally cover ready, partial, and blocked catalogue states.

### Created Products

| Alias | Product | SKU | Expected State |
|---|---|---|---|
| `prd_classic_pistachio_baklawa` | Classic Pistachio Baklawa | `AUTO-BAK-PIS-001` | Catalogue-ready product |
| `prd_medjool_stuffed_dates` | Medjool Stuffed Dates | `AUTO-DAT-MED-002` | Catalogue-ready gifting product |
| `prd_rose_almond_dragees` | Rose Almond Dragees | `AUTO-DRG-ALM-003` | Missing media |
| `prd_luxury_ramadan_hamper` | Luxury Ramadan Hamper | `AUTO-HAM-RAM-004` | Hamper, partial media, label review |
| `prd_honey_almond_cookie_bar` | Honey Almond Cookie Bar | `AUTO-CKB-HAC-005` | Label review required |

### Required Tests After Factory Up

1. Authenticate using the provided test credentials.
2. Open `/products` and search each `AUTO-` SKU.
3. Confirm the product list shows correct product names, categories, readiness/media/label state where visible.
4. Open each `/products/:id` detail page.
5. Confirm Full Editor tabs render without blank screens.
6. Confirm pricing, MOQ, packaging, label, media, Product Truth, and catalogue-readiness sections do not show stale data from another product.
7. Open `/admin/catalogue-product-studio`.
8. Select at least two Autonoma-created products and verify product switching does not leak stale content.
9. Confirm missing-field actions/deep links point to the correct product editor section.
10. Capture desktop `1440x900` and mobile `390x844` evidence.

### Non-Factory Read-Only Scenarios

The following are defined in `qa-tests/` and must be run without mutation unless additional factories are implemented:

- authentication and route protection
- dashboard and navigation
- Catalogue Product AI Studio
- Full Product Editor rendering
- Catalogue Builder and public catalogue links
- media presentation
- label and ingredients presentation
- approvals and audit visibility
- settings/feature flags visibility
- mobile usability
- console and network failures
