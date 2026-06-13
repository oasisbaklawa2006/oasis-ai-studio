# Product Master Feature Parity Matrix

_Comparison: **Oasis-Baklawa-Central** Product Master vs **oasis-ai-studio** ProductEdit / Product Truth / Catalogue Builder_  
_Date: 2026-03-28 · Shared Supabase: `tcxvcatsqqertcnycuop`_

## Classification key

| Code | Meaning |
|------|---------|
| **A** | Exists only in Central |
| **B** | Exists only in AI Studio |
| **C** | Exists in both (rough parity) |
| **D** | Exists in both — one implementation is clearly superior |

**Recommendation verbs:** Keep Central · Keep AI Studio · Merge · Remove

---

## Executive summary

| System | Role today | Strength | Weakness |
|--------|------------|----------|----------|
| **Central** | Operational PIM + buyer catalogue + orders/resolver | Live product saves, buyer-facing catalogue, dual resolver prototypes, AI alias suggestions | Monolithic editor, no product draft approval, dual alias stores, single hero image, `product-images` bucket missing |
| **AI Studio** | Catalogue authority + draft governance + Product Truth | Rich ProductEdit model, approval inbox (7 types), readiness engine, media taxonomy, Category 1 import | Compliance AI unwired, dual catalogue systems, resolver not in UI, collections migration not applied |

**Strategic direction:** One **Catalogue Authority Plane** (AI Studio) for governed master-data authoring + one **Operational Plane** (Central) for activation, buyer catalogue, and commerce — with a single `products` row contract and shared storage bucket naming.

---

## Feature parity matrix

### 1. Product creation

| | |
|--|--|
| **Class** | **D** — AI Studio superior for governance |
| **Central** | `AdminProducts.tsx` — create panel, auto-SKU `OAS-{name}-{grams}`, immediate insert to `products` |
| **AI Studio** | `ProductEdit.tsx` `/products/new` — contributor → `catalogue_product_drafts`; admin → direct insert |
| **Superior** | **AI Studio** — draft boundary before master write |
| **Why** | Central has no create approval; AI Studio separates contributor intake from master |
| **Recommendation** | **Merge** — Central create should route through draft or shared create API; keep AI Studio draft path as canonical for non-admin |

---

### 2. Product editing (core form)

| | |
|--|--|
| **Class** | **D** — complementary; AI Studio richer catalogue model |
| **Central** | Single slide-out panel, 6 sections, URL `?productId=`, dirty guard, family-aware (`product_family`) |
| **AI Studio** | Tabbed `ProductEdit`: Identity, UOM/MOQ, Media, BOM, Channels, Compliance, Ops, Product Truth |
| **Superior** | **AI Studio** for catalogue/UOM/packaging depth; **Central** for operational unit math + variant manager |
| **Why** | AI Studio models primary pack hierarchy, channel rules, contributor flags; Central models settlement_unit, variants, live economics |
| **Recommendation** | **Merge** — adopt AI Studio tab model + Central variant/economics sections in one editor |

---

### 3. Media / images

| | |
|--|--|
| **Class** | **D** — AI Studio superior workflow; Central simpler path |
| **Central** | Hero only → `product-images` bucket → `products.image_url`; UI notes future multi-asset schema |
| **AI Studio** | `ProductMediaUploader` — 13 media types, `product_media` table, `product-media` bucket, draft submissions |
| **Superior** | **AI Studio** for taxonomy + approval; **Central** for minimal hero if bucket exists |
| **Why** | AI Studio supports gallery, hero, draft boundary; Central is one URL field |
| **Recommendation** | **Merge** — one bucket (`product-media`), one column pair (`image_url` + `hero_image_url` synced); Central uploads adopt AI Studio path; AI Studio displays Central `image_url` (done in `76984d0`) |

---

### 4. Aliases / product language

| | |
|--|--|
| **Class** | **D** — AI Studio superior structure; Central superior AI suggestions |
| **Central** | `products.aliases[]` on save; `product_aliases` via approval inbox; AI suggestions via `oasis-ai-chat`; generic blocklist |
| **AI Studio** | `AliasManager` — typed terms (search, regional, WhatsApp keyword), direct/draft modes, seed heuristics |
| **Superior** | **AI Studio** for term types + draft; **Central** for LLM suggestion UX |
| **Why** | AI Studio has explicit `whatsapp_keyword` term type; Central splits unapproved `products.aliases` vs approved `product_aliases` |
| **Recommendation** | **Merge** — single write path to `product_aliases` via drafts; port Central AI suggestion UI into AI Studio AliasManager; **Remove** direct `products.aliases[]` writes from Central |

