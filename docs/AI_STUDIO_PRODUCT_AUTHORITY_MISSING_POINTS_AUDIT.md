# AI Studio Product Authority — Missing Points Audit

_Date: 2026-03-13 · Mode: read-only audit · No code / SQL / migrations / production writes_

**Scope:** 40 Oasis product-authority requirements vs oasis-ai-studio codebase, prior wave deliverables, and Batch 001 / pilot evidence.

**Context:** AI Studio = intended PIM / Product Authority. Central = operational consumer. Last wave (`1d4212d`) delivered Fast Create, Compliance AI wiring, defaults, write-permission fix, media read sync — but did **not** close data-plane, schema-unification, or Batch 001 authority gaps.

**Classification legend (per requirement):**

| Tag | Meaning |
|-----|---------|
| **WORKS** | Implemented and usable in Studio for authority path |
| **WEAK** | Exists but incomplete, unreliable, or not production-proven |
| **MISSING** | No meaningful implementation |
| **DUP** | Two+ stores or UIs for same truth |
| **WRONG** | Implemented under wrong owner/table/app |
| **MIG** | Blocked on Supabase migration / infra not applied in repo |
| **UI** | Schema/logic exists; authoring or review UI missing |
| **AI** | Needs generation/automation |
| **APPROVE** | Needs governed approval before master truth |

---

## Executive summary

| Metric | Count |
|--------|------:|
| Requirements audited | **40** |
| **WORKS** (primary) | **11** |
| **WEAK** (primary) | **22** |
| **MISSING** (primary) | **7** |
| Requirements with any **DUP** tag | **6** |
| Requirements with **MIG** blocker | **4** |
| Requirements with **UI** gap | **12** |
| Requirements with **AI** gap | **8** |
| Requirements with **APPROVE** gap | **6** |
| **Total distinct gap points** (MISSING + WEAK + DUP + WRONG + blocking MIG/UI) | **31** |

**Wave coverage:** Last wave addressed **#3 HSN/GST (UI)**, **#8–9 defaults**, **#27 alias seeds**, **#25 hero read sync**, **#38 partial (compliance approval meta)**, **create speed (#1 partial)**. It did **not** address nutrition unification, FSSAI authority, term-type persistence, packaging data apply, media minimums, resolver UI, audit trail, or live infra migrations.

---

## Requirement-by-requirement audit

### 1. Product identity

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WEAK** | DUP, UI | `ProductEdit` Identity tab; `SkuBuilder`; Fast Create; contributor drafts | `formToProductRow` writes Central names (`name`, `price_b2b`, `visible_in_catalog`) while Studio types use `product_name`, `b2b_price`, `is_catalogue_ready` — adapter drift risk. No variant identity. |

### 2. SKU / EAN / barcode

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WEAK** | MISSING (EAN), UI, APPROVE | `SkuBuilder` + `generate_oasis_sku`; `labels.barcode`; `legacy_sku` | No GTIN/EAN column. Barcode = label row only. Category 1 source has **no SKU column** (100% `missing_sku`). Placeholder `DRAFT-*` on approve without admin SKU. |

### 3. HSN / GST

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WORKS** | AI, APPROVE | `ComplianceAiPanel`, category defaults, Fast Create enrichment, save strip | Edge fn availability on prod. Multi-rate history. Batch 001 rows may still lack applied values until edited. |

### 4. FSSAI fields

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WEAK** | WRONG, UI | `labels.fssai_license`; Label Queue `has_fssai` | Not on `products` or ProductEdit Compliance. FSSAI lives only in label workflow — wrong owner for PIM single screen. |

### 5. Ingredients

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WEAK** | DUP, UI | ProductEdit textarea; `/ingredients` structured master + `product_ingredients` | Single authority path. No BOM→ingredient rollup. Label Queue checks structured links only. |

### 6. Allergens

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WEAK** | DUP | Free-text `allergen_warnings`; `ingredients.allergen_group` | No product-level structured allergen enum. Snapshot uses text only. |

### 7. Nutrition

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **MISSING** (unified) | DUP, UI, AI, APPROVE | `nutrition_panels` table; Ingredients page editor; ProductEdit JSON/text field | **Authority gap #1.** No ProductEdit panel editor. Free text ≠ label truth. AI correctly excludes auto nutrition. |

### 8. Shelf life

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WORKS** | UI | `shelf_life_days`, frozen/post-processing fields, `labels.best_before` | Multiple shelf-life fields without hierarchy rules; batch dates on `labels` only. |

### 9. Storage condition

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WORKS** | — | `storage_instructions`, `temperature_requirement`, `thawing_instruction` | `storage_type` in Central defaults but not in Studio `empty` form. |

### 10. Veg mark

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **MISSING** | UI, APPROVE | `ingredients.veg_status`; Labels preview hardcodes `🌱 VEG` | No `products.is_veg` / authoritative veg flag. Preview misleading. |

