# Catalogue Authority Import Readiness Audit

**Audit date:** 2026-06-09  
**Scope:** Read-only — determine whether Oasis AI Studio can safely receive Category 1, 2, and 3 authority data.  
**Constraints honoured:** No data imported, no SQL applied, no migrations created.

---

## Category definitions (inferred — not formally defined in repo)

No file in this repository defines “Category 1 / 2 / 3 authority files.” The mapping below is inferred from Product Truth layering, Central sync payload shape, PR-05 table mapping, and prior catalogue authority audits.

| Tier | Inferred meaning | Primary landing zone |
|------|------------------|----------------------|
| **Category 1** | Product master / Product Truth — identity, SKU, department, UOM, packaging hierarchy, compliance text, media refs, BOM, source provenance | `products`, `product_media`, `product_aliases`, `product_bom` / `product_bom_items`, `catalogue_versions` |
| **Category 2** | Commercial / channel rules — per-channel pricing, MOQ, tag vocabulary and product↔tag links | `product_pricing_rules`, `product_moq_rules`, `tags` / `product_tags` (app) · Central: `pricing_slabs`, `moq_rules`, `product_tags`, `product_tag_mapping` |
| **Category 3** | Published catalogue compositions — curated product sets, client catalogues, share/export surfaces | `catalogues` + `catalogue_products` (branded) · `catalogue_collections` + `catalogue_collection_items` + `catalogue_share_links` (builder) |

**Packaging / platform:** No separate `platform` or `packaging_platform` table exists. Packaging hierarchy lives on `products` (carton/pack fields), Product Edit form (`primary_pack_*`, `qty_per_pack`, `qty_content_uom`), and `catalogue_versions.snapshot_json.packaging_hierarchy`.

---

## 1. Existing product tables

### In `types.ts` (generated reference schema)

| Table | UI / write path | Import-relevant columns |
|-------|-----------------|-------------------------|
| `products` | `ProductEdit`, `Products`, `DataCorrection` | 100+ cols: identity (`product_name`, `sku`, `category`, `subcategory`), UOM (`primary_uom`, `b2b_uom`, `retail_uom`, `pieces_per_kg`, `approximate_piece_weight_g`), packaging (`pack_size`, `packaging_code`, `carton_*`, `master_carton_*`, `pcs_per_*`), pricing legacy (`mrp`, `b2b_price`, `export_price`, `gst_rate`, `hsn_code`), MOQ legacy (`moq_value`, `moq_uom`, `increment_*`), compliance (`shelf_life_days`, `storage_instructions`), provenance (`source_document`, `source_page`, `source_pdf_sku`, `import_confidence`), flags (`is_active`, `is_catalogue_ready`, `media_status`, `label_status`) |
| `product_media` | `Media`, `ProductMediaUploader` | `file_url`, `type`, `status`, `angle`, `alt_text` |
| `product_aliases` | `AliasManager` | `alias`, `alias_type`, `normalized_alias`, `language`, `script`, `source`, `confidence_score` |
| `product_bom_items` | *(types only)* | Rich BOM component model |
| `product_bom` | `BomBuilder` *(code queries this name)* | **Name mismatch** — app uses `product_bom`, types define `product_bom_items` |
| `product_moq_rules` | `ChannelMoqRules` | Per-channel MOQ (`channel`, `moq_value`, `moq_uom`, `increment_*`, `carton_logic`) |
| `product_pricing_rules` | `ChannelPricingRules` | Per-channel pricing (`price_channel`, `base_price`, `approval_status`, `valid_from`/`valid_until`) |
| `sku_code_rules` | `SkuBuilder` | Read-only rules for `generate_oasis_sku` RPC |
| `import_logs` | **No UI** | `source_document`, `source_page`, `source_pdf_sku`, `product_name`, `pack_size`, `import_status`, `warning_notes` |

### In migrations but absent from `types.ts`

| Table / column | Migration | Purpose |
|----------------|-----------|---------|
| `products.product_truth_snapshot` | `20260602120000_product_truth_snapshot_additive.sql` | Optional JSON readiness snapshot |

### Runtime schema drift (critical for import)

`ProductEdit.formToProductRow()` writes **Central-style** column names (`name`, `sub_category`, `image_url`, `visible_in_catalog`, `department`, `price_b2b`) while `types.ts` and early migrations use **Lovable-style** names (`product_name`, `hero_image_url`, `main_department`). `dbProductToForm()` reads Central names. **Authority files must be mapped through this adapter layer** — raw `types.ts` is not the live write contract.

---

## 2. Existing collection tables

### Branded client catalogues (mature UI)