---

### 5. Product resolver (utterance → SKU)

| | |
|--|--|
| **Class** | **A** (production) + **B** (isolated prototype) |
| **Central** | `resolveProductIntelligence.ts`, `fetchProductResolution.ts` (WA-05A), golden tests, operator inbox panel (read-only) |
| **AI Studio** | `productResolver/resolveProductFromCatalog.ts` — tests only, not wired to UI |
| **Superior** | **Central** — only system with production-adjacent resolver code |
| **Why** | Central has two mature scoring paths + WA integration; AI Studio resolver is prototype |
| **Recommendation** | **Merge** — unify on one resolver package (Central WA-05A + PI signals), expose via shared edge function; AI Studio prototype **Remove** after merge |

---

### 6. Nutrition

| | |
|--|--|
| **Class** | **C** — both partial; neither end-to-end |
| **Central** | `nutrition_facts` textarea, placeholder template, QA warning; AI excludes nutrition from auto-fill |
| **AI Studio** | ProductEdit `nutritional_info` textarea; `nutrition_panels` table via Ingredients/Label Studio; Label Queue checks panels |
| **Superior** | **Tie** — Central conservative AI posture; AI Studio structured `nutrition_panels` path exists but split from ProductEdit |
| **Why** | Label readiness needs `nutrition_panels`; ProductEdit edits free text on `products` |
| **Recommendation** | **Merge** — single nutrition editor on ProductEdit writing `nutrition_panels`; Central placeholder policy as default state |

---

### 7. Compliance (HSN, GST, allergens, ingredients)

| | |
|--|--|
| **Class** | **D** — AI Studio superior safety model; Central superior live AI |
| **Central** | Fields on product; `generate-product-attributes` edge fn; active SKU requires HSN+GST |
| **AI Studio** | Compliance tab (manual); `ComplianceAiPanel` built but **unwired**; `stripUnapprovedComplianceFields` on save |
| **Superior** | **AI Studio** for approval metadata + save stripping; **Central** for working attribute generator |
| **Why** | AI Studio prevents unapproved AI GST/HSN reaching master; Central runs real generation today |
| **Recommendation** | **Merge** — wire `ComplianceAiPanel` in AI Studio; call Central/shared `generate-product-attributes`; keep AI Studio approval gates |

---

### 8. Label data (FSSAI, MRP, barcode, print)

| | |
|--|--|
| **Class** | **B** — AI Studio superior for operational label workflow |
| **Central** | `LabelCommandCenter.tsx` — JSON payload preview only; `barcodePayloads.ts`; no print execution |
| **AI Studio** | `Labels.tsx` (Label Studio) + `LabelQueue.tsx` — edit `labels`, ingredients link, status workflow, filters |
| **Superior** | **AI Studio** |
| **Why** | Only AI Studio has editable label records + queue filters (missing_data, ready_for_print) |
| **Recommendation** | **Keep AI Studio** as label authority; **Merge** Central barcode payload builders as export format from Label Studio |

---

### 9. SKU generation

| | |
|--|--|
| **Class** | **D** — AI Studio superior |
| **Central** | `OAS-{name3}-{net_weight_grams}` auto on create; manual override; variant SKUs |
| **AI Studio** | `SkuBuilder` + `generate_oasis_sku` RPC from `sku_code_rules` (division/category/subcategory/packaging codes) |
| **Superior** | **AI Studio** |
| **Why** | Structured code rules match Oasis SKU authority; Central formula ignores packaging hierarchy |
| **Recommendation** | **Keep AI Studio** SKU engine; **Merge** into Central create flow; retire Central auto-formula for new products |

---

### 10. Categories / taxonomy