### 11. Batch / MRP / label data

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WEAK** | DUP, UI, APPROVE | `labels` (batch, mfg, best_before, mrp); ProductEdit `mrp`; Label Queue | MRP duplicated. Batch fields not in ProductEdit. No print execution pipeline. |

### 12. Packaging hierarchy

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WEAK** | UI | `uomPackagingEngine`, `PackagingHierarchyPanel` (read-only), UOM tab | **Batch 001: 12% packaging readiness** — CSV authority not mapped to master. Panel not editable. |

### 13. Grams per piece

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WEAK** | DUP, MIG (data) | UOM field `approximate_piece_weight_g`; adapter `grams_per_piece` | **0/25 Batch 001** populated despite CSV Weight (GM). |

### 14. Pieces per kg

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WEAK** | UI | Auto-derive from piece weight in ProductEdit | **0/25 valid** in master. Engine defaults (40) used in readiness when missing. |

### 15. Primary pack

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WORKS** | UI | `primary_pack_type/uom`, `qty_per_pack`, `pack_size` | `pack_label` in snapshot but thin in form. Category 1 maps Primary Packing partially. |

### 16. Secondary pack

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WEAK** | UI | `carton_qty/uom`, `pcs_per_carton` | No explicit secondary-pack entity. **666/888/Mappet** carton codes not mapped (Batch 001). |

### 17. Master carton

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WORKS** | UI | `master_carton_qty/uom`; snapshot hierarchy | `master_carton_weight_kg` in generator only. Empty on Batch 001. |

### 18. MOQ

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WORKS** | DUP, APPROVE | UOM scalars + `product_moq_rules` + `ChannelMoqRules` + drafts | **25/25 placeholder MOQ=1** on Batch 001. Scalar vs channel duplication. |

### 19. B2B pricing

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WORKS** | DUP | `b2b_price`, `product_pricing_rules` channel `b2b` | `formToProductRow` writes `price_b2b` not `b2b_price`. Scalar vs rules divergence. |

### 20. B2C pricing

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WEAK** | DUP | `mrp`, `retail_uom`, channels `retail`/`mrp` | No dedicated B2C product fields (SEO, consumer slug). MRP duplication. |

### 21. Channel pricing

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WORKS** | APPROVE | `ChannelPricingRules`, 15+ channels, pricing drafts | Readiness needs one approved rule — not per-channel publish matrix. Channels tab only after save. |

### 22. Distributor pricing

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WORKS** | — | `distributor` channel in pricing/MOQ rules | No tier ladder (region/volume). |

### 23. Export data

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WEAK** | UI | `export_price`, `export_price_usd`, export channel, `export_pack` media profile | No COO/customs/incoterms structured pack. `export_compliance_notes` in constants, no UI. |

### 24. Country-specific compliance

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WEAK** | WRONG | `labels.country_of_origin` (default India) | No per-destination matrix on product. COO on label row only. |

### 25. Images (hero, square, detail, packaging, lifestyle, label)

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WEAK** | DUP, MIG, UI | `ProductMediaUploader` (14 types); `product_media`; hero sync; `PRODUCT_MEDIA_ROLES` constant | **Two taxonomies:** uploader (`hero_image`, `lifestyle`) vs readiness (`primary_image`, `pairing_image`). **No `square_image` workflow.** **0/25 Batch 001** images. Dual bucket (`product-images` / `product-media`). |

### 26. Video / 360 future media

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WEAK** | MISSING (360), UI | `video` type in uploader | No 360/spin. Video excluded from readiness requirements. No transcode/CDN. |

### 27. Aliases

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WORKS** | DUP, APPROVE | `AliasManager`, `product_aliases`, drafts, Fast Create persist | Central `products.aliases[]` parallel store. Legacy `canonical_name` rows with null `product_id`. |

### 28. WhatsApp keywords

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WEAK** | UI, MIG, APPROVE | Term type `whatsapp_keyword` in UI; Fast Create keywords; resolver prototype | **Term type stored in localStorage only** (`termTypeStorage.ts`). Not in DB. Category 1 import **cannot** import WhatsApp columns. |

### 29. Search keywords

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WEAK** | MIG, UI | `search_keyword` term type; `productSearch.ts` + RPC fallback | RPC may be undeployed on live DB. Term types not persisted. |

### 30. Regional language terms

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WEAK** | MISSING (schema), UI | `language`/`script` on `product_aliases`; `ProductLanguageTermsPanel` | **`product_language_terms` table missing.** Snapshot `matches_typed_terms: false`. Batch language waves use offline scripts. |

### 31. Resolver collisions

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **MISSING** | UI | `productResolver/resolveProduct.ts` returns `clarification_required`; tests only | **No Studio admin UI** for collision review. Central owns production resolver. Wave 2 collision reports exist as JSON only. |

### 32. Catalogue collections

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WEAK** | MIG, DUP | `CatalogueBuilder`, `catalogue_collections` migration, diagnostics | **Migration not applied on live DB.** Dual systems: legacy `catalogues` vs `catalogue_collections`. |