| Table | UI | Notes |
|-------|-----|-------|
| `catalogues` | `Catalogues`, `CatalogueDetail`, `PublicCatalogue` | Status workflow: `draft` → `internal_review` → `published` → `archived` |
| `catalogue_products` | `CatalogueDetail` | `product_id`, `section`, `sort_order` |
| `share_links` | *(types only)* | UI uses `catalogue_share_links` in builder instead |

### AI Studio collection builder (separate flow)

| Table | Migration | UI |
|-------|-----------|-----|
| `catalogue_collections` | `20260602160000_*` | `CatalogueBuilder` |
| `catalogue_collection_items` | same | same — optional `catalogue_version_id` |
| `catalogue_share_links` | same | same |

**Import risk:** Category 3 data could land in two incompatible models. No merge/import mapping exists.

---

## 3. Existing packaging / platform tables

| Storage | Location | Import notes |
|---------|----------|--------------|
| Product row pack fields | `products` | `pack_size`, `packaging_code`, `carton_*`, `master_carton_*`, `pcs_per_carton`, `pcs_per_pack`, `pdf_primary_packaging`, etc. |
| Form-only pack fields | `ProductEdit` | `primary_pack_type`, `primary_pack_uom`, `qty_per_pack`, `qty_content_uom` — **not all persisted as dedicated DB columns**; folded into `pack_size` / UOM / carton fields via `formToProductRow` |
| Versioned snapshot | `catalogue_versions.snapshot_json` | `packaging_hierarchy.primary_pack`, `master_carton`, `uom_conversion_rules` |
| Central export shape | `ApprovedCatalogueProductSnapshot` | `pack_size`, `net_weight_g`, `uom` only — lossy vs full hierarchy |

**No dedicated platform table.** Category 1 packaging authority must map into `products` + optional `catalogue_versions` snapshot.

---

## 4. Existing alias / tag tables

### App schema (`types.ts`)

| Table | UI | Used |
|-------|-----|------|
| `product_aliases` | `AliasManager` | YES |
| `tags` | `Tags` | YES — global vocabulary CRUD |
| `product_tags` | — | **NO UI** — junction table unused in frontend |

### Central schema (per `PR06C_APPROVAL_MAPPING.md`, `PR06B_preflight`)

| Table | App equivalent | Drift |
|-------|----------------|-------|
| `product_tags` | `tags` | Central uses `tag_key`, `tag_label` — **no `public.tags` table on Central** |
| `product_aliases` | `product_aliases` | Central uses `alias_text`, `canonical_name` — app uses `alias` |
| `product_tag_mapping` | `product_tags` (intended) | **No import UI or write path** |

Keyword entity: **does not exist** anywhere in `src/`.

---

## 5. Existing approval tables

### Draft tables (in `scripts/supabase/PR06B_*.sql`, `types.extensions.ts` — **not in tracked migrations**)

| Draft table | Approve RPC | Target (draftTableMap) |
|-------------|-------------|------------------------|
| `catalogue_product_drafts` | `approve_catalogue_product_draft` | `products` |
| `catalogue_media_submissions` | `approve_catalogue_media_submission` | `products` |
| `catalogue_alias_drafts` | `approve_catalogue_alias_draft` | `product_aliases` |
| `catalogue_bom_drafts` | `approve_catalogue_bom_draft` | `product_bom` |
| `catalogue_moq_drafts` | `approve_catalogue_moq_draft` | `moq_rules` |
| `catalogue_pricing_drafts` | `approve_catalogue_pricing_draft` | `pricing_slabs` |
| `catalogue_tag_drafts` | `approve_catalogue_tag_draft` | `product_tag_mapping` |

### Version / sync approval

| Table | Purpose |
|-------|---------|
| `catalogue_versions` | Immutable approved snapshots (`draft` → `approved` → `published` → `synced`) |
| `catalogue_sync_events` | `preview_only` events — no live Central write |

### Inbox

`ApprovalInbox` — 7 draft sources, approve/reject RPCs. **Deployment on shared Central Supabase unverified from this repo alone.**

**Safe import pattern:** Route authority file rows → draft tables → reviewer approval → RPC apply. **Do not bulk-insert master tables directly.**

---

## 6. Existing import / upload capabilities

| Capability | Status | Evidence |
|------------|--------|----------|
| Bulk PDF catalogue import | **Planned only** | `bulk_pdf_import` feature flag; no page, extractor, or staging UI |
| `import_logs` table | **Schema only** | No frontend reads/writes |
| Media upload | **Per-product** | `product-media` storage bucket — not authority import |
| CSV / JSON authority import | **None** | No routes, services, or parsers |
| `products.source_*` / `import_confidence` | **Provenance columns exist** | Suggest prior PDF import lineage; no active pipeline |
| Data Correction | **Manual fix UI** | Direct `products` update — not batch import |
| Central outbound sync | **Disabled** | `LIVE_CENTRAL_WRITE_ENABLED = false` |