| | |
|--|--|
| **Class** | **C** — different models |
| **Central** | Hardcoded category list in `AdminProducts`; `product_family` enum (bulk_sweets, retail_pack, goldware, hampers) |
| **AI Studio** | Free-text category/subcategory + `product_class` enum + department routing |
| **Superior** | **Central** for buyer-facing family display; **AI Studio** for flexible authority import |
| **Why** | Central categories align to buyer catalogue filters; AI Studio supports Category 1 CSV mapping |
| **Recommendation** | **Merge** — DB-managed taxonomy table; Central family drives buyer UI; AI Studio maps import columns to taxonomy IDs |

---

### 11. Packaging hierarchy

| | |
|--|--|
| **Class** | **B** — AI Studio only (structured) |
| **Central** | `pack_size`, `carton_type`, `packs_per_master_carton`, `net_weight_grams` — flat fields |
| **AI Studio** | Primary pack type/UOM, qty per pack, content UOM, preview string, carton/master carton; `uomPackagingEngine`, Product Truth packaging panel |
| **Superior** | **AI Studio** |
| **Why** | Engine validates hierarchy; Central lacks primary-pack abstraction |
| **Recommendation** | **Keep AI Studio** packaging model; sync fields to Central-compatible columns on publish |

---

### 12. UOM (unit of measure)

| | |
|--|--|
| **Class** | **D** — AI Studio superior for catalogue |
| **Central** | `uom` select + `settlement_unit` (KG vs count); unit math for parser/SO |
| **AI Studio** | Primary / B2B / retail UOM, price basis, conversion notes, pieces-per-kg engine |
| **Superior** | **AI Studio** for multi-channel UOM; **Central** for order settlement math |
| **Recommendation** | **Merge** — AI Studio UOM fields + Central settlement_unit on same product row |

---

### 13. MOQ (minimum order quantity)

| | |
|--|--|
| **Class** | **D** — AI Studio superior for channel rules |
| **Central** | Product-level MOQ + variant MOQ; enforced in `pricing.ts` / `soGenerator.ts` |
| **AI Studio** | Product-level MOQ rules + `ChannelMoqRules` per channel; `product_moq_rules` table |
| **Superior** | **AI Studio** |
| **Why** | Per-channel MOQ with rule types (carton-based, private label, etc.) |
| **Recommendation** | **Keep AI Studio** channel MOQ; expose approved rules to Central cart/SO via shared read |

---

### 14. Collections (curated product sets)

| | |
|--|--|
| **Class** | **B** + **A** fragments |
| **Central** | `product_tags` + merchandising drag-sort; static `CuratedCollections` homepage tiles |
| **AI Studio** | `catalogue_collections` + `catalogue_collection_items` + Builder UI; legacy `catalogues` table separately |
| **Superior** | **AI Studio** for data-backed collections |
| **Why** | Central collections are tags or static links; AI Studio has collection schema + export |
| **Recommendation** | **Keep AI Studio** `catalogue_collections`; **Merge** Central tag merchandising as collection metadata or tags facet; **Remove** static CuratedCollections tiles when builder publishes |

---

### 15. Catalogue publishing

| | |
|--|--|
| **Class** | **D** — complementary strengths |
| **Central** | Buyer catalogue (`visible_in_catalog` + `is_active`); `AdminCatalogueSyncStatus` JSON connector; `catalogue_product_mappings` |
| **AI Studio** | Branded `catalogues` + public `/c/:slug`; Catalogue Builder PDF/WhatsApp; Central sync preview (no live write) |
| **Superior** | **Central** for live buyer gate; **AI Studio** for composition + export |
| **Why** | Buyers consume Central today; AI Studio owns draft→approve→snapshot flow |
| **Recommendation** | **Merge** — AI Studio publishes approved snapshot → Central connector ingests → sets `visible_in_catalog` |

---

### 16. WhatsApp keywords

| | |
|--|--|
| **Class** | **C** |
| **Central** | `product_aliases` rows; health check `table_alias_count >= 3`; WA webhook reads aliases |
| **AI Studio** | `whatsapp_keyword` term type in AliasManager; draft approval path; language-wave docs |
| **Superior** | **AI Studio** for explicit term typing; **Central** for runtime WA consumption |
| **Why** | AI Studio models keywords as first-class term type with approval |
| **Recommendation** | **Merge** — all WhatsApp keywords as approved `product_aliases` with `alias_type`/term metadata; Central WA reads same table |

---

### 17. Search (admin + catalogue)