### 33. Website / B2C fields

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WEAK** | UI | `is_catalogue_ready`, descriptions, `PublicCatalogue`, builder cards | No product SEO slug/meta. Builder may ignore `visible_in_catalog`. No consumer-specific field group. |

### 34. Central B2B snapshot fields

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WORKS** | UI, APPROVE | `snapshotGenerator.ts`, `CentralSyncPreviewPanel`, `catalogue_versions` | **`LIVE_CENTRAL_WRITE_ENABLED = false`** — preview only. Version store may fall back to localStorage. |

### 35. Label maker snapshot fields

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WEAK** | WRONG, UI | `Labels.tsx`, `LabelQueue.tsx`, `labels` table | Not in `CatalogueSnapshotJson`. Separate from Product Truth snapshot. No versioned label export. |

### 36. WhatsApp resolver snapshot fields

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **MISSING** | UI | `snapshotLanguage.ts` embeds read-only `language_intelligence` preview | No dedicated WA resolver snapshot contract. Resolver does not consume catalogue versions. |

### 37. Product Truth score

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WORKS** | UI | `evaluateProductReadiness`, 8 dimensions, `ReadinessBadge` | Unweighted count score. No nutrition/label dimensions. Channel prices not fed from Channels tab into readiness on edit. |

### 38. Approval workflow

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WORKS** | MIG, APPROVE | 7 draft types, `ApprovalInbox`, approve/reject RPCs in scripts | No nutrition/compliance/label-specific draft types. RPC migration deploy uncertain. Compliance approval meta **session-only** (not persisted). |

### 39. Audit trail

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **MISSING** | UI | `AuditLog.tsx` → `feature_activation_audit` only | **No per-field product change log.** SKU override reason not stored. No compliance approval audit persistence. |

### 40. Emergency override rules

| Primary | Tags | Evidence | Still missing |
|---------|------|----------|---------------|
| **WEAK** | UI, APPROVE | SKU override in `SkuBuilder`; MOQ `allow_override` | No global emergency policy. No override for compliance, label lock, or pricing. No override audit. |

---

## Cross-cutting gaps (not in last wave)

| Gap | Affects #requirements | Severity |
|-----|----------------------|----------|
| Schema write adapter (`name` vs `product_name`) | 1, 19, 33, 34 | **Critical** |
| Batch 001 packaging not applied to master | 12–17, 37 | **Critical** |
| Batch 001 media 0/25 | 25, 37, 34 | **Critical** |
| Term types in localStorage not DB | 28–30, 36 | **High** |
| Nutrition split | 7, 11, 35, 37 | **High** |
| FSSAI / label wrong owner | 4, 10, 11, 35 | **High** |
| Live migrations (collections, RPC, bucket) | 25, 29, 32, 38 | **High** |
| Central sync disabled | 34, 36 | **Medium** |
| Resolver collision UI | 31, 36 | **Medium** |
| Product audit trail | 39, 40 | **Medium** |

---

## Batch 001 / pilot evidence (live data state)

| Workstream | Readiness | Source doc |
|------------|-----------|------------|
| Packaging | **12%** | `BATCH001_PACKAGING_AUTHORITY_REPORT.md` |
| Media | **0%** | `BATCH001_MEDIA_AUTHORITY_REPORT.md` |
| Language | **68%** resolver coverage (17/25 SKUs) | `BATCH001_LANGUAGE_COVERAGE_REPORT.md` |
| SKU in source file | **0%** column present | `CATEGORY1_SKU_READINESS_AUDIT.md` |

**5-SKU pilot interpretation:** Minimum publishable subset (anchor SKUs from language Phase 1 ≈ 4–5 products) requires SKU + HSN/GST + hero + piece weight + approved aliases — most pillars still fail on **data**, not only **UI**.

---

## What last wave covered vs did not

| Covered | Not covered |
|---------|-------------|
| Fast Create (speed) | Packaging authority apply to existing SKUs |
| Compliance AI panel wired | Nutrition panel in ProductEdit |
| Category defaults (HSN/GST/UOM) | FSSAI on product row |
| Hero URL dual-column sync | Media taxonomy unification |
| Owner/admin save fix | Term type DB persistence |
| Shared alias seed rules | Resolver collision admin UI |
| Product Truth compliance props | Product field audit trail |
| | Category 1 alias/WhatsApp import |
| | Collections live migration |
| | Central live sync enable |
| | Veg mark authority |
| | EAN/GTIN |

---

## References

- `docs/AI_STUDIO_PRODUCT_AUTHORITY_READINESS.md`
- `docs/PRODUCT_MASTER_FEATURE_PARITY_MATRIX.md`
- `docs/AI_STUDIO_STABILITY_REMEDIATION.md`
- `docs/AI_STUDIO_FAST_CREATE_IMPLEMENTATION.md`
- `docs/UNIFIED_PRODUCT_MEDIA_ARCHITECTURE.md`
- `docs/BATCH001_*` / `CATEGORY1_SKU_READINESS_AUDIT.md`