---

## 7. Required mapping by category

### Category 1 — Product master / Product Truth

| Authority file concept | Target table(s) | App mapping | Gaps |
|------------------------|-----------------|-------------|------|
| SKU, name, category, department | `products` | `formToProductRow` → `name`, `sku`, `category`, `department` | Column name dual-schema; `product_class`, `division_code`, `category_code` not in Central row mapper |
| UOM, piece weight, conversion | `products` + snapshot | `primary_uom`, `approximate_piece_weight_g`, `pieces_per_kg` | `qty_content_uom`, rounding rules only in form/snapshot |
| Packaging hierarchy | `products` + `catalogue_versions` | `primary_pack_*`, `carton_*`, `master_carton_*` | Lossy — no dedicated pack table |
| Compliance (HSN, GST, ingredients) | `products` | `hsn_code`, `gst_rate`, `ingredients`, `allergen_warnings` | GST manual-approval gate in snapshot; not auto-importable as approved |
| Media refs | `product_media`, `products.hero_image_url` / `image_url` | Upload + hero | URLs must exist in storage or be imported separately |
| Aliases | `product_aliases` | Draft or direct | Central column name drift (`alias` vs `alias_text`) |
| BOM | `product_bom` / `product_bom_items` | `BomBuilder` | Table name + schema complexity mismatch |
| Source provenance | `products`, `import_logs` | `source_document`, `source_page`, `source_pdf_sku` | `import_logs` unused |
| Versioned truth bundle | `catalogue_versions` | `snapshotGenerator` | Requires existing `product_id` |

### Category 2 — Commercial / channel rules

| Authority file concept | App table | Central target (PR-05) | Gaps |
|------------------------|-----------|------------------------|------|
| Channel pricing | `product_pricing_rules` | `pricing_slabs` | **Compatibility unproven** — rich channel + approval_status may not map 1:1 |
| Channel MOQ | `product_moq_rules` | `moq_rules` | Approve RPC mapping unverified; app uses different table name on Central |
| Tag vocabulary | `tags` | `product_tags` (Central) | **Different model** — no `tags` table on Central |
| Product↔tag links | `product_tags` | `product_tag_mapping` | **No UI**; draft target exists but no import path |
| Legacy single-price fields | `products.mrp`, `b2b_price`, etc. | `products` / slabs | Duplicates channel tables — import must pick canonical layer |

### Category 3 — Catalogue compositions

| Authority file concept | Branded path | Builder path | Gaps |
|------------------------|--------------|--------------|------|
| Client catalogue metadata | `catalogues` | `catalogue_collections` | Two parallel models |
| Product membership + order | `catalogue_products` | `catalogue_collection_items` | Different FK shapes; builder supports `catalogue_version_id` |
| Share / export links | `share_links` (unused) | `catalogue_share_links` | No unified import target |
| Publish state | `catalogues.status` | `catalogue_collections.status` | Different enum sets |
| Public consumption | `/c/:slug` + `get_public_catalogue_channel_data` | Builder PDF/WhatsApp | Category 3 import must choose which system is canonical |

---

## 8. Missing tables

### Referenced by app/docs but not in `types.ts` or tracked migrations

| Table | Referenced by |
|-------|---------------|
| `catalogue_product_drafts` (+ 6 sibling draft tables) | `draftService`, `ApprovalInbox`, `types.extensions` |
| `catalogue_versions`, `catalogue_sync_events` | `catalogueVersionStore`, migrations |
| `catalogue_collections`, `catalogue_collection_items`, `catalogue_share_links` | `collectionStore`, migrations |

### On Central (per PR-06 preflight) but not in app `types.ts`

| Table | Category |
|-------|----------|
| `moq_rules` | 2 |
| `pricing_slabs` | 2 |
| `product_tag_mapping` | 2 |
| `product_bom` | 1 |
| `product_variants` | 1 (adjacent) |

### Missing for safe import (recommended, not present)

| Table | Purpose |
|-------|---------|
| `catalogue_import_batches` | Batch metadata, file hash, source system |
| `catalogue_import_staging_rows` | Normalized authority rows pre-approval |
| `catalogue_import_row_errors` | Per-row validation failures |
| `authority_file_registry` | Category 1/2/3 file version tracking |
| `catalogue_approval_audit` | In SQL scripts; not used by frontend |

---

## 9. Missing fields / mapping gaps