| | |
|--|--|
| **Class** | **D** — AI Studio superior intent |
| **Central** | `SearchOverlay` — ILIKE name/sku/category (buyer); no admin list search; no alias use |
| **AI Studio** | `search_products_with_aliases` RPC + scored fallback; `ProductPicker` everywhere |
| **Superior** | **AI Studio** |
| **Why** | Alias-aware search with fallback; used in Label Studio, BOM, products list |
| **Recommendation** | **Keep AI Studio** search module; deploy RPC on shared DB; **Merge** into Central SearchOverlay |

---

### 18. Product Truth (readiness / central sync preview)

| | |
|--|--|
| **Class** | **B** |
| **Central** | `catalogueHealth.ts` batch checks; connector version checks — no per-product readiness UI |
| **AI Studio** | `productReadiness.ts` — 8 dimensions, blockers, badges; Product Truth tab; `catalogue_versions` snapshots |
| **Superior** | **AI Studio** |
| **Why** | Only AI Studio scores publish/sync readiness per product |
| **Recommendation** | **Keep AI Studio** as Product Truth authority; surface readiness summary in Central as read-only badge |

---

### 19. Approval workflow

| | |
|--|--|
| **Class** | **D** — AI Studio superior breadth |
| **Central** | `ApprovalInbox` — tag drafts + alias drafts only (`catalogue_tag_drafts`, `catalogue_alias_drafts`) |
| **AI Studio** | Unified inbox — product, media, alias, BOM, MOQ, pricing, tag (7 types); Category 1 → product drafts |
| **Superior** | **AI Studio** |
| **Why** | Full product draft payload with `needs_admin_review_flags`; Central bypasses approval for direct product saves |
| **Recommendation** | **Keep AI Studio** inbox as single approval surface; **Merge** Central tag/alias RPCs already compatible; route Central product edits through drafts for non-admin |

---

### 20. BOM (bill of materials)

| | |
|--|--|
| **Class** | **C** |
| **Central** | `product_bom` + BOM Blast in AdminProducts for hampers/gifts |
| **AI Studio** | `BomBuilder` — internal vs hamper BOM types; `catalogue_bom_drafts` |
| **Superior** | **Tie** — Central integrated in one panel; AI Studio has draft approval |
| **Recommendation** | **Merge** — AI Studio BomBuilder + draft path; sync approved BOM to Central `product_bom` |

---

### 21. Channel pricing

| | |
|--|--|
| **Class** | **B** |
| **Central** | `AdminPricing.tsx` — MRP, B2B, HORECA tiers on product/variant |
| **AI Studio** | `ChannelPricingRules` + `product_pricing_rules` with `approval_status` |
| **Superior** | **AI Studio** for governed channel rules |
| **Recommendation** | **Keep AI Studio** pricing rules; Central reads approved prices for cart/SO |

---

### 22. Category 1 bulk import

| | |
|--|--|
| **Class** | **B** |
| **Central** | Catalogue connector manual JSON (`AdminCatalogueSyncStatus`) — approved snapshots, not CSV authority import |
| **AI Studio** | `Category1ImportStaging` — CSV/JSON parse, validate, duplicate detect, batch drafts |
| **Superior** | **AI Studio** |
| **Recommendation** | **Keep AI Studio** for authority file intake; Central connector consumes **approved** exports only |

---

### 23. Private label & customisation

| | |
|--|--|
| **Class** | **C** |
| **Central** | `private_label_moq`, `private_label_price` on product |
| **AI Studio** | Private Label tab + Customisation tab with types, caution text, contributor draft grouping |
| **Superior** | **AI Studio** for UX depth |
| **Recommendation** | **Merge** — AI Studio fields as source; sync to Central columns on approve |

---

### 24. Data correction / quality dashboard

| | |
|--|--|
| **Class** | **B** |
| **Central** | Batch health in `catalogueHealth.ts` (scripts/evidence) |
| **AI Studio** | `DataCorrection.tsx` — filterable gap dashboard (photo, price, MOQ, label data) |
| **Superior** | **AI Studio** for operator UI |
| **Recommendation** | **Keep AI Studio**; optional read-only widget in Central admin home |

---

### 25. Variants

