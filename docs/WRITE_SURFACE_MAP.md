# Write Surface Map

| File path | Write target | Operation type | Master table or draft candidate | Recommended future service name |
|---|---|---|---|---|
| `src/pages/ProductEdit.tsx` | `products` | insert, update | master | `productService` |
| `src/pages/Media.tsx` | `product-media` storage bucket, `product_media` | upload, insert | master | `mediaService` |
| `src/pages/Ingredients.tsx` | `ingredients`, `product_ingredients`, `nutrition_panels` | insert, delete, upsert | master | `ingredientService` |
| `src/pages/Labels.tsx` | `labels`, `products` | upsert, update | draft candidate (`labels`), master (`products`) | `labelService` |
| `src/pages/LabelQueue.tsx` | `labels`, `products` | upsert, update | draft candidate (`labels`), master (`products`) | `labelQueueService` |
| `src/pages/Catalogues.tsx` | `catalogues` | insert | master | `catalogueService` |
| `src/pages/CatalogueDetail.tsx` | `catalogues`, `catalogue_products` | update, insert, delete | master | `catalogueService` |
| `src/pages/Hampers.tsx` | `hampers`, `hamper_items` | insert, delete | master | `hamperService` |
| `src/pages/Tags.tsx` | `tags` | insert, delete | master | `tagService` |
| `src/pages/Settings.tsx` | `product_media`, `products`, `feature_activation_audit`, `feature_flags` | update, insert | master | `settingsService` |
| `src/pages/DataCorrection.tsx` | `products` | update | master | `dataCorrectionService` |
| `src/pages/Testing.tsx` | `product-media` storage bucket | upload | master | `testingMediaService` |
| `src/components/ProductMediaUploader.tsx` | `product-media` storage bucket, `product_media`, `products` | upload, insert, update, delete | master | `productMediaService` |
| `src/components/AliasManager.tsx` | `product_aliases` | upsert, update, delete | master | `aliasService` |
| `src/components/BomBuilder.tsx` | `product_bom_items` | insert, update, delete | master | `bomService` |
| `src/components/ChannelPricingRules.tsx` | `product_pricing_rules` | insert, update, delete, upsert | draft candidate | `pricingRuleService` |
| `src/components/ChannelMoqRules.tsx` | `product_moq_rules` | insert, update, delete, upsert | draft candidate | `moqRuleService` |
| `supabase/functions/test-integration/index.ts` | `integration_settings`, `feature_flags`, `feature_activation_audit` | update, insert | master | `integrationTestService` |

## Import inventory (`@/integrations/supabase/client`)
Current imports were found in 29 places across pages, components, hooks, libs, auth context, and legacy bridge.
They continue to work through a compatibility shim in `src/integrations/supabase/client.ts`.
