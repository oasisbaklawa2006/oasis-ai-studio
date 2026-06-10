# Category 1 First Import Playbook

**Prepared:** 2026-06-09  
**Route:** `/admin/import/category-1`  
**Target:** First real Oasis Category 1 (product master) import via AI Studio staging  
**Constraints for this document:** Readiness review only — no data import, no draft approval, no SQL, no migrations, no Central/Trace modifications.

---

## Executive summary

The Category 1 importer is **ready for a controlled first production import** with these guardrails:

1. Export authority data as **CSV (UTF-8)** or JSON — native `.xlsx` is **not** accepted.
2. Submit **drafts only** (`catalogue_product_drafts`); master `products` are written **only when a reviewer approves** in `/approvals`.
3. Start with **25–30 net-new products** per file (max safe first batch).
4. Review and approve in **batches of 10–15** drafts; reject duplicates and bad rows before approval.
5. Treat **existing-SKU warnings as hard stops** operationally — the UI still allows submit (warning-only).

---

## A. Exact Excel / CSV column structure

Save the authority sheet as **CSV UTF-8** (Excel: *Save As → CSV UTF-8*). Row 1 must be headers. The importer matches headers after normalization: trim, lowercase, spaces → underscores.

### Canonical template (recommended header row)

Use this exact header order for the Oasis first-import template file:

```csv
product_name,sku,category,subcategory,product_class,product_type,short_name,description,short_description,main_department,production_department,primary_uom,b2b_uom,retail_uom,approximate_piece_weight_g,pack_size,primary_pack_type,primary_pack_uom,qty_per_pack,qty_content_uom,net_weight_g,gross_weight_g,mrp,b2b_price,export_price,gst_rate,hsn_code,currency,moq_value,moq_uom,increment_value,increment_uom,shelf_life_days,storage_instructions,ingredients,allergen_warnings,source_document,source_page,source_pdf_sku,import_confidence,is_active,is_catalogue_ready
```

### Minimal viable row (first pilot)

| product_name | sku | category | mrp | pack_size | main_department | primary_uom | hsn_code | gst_rate |
|---|---|---|---|---|---|---|---|---|
| Cashew Pyramid Baklawa | OAS-CAS-PYR-500 | Baklawa | 1200 | 500g | ready_goods_store | pack | 17049090 | 5 |

---

## B. Mapping from Oasis Category 1 authority sheet

The importer does not read a proprietary Excel workbook format. It maps **header names** via `CATEGORY1_COLUMN_ALIASES` in `src/features/category1Import/columnMapping.ts`.

### Mandatory columns

| Canonical field | Accepted header aliases | Validation | Submit impact |
|-----------------|-------------------------|------------|---------------|
| `product_name` | `product_name`, `name`, `productname` | **Error** if empty | Blocks submit |
| `category` | `category` | **Error** if empty | Blocks submit |

### Optional columns (mapped when present)

| Canonical field | Accepted aliases | Notes |
|-----------------|------------------|-------|
| `sku` | `sku`, `product_sku`, `barcode_sku`, `legacy_sku` | Warning if missing; error if >64 chars |
| `short_name` | `short_name`, `original_name` | Maps to `identity.original_name` in draft |
| `subcategory` | `subcategory`, `sub_category` | Free text |
| `product_class` | `product_class` | e.g. `ready_pack`, `bulk_loose_product` |
| `product_type` | `product_type`, `producttype` | e.g. Baklawa, Dragees |
| `description` | `description` | Long text |
| `short_description` | `short_description` | Short text |
| `main_department` | `main_department`, `department` | Must be snake_case enum (see transforms) |
| `production_department` | `production_department` | Required when `main_department=ready_goods_store` |
| `primary_uom` | `primary_uom`, `uom` | Standard UOM list (see transforms) |
| `b2b_uom` | `b2b_uom` | Defaults to `primary_uom` in draft |
| `retail_uom` | `retail_uom` | Defaults to `primary_uom` in draft |
| `approximate_piece_weight_g` | `approximate_piece_weight_g`, `piece_weight_g`, `weight_per_pc_grams`, `grams_per_piece` | Drives computed `pieces_per_kg` |
| `pack_size` | `pack_size` | Display pack label (e.g. `500g`, `6 pcs`) |
| `primary_pack_type` | `primary_pack_type`, `carton_type` | Carton, Box, Tray, etc. |
| `primary_pack_uom` | `primary_pack_uom`, `pack_uom` | Used in `pack_preview` |
| `qty_per_pack` | `qty_per_pack`, `pcs_per_pack` | Numeric |
| `qty_content_uom` | `qty_content_uom` | e.g. `pcs`, `grams` |
| `net_weight_g` | `net_weight_g`, `net_weight_grams` | Numeric |
| `gross_weight_g` | `gross_weight_g`, `gross_weight_grams` | Numeric |
| `mrp` | `mrp` | Numeric; triggers pricing review flag if missing |
| `b2b_price` | `b2b_price`, `price_b2b` | Numeric |
| `export_price` | `export_price` | Numeric |
| `gst_rate` | `gst_rate`, `gst_percentage` | 0–100; warning if out of range |
| `hsn_code` | `hsn_code`, `hsn` | Compliance review flag if missing |
| `currency` | `currency` | Defaults to `INR` |
| `moq_value` | `moq_value`, `moq` | Numeric |
| `moq_uom` | `moq_uom` | Text |
| `increment_value` | `increment_value` | Numeric |
| `increment_uom` | `increment_uom` | Text |
| `shelf_life_days` | `shelf_life_days` | Numeric |
| `storage_instructions` | `storage_instructions` | Text |
| `ingredients` | `ingredients` | Text |
| `allergen_warnings` | `allergen_warnings`, `allergen_information` | Defaults to review placeholder in draft |
| `source_document` | `source_document` | Defaults to filename stem if omitted |
| `source_page` | `source_page` | Positive integer |
| `source_pdf_sku` | `source_pdf_sku` | Provenance |
| `import_confidence` | `import_confidence` | Operator metadata |
| `is_active` | `is_active` | Boolean; default `true` |
| `is_catalogue_ready` | `is_catalogue_ready`, `visible_in_catalog` | Boolean; default `false` |