| Gap | Impact |
|-----|--------|
| `types.ts` vs live Central column names (`product_name` vs `name`, etc.) | Import mapper must use `formToProductRow` contract, not raw types |
| `product_truth_snapshot` not in `types.ts` | Cannot type-check snapshot imports |
| `primary_pack_type`, `qty_content_uom` not in `products` types | Packaging authority partially form-only |
| `product_bom` vs `product_bom_items` | BOM import target ambiguous |
| Central `product_tags.tag_key` vs app `tags.name` | Category 2 tag import needs transform |
| Central `product_aliases.alias_text` vs app `alias` | Category 1 alias import needs transform |
| No `external_authority_id` / `authority_file_version` on products | Idempotent re-import not supported |
| `product_tags` junction has no UI | Category 2 product↔tag links cannot be reviewed in-app |
| `catalogue_collection_items.catalogue_version_id` never populated by builder | Category 3 cannot pin approved Product Truth versions |
| Keywords domain absent | Search authority not importable |
| Draft RPC deployment status unknown | Imports that rely on approval may fail at runtime |

---

## 10. Safest first import scope

### Verdict by category

| Category | Can safely receive authority data today? | Rationale |
|----------|------------------------------------------|-----------|
| **Category 1** | **PARTIAL — first candidate** | Richest schema + `ProductEdit` + draft workflow + `import_logs`/`source_*` provenance columns + Product Truth tab. Blocked by: no import UI, column-name drift, BOM table ambiguity, no staging tables. |
| **Category 2** | **NO** | Central table mapping unverified (`pricing_slabs`, `moq_rules`, `product_tag_mapping`); tag model mismatch; no product↔tag UI; lossy pricing approval model. |
| **Category 3** | **NO** | Dual catalogue systems; depends on Category 1 product IDs; no composition import UI; would fork data across `catalogues` vs `catalogue_collections`. |

### First importable category: **Category 1 (product master only)**

**Minimum safe slice:**
- Core identity: SKU, name, category, subcategory, department, description
- UOM basics: `primary_uom`, piece weight
- Legacy pricing/MOQ on `products` row only (not channel tables yet)
- Source provenance: `source_document`, `source_page`, `source_pdf_sku`, `import_confidence`
- **Route through `catalogue_product_drafts`** — never direct master bulk insert

**Explicitly defer:**
- Channel pricing/MOQ (Category 2)
- Tag/alias bulk (until column mapping verified)
- BOM (until `product_bom` vs `product_bom_items` resolved)
- Catalogue compositions (Category 3)
- Live Central sync / outbound POST

---

## Import blockers (summary)

| # | Blocker | Severity |
|---|---------|----------|
| 1 | No import UI, parser, or staging pipeline | **CRITICAL** |
| 2 | `types.ts` / migration / Central runtime column name drift | **HIGH** |
| 3 | Draft tables + approve RPCs not in tracked migrations; deployment unverified | **HIGH** |
| 4 | Category 2 Central targets (`moq_rules`, `pricing_slabs`, `product_tag_mapping`) unmapped in app types | **HIGH** |
| 5 | Dual Category 3 catalogue models | **HIGH** |
| 6 | `product_bom` vs `product_bom_items` ambiguity | **HIGH** |
| 7 | Tag model mismatch (app `tags` vs Central `product_tags`) | **MEDIUM** |
| 8 | No idempotency keys for authority file versions | **MEDIUM** |
| 9 | `import_logs` exists but unused — no audit trail wiring | **MEDIUM** |
| 10 | Broad RLS on Central (`PR05_RLS_RISK_REGISTER`) — UI-only gating insufficient for raw import | **HIGH** |

---

## Recommended next PR

**PR: Category 1 import staging — read-only mapper + draft submit (no master writes, no SQL)**

1. Add `docs/CATEGORY_1_AUTHORITY_FILE_SCHEMA.md` template (column mapping authority file → draft payload shape already used by `ProductEdit` contributor save).
2. Add frontend route `/admin/import/staging` (read-only preview): parse CSV/JSON, validate against `formToProductRow` fields, show row-level errors.
3. Submit validated rows only via `submitCatalogueDraft({ draftType: "product", operation: "create" })` — reuse existing approval inbox.
4. Wire `import_logs` insert on batch submit (append-only audit).
5. Run read-only Central schema audit (`scripts/supabase/schema-audit.sql`) to confirm draft tables + RPCs exist before enabling submit in production.

**Out of scope for that PR:** Category 2/3 import, migrations, direct master inserts, Central live writes, actual authority file ingestion from production systems.

---

## Audit confirmation

- **Data imported:** NO  
- **SQL applied:** NO  
- **Migrations created:** NO  
- **Code changed:** NO (this document only)