| | |
|--|--|
| **Class** | **A** |
| **Central** | `VariantManager.tsx` → `product_variants` (price, MOQ, SKU per variant) |
| **AI Studio** | No variant manager |
| **Superior** | **Central** |
| **Recommendation** | **Keep Central** variants for commerce; link variant SKUs to parent Product Truth record |

---

### 26. Buyer product catalogue UI

| | |
|--|--|
| **Class** | **A** |
| **Central** | `Catalogue.tsx`, `ProductDetail.tsx`, `useProducts.ts`, cart integration |
| **AI Studio** | `PublicCatalogue.tsx` for legacy `catalogues` slug only |
| **Superior** | **Central** for production buyer experience |
| **Recommendation** | **Keep Central** as buyer catalogue; AI Studio does not replace storefront |

---

### 27. AI attribute generation

| | |
|--|--|
| **Class** | **A** (live) + **B** (unwired panel) |
| **Central** | `generate-product-attributes` edge fn — HSN, GST, ingredients, allergens (nutrition generated but not applied in admin) |
| **AI Studio** | Same edge fn callable from `ComplianceAiPanel` (unwired); heuristic placeholder in function |
| **Superior** | **Central** for integration today |
| **Recommendation** | **Merge** — shared edge function; AI Studio panel + approval metadata |

---

### 28. Product list / admin discovery

| | |
|--|--|
| **Class** | **D** — different gaps |
| **Central** | Tag filter, KPIs, cards — **no text search** |
| **AI Studio** | `Products.tsx` — alias search, class/dept filters, readiness badges |
| **Superior** | **AI Studio** for search/filters |
| **Recommendation** | **Keep AI Studio** products list patterns; embed in unified admin or iframe |

---

## Summary counts

| Class | Count (of 28 features) | Interpretation |
|-------|------------------------|----------------|
| **A** — Central only | 4 | Variants, buyer catalogue, live AI integration, production resolver |
| **B** — AI Studio only | 8 | Product Truth, Label Studio/Queue, packaging engine, channel pricing/MOQ, Category 1 import, collections builder, data correction, resolver prototype |
| **C** — Both | 5 | Nutrition, categories, BOM, private label, WhatsApp keywords |
| **D** — Both, one superior | 11 | Creation, editing, media, aliases, compliance, SKU, UOM, MOQ, publishing, search, approval |

---

## Recommended future Product Master architecture

### Single architecture: **Split Authority + Operational Planes**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CATALOGUE AUTHORITY PLANE (AI Studio)                 │
│  ProductEdit · Product Truth · Approval Inbox · Category 1 Import        │
│  AliasManager · SkuBuilder · Media (product-media) · Catalogue Builder   │
│  Draft → Review → Approve → catalogue_versions snapshot                  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ approved snapshot / connector
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    OPERATIONAL PLANE (Central)                           │
│  products (read + controlled fields) · variants · buyer catalogue        │
│  cart/SO/MOQ enforcement · resolver/WA · dispatch/labels payloads      │
│  visible_in_catalog gate · AdminPricing read from approved rules         │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
                    Shared Supabase (tcxvcatsqqertcnycuop)
        products · product_aliases · product_media · product_images bucket
        product-media bucket · sku_code_rules · generate_oasis_sku RPC