### Ignored columns

Any header not listed in `CATEGORY1_COLUMN_ALIASES` is **ignored**. It appears in the Column mapping tab as unmapped. Examples likely ignored from a raw authority workbook:

- Channel pricing columns (Category 2)
- Tag / catalogue composition columns (Category 2/3)
- Internal row IDs, images, notes not in alias map
- Duplicate human-readable department labels if not snake_case enums

### Columns requiring transformation (operator prep)

| Field | Authority sheet may have | Importer expects | Transform before upload |
|-------|--------------------------|------------------|-------------------------|
| `main_department` | "Ready Goods Store" | `ready_goods_store` | Use snake_case keys: `ready_goods_store`, `packing_assembly`, `third_party_goods_store` |
| `production_department` | "Dragees Department" | `dragees` | `arabic_sweets`, `dragees`, `fusion_sweets`, `chocolates_confectionery`, `seasoned_nuts_mixes`, `bakery` |
| `primary_uom` | "Kg", "PCS" | `kg`, `pcs` | Lowercase; must be in standard UOM list |
| `is_active` / `is_catalogue_ready` | YES/NO, 1/0 | boolean | `true`/`1`/`yes`/`y` → true; else false |
| Numeric fields | `1,200.50` | number | Commas stripped automatically |
| `gst_rate` | `5%` | number | Remove `%` before upload (otherwise parse fails → error) |
| File format | `.xlsx` | `.csv` or `.json` | Export CSV UTF-8 from Excel |

---

## C. Recommended first import size

| Tier | Rows per file | When to use |
|------|---------------|-------------|
| **Pilot (recommended)** | **25–30** net-new products | First real import; full manual review |
| Stretch | 50 | After pilot success; all rows have SKUs |
| Avoid for v1 | 100+ | No server-side batch cap, but UI + sequential submit + reviewer load degrade |

### Hard/soft technical limits (code-derived)

| Limit | Value | Source |
|-------|-------|--------|
| Name-based DB duplicate scan | **25 unique `product_name` values per file** | `duplicateDetection.ts` — names beyond 25 are not checked against master |
| In-file duplicate | Unlimited detection | Full file scan |
| SKU-based DB duplicate | All unique SKUs in file | `.in("sku", …)` query |
| Submit concurrency | Sequential (1 draft insert per row) | `submitStagingBatch.ts` |
| File types | `.csv`, `.json` only | `Category1ImportStaging.tsx` |

**Recommendation:** **25–30 rows** for the first production file — stays within the name-duplicate scan cap, keeps Approval Inbox reviewable, and limits blast radius if approval mapping gaps exist.

---

## D. Recommended approval batch size

| Setting | Recommendation |
|---------|----------------|
| Drafts submitted per upload | 25–30 |
| Drafts approved per reviewer session | **10–15** |
| Parallel reviewer sessions | 1 primary reviewer for first import |

### Approval workflow summary

```
CSV/JSON upload  →  validation preview  →  operator selects rows  →  Submit selected as drafts
       ↓
catalogue_product_drafts (status: pending_approval, operation: create)
       ↓
/approvals (reviewer: is_catalogue_reviewer / super_admin)
       ↓
  ┌──── reject_catalogue_product_draft(id, reason)  →  status: rejected (no master write)
  └──── approve_catalogue_product_draft(id)         →  INSERT into products + draft approved
```

**Verified on shared Central Supabase (`tcxvcatsqqertcnycuop`):**

| Step | Status |
|------|--------|
| Draft insert (`catalogue.products.submit` permission) | Works for `catalogue_contributor` |
| Reject RPC | Works — updates draft only + `catalogue_approval_audit` |
| Approve RPC | **Deployed** — maps `category1_import` grouped payload → `products` insert |
| `import_logs` audit | **Missing** — skipped; drafts are the audit trail |

**Approve mapping notes (reviewer must know):**

- Master `products.name` ← `payload.identity.product_name`
- Master `products.sku` ← `payload.sku_draft.sku` or auto `DRAFT-XXXXXXXX` if empty
- Master `products.pack_size` ← `packing.pack_preview` or `packing.primary_pack_type` (**not** `packing.pack_size` directly)
- `visible_in_catalog` set **false** on approve regardless of import flag
- Approve is **create-only** for imports (`operation: create`) — existing-SKU warnings do **not** auto-update existing products

---

## E. Known risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Existing-SKU match is **warning only** — submit still allowed | **High** | Operator policy: do not submit rows with `duplicate_existing_sku`; reviewer rejects if slipped through |
| Approve creates **new** `products` row even when SKU exists | **High** | Pre-filter authority file; reject duplicates in inbox |
| `pack_size` from authority may not land in master `products.pack_size` on approve | Medium | Reviewer verifies pack fields post-approve; fix in Product Edit if needed |
| Name duplicate scan capped at 25 names | Medium | Keep batches ≤30 or ensure every row has SKU |
| No `import_logs` on shared Supabase | Low | Use `import_meta.batch_id` in draft payload for traceability |
| Category/subcategory are free text | Medium | Align with Product Edit taxonomy before import |
| Department/UOM typos → warnings only | Medium | Pre-validate against enum lists in this doc |
| Sequential submit slow on large files | Low | Split into multiple batch files |
| `is_catalogue_ready` in file does not publish to catalogue on approve | Low | `visible_in_catalog` forced false on approve |
| Central live sync disabled | Info | `LIVE_CENTRAL_WRITE_ENABLED = false` — no outbound sync from import path |

---

## F. Rollback strategy

### Before approval (preferred)

1. Identify drafts by `import_meta.batch_id` in `/approvals` or SQL read on `catalogue_product_drafts`.
2. Call `reject_catalogue_product_draft(draft_id, reason)` for each pending draft.
3. Confirm `status = rejected` — **no `products` row created**.

*Proven in smoke-test cleanup (2026-06-09).*

### After accidental approval

1. Locate new `products.id` from approved draft `target_record_id`.
2. **Do not bulk-delete** — assess downstream references (orders, BOM, media).
3. Options: deactivate (`is_active = false`) via Product Edit, or admin-coordinated delete.
4. Reject remaining siblings in the same batch before further approvals.

### File re-upload

1. Fix source CSV.
2. Upload corrected file as a **new batch** (new `batch_id`).
3. Reject obsolete pending drafts from the bad batch.

### What rollback does **not** cover

- No automatic undo of approved master writes
- No `import_logs` replay (table absent)
- No Central/Trace rollback from this path

---

## Duplicate detection reference

| Check | Scope | Level | Blocks submit? |
|-------|-------|-------|----------------|
| Duplicate SKU in file | In-file | Error (`duplicate_in_file`) | **Yes** (second+ row) |
| Duplicate name + pack in file | In-file | Error | **Yes** |
| SKU exists in `products` | Read-only DB | Warning (`duplicate_existing_sku`) | No |
| Name + pack exists in `products` | Read-only DB (≤25 names) | Warning (`duplicate_existing_name`) | No |

---

## Pre-flight checklist (first real import)

- [ ] Authority sheet exported to **CSV UTF-8** with canonical headers
- [ ] Every row has `product_name` and `category`
- [ ] SKUs unique within file and checked against live catalogue
- [ ] `main_department` / `production_department` use snake_case enums
- [ ] Numeric fields have no `%` or currency symbols
- [ ] Pilot batch ≤30 net-new rows
- [ ] Reviewer available at `/approvals`
- [ ] Operator briefed: warnings ≠ safe to submit for duplicate SKUs
- [ ] Rollback plan agreed (reject before approve)

---

## Source modules (read-only review)

| Module | Role |
|--------|------|
| `src/features/category1Import/columnMapping.ts` | Header aliases + transforms |
| `src/features/category1Import/parseFile.ts` | CSV/JSON parse + in-file dupes |
| `src/features/category1Import/validate.ts` | Validation rules |
| `src/features/category1Import/duplicateDetection.ts` | Master duplicate warnings |
| `src/features/category1Import/buildDraftPayload.ts` | Draft JSON shape |
| `src/features/category1Import/submitStagingBatch.ts` | Draft-only submit |
| `src/pages/Category1ImportStaging.tsx` | Staging UI |
| `src/features/approvals/ApprovalInbox.tsx` | Reviewer workflow |

---

## Confirmations (this task)

| Constraint | Status |
|------------|--------|
| No data imported | Confirmed — documentation only |
| No drafts approved | Confirmed |
| No SQL created or applied | Confirmed |
| No migrations | Confirmed |
| Central not modified | Confirmed |
| Trace not modified | Confirmed |