```

### Principles

1. **One write path for master truth** — All product identity, packaging, UOM, MOQ, compliance, media, aliases go through AI Studio draft → approval → master write. Central does not direct-write `products` except operational flags (`is_active` for ops, inventory hooks) defined in a allowlist.

2. **One SKU system** — `generate_oasis_sku` + `sku_code_rules` everywhere. Retire Central `OAS-{name}-{grams}` auto formula.

3. **One alias system** — `product_aliases` only, with term types (including `whatsapp_keyword`). Remove parallel `products.aliases[]` writes.

4. **One media bucket** — `product-media` (public read, team write). Migrate Central off `product-images`. Sync `image_url` and `hero_image_url`.

5. **One resolver** — Merge Central PI + WA-05A into shared package; deploy as edge function; used by WA webhook, Central inbox, and AI Studio search.

6. **One nutrition model** — `nutrition_panels` table edited from ProductEdit; Label Queue reads same source.

7. **Two catalogue surfaces, one publish pipe** — AI Studio composes (`catalogue_collections` + branded `catalogues`); approved publish sets Central `visible_in_catalog` and buyer-facing data via connector.

8. **Central keeps** — Variants, buyer catalogue UI, cart/pricing enforcement, resolver runtime, operational labels/barcode payloads, order/dispatch integration.

9. **AI Studio keeps** — ProductEdit, Product Truth, Approval Inbox, Label Studio/Queue, Category 1 import, Catalogue Builder, readiness scoring.

### Phased merge (recommended order)

| Phase | Work | Outcome |
|-------|------|---------|
| **P0** | Create `product-images` or migrate Central to `product-media`; apply `catalogue_collections` migration | Unblock media + builder |
| **P1** | Wire `ComplianceAiPanel`; unify `image_url`/`hero_image_url` (done); deploy `search_products_with_aliases` | ProductEdit GO |
| **P2** | Central product save → draft for non-admin; alias writes only via `product_aliases` | Stop split-brain |
| **P3** | Unified resolver edge function; SearchOverlay uses alias search | WA + search parity |
| **P4** | Nutrition panel on ProductEdit; Label Studio reads same | Label readiness GO |
| **P5** | Catalogue Builder publish → Central connector automation | End-to-end catalogue |
| **P6** | Retire duplicate UI (static collections, `products.aliases`, Central auto-SKU) | Single PIM |

### What to remove (eventually)

| Item | System | Reason |
|------|--------|--------|
| `products.aliases[]` direct writes | Central | Superseded by `product_aliases` |
| `OAS-{name}-{grams}` auto-SKU | Central | Superseded by `generate_oasis_sku` |
| `product-images` bucket name | Central | Align to `product-media` |
| Dual resolver implementations | Central | Merge to one |
| Legacy `catalogues` vs `catalogue_collections` duplication | AI Studio | Unify publish model |
| `productResolver` prototype in isolation | AI Studio | Merge into shared resolver |
| Static `CuratedCollections` tiles | Central | Superseded by builder collections |

---

## Decision matrix (quick reference)

| Feature | Class | Superior | Recommendation |
|---------|-------|----------|----------------|
| Product creation | D | AI Studio | Merge |
| Product editing | D | AI Studio (+ Central variants) | Merge |
| Media | D | AI Studio | Merge buckets |
| Aliases | D | AI Studio (+ Central AI UX) | Merge |
| Resolver | A/B | Central | Merge → shared |
| Nutrition | C | Tie | Merge → nutrition_panels |
| Compliance | D | AI Studio safety + Central AI | Merge |
| Label data | B | AI Studio | Keep AI Studio |
| SKU generation | D | AI Studio | Keep AI Studio |
| Categories | C | Tie | Merge → DB taxonomy |
| Packaging | B | AI Studio | Keep AI Studio |
| UOM | D | AI Studio + Central settlement | Merge |
| MOQ | D | AI Studio | Keep AI Studio |
| Collections | B | AI Studio | Keep AI Studio |
| Catalogue publishing | D | Both | Merge connector |
| WhatsApp keywords | C | AI Studio typing | Merge |
| Search | D | AI Studio | Keep AI Studio |
| Product Truth | B | AI Studio | Keep AI Studio |
| Approval workflow | D | AI Studio | Keep AI Studio |
| BOM | C | Tie | Merge |
| Channel pricing | B | AI Studio | Keep AI Studio |
| Category 1 import | B | AI Studio | Keep AI Studio |
| Private label | C | AI Studio UX | Merge |
| Data correction | B | AI Studio | Keep AI Studio |
| Variants | A | Central | Keep Central |
| Buyer catalogue | A | Central | Keep Central |
| AI attributes | A | Central (live) | Merge |
| Product list | D | AI Studio | Keep AI Studio |

---

## References

- `docs/IMAGE_STORAGE_AND_SYNC_AUDIT.md`
- `docs/AI_STUDIO_CATALOGUE_AUTHORITY_AUDIT.md`
- `docs/CATALOGUE_IMPORT_READINESS.md`
- `docs/CATALOGUE_BUILDER_FUNCTIONAL_AUDIT.md`
- Central: `/tmp/oasis-central/src/pages/admin/AdminProducts.tsx`
- AI Studio: `src/pages/ProductEdit.tsx`, `src/features/productTruth/`, `src/pages/CatalogueBuilder.tsx`
