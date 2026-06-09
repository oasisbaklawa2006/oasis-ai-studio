# Category 1 Authority Import Staging Plan

**Implemented:** 2026-06-09  
**Route:** `/admin/import/category-1`  
**Workflow:** File → Validation → Draft → Approval Inbox

---

## Purpose

Safely receive Category 1 (product master) authority data without master table writes, Category 2/3 scope, SQL migrations, or Central sync.

---

## Tables used

### Read-only (duplicate preview)

| Table | Purpose |
|-------|---------|
| `products` | Duplicate detection by `sku`, `product_name`, `name`, `pack_size` |

### Write on submit (non-master)

| Table | Purpose | Shared Supabase (`tcxvcatsqqertcnycuop`) |
|-------|---------|----------------------------------------|
| `catalogue_product_drafts` | One row per submitted import line (`operation: create`, `status: pending_approval`) | **EXISTS** — primary audit path |
| `import_logs` | Optional audit trail per submitted row | **MISSING** — deferred; writes skipped automatically |

When `import_logs` is unavailable, the UI shows:

> Import audit log unavailable — draft submission still recorded in catalogue_product_drafts.

Draft submission and Approval Inbox flow are unchanged.

### Not written

| Table | Reason |
|-------|--------|
| `products` | Master writes forbidden — approval RPC applies after review |
| `product_pricing_rules`, `product_moq_rules` | Category 2 — out of scope |
| `tags`, `product_tags`, `catalogues`, `catalogue_collections` | Category 2/3 — out of scope |
| `catalogue_versions` | No auto snapshot on import |

---

## Draft payload shape

Matches `ProductEdit` contributor grouped payload with additional:

```json
{
  "category1_import": true,
  "import_meta": {
    "batch_id": "cat1-…",
    "source_row_index": 1,
    "source_file": "authority.csv",
    "source_document": "…",
    "submitted_via": "category1_import_staging"
  },
  "identity": { … },
  "uom": { … },
  "packing": { … },
  "moq": { … },
  "pricing": { … },
  "compliance": { … },
  "needs_admin_review_flags": { … }
}
```

---

## Column mapping

Authority file headers are normalized and matched via `CATEGORY1_COLUMN_ALIASES` in `src/features/category1Import/columnMapping.ts`.

Examples:

| File column | Target field |
|-------------|--------------|
| `name`, `product_name` | `product_name` |
| `sku`, `barcode_sku` | `sku` |
| `department`, `main_department` | `main_department` |
| `uom`, `primary_uom` | `primary_uom` |
| `hsn`, `hsn_code` | `hsn_code` |
| `source_document`, `source_page` | provenance fields |

Unmapped columns are ignored (shown in mapping preview as skipped).

---

## Validation rules

| Rule | Level | Code |
|------|-------|------|
| `product_name` required | error | `missing_product_name` |
| `category` required | error | `missing_category` |
| `sku` missing | warning | `missing_sku` |
| `sku` > 64 chars | error | `sku_too_long` |
| Unknown `main_department` | warning | `unknown_department` |
| Unknown `production_department` | warning | `unknown_production_department` |
| Unknown UOM | warning | `unknown_uom` |
| Invalid numeric fields (mrp, moq, weights, gst) | error | `invalid_*` |
| GST outside 0–100 | warning | `gst_out_of_range` |
| Invalid `source_page` | warning | `invalid_source_page` |
| Duplicate in file (SKU or name+pack) | error | `duplicate_in_file` |

**Submit gate:** Rows with any **error** cannot be submitted. Warnings allow draft submit with review flags.

---

## Duplicate detection strategy

### In-file (blocking)

1. **SKU** — case-insensitive duplicate `sku` within the same upload
2. **Name + pack** — same `product_name` + `pack_size` combination within the file

### Against master (read-only, warning)

1. **Existing SKU** — `products.sku IN (…)` query
2. **Existing name** — `products.product_name` or `products.name` exact match (capped at 25 unique names per batch), compared with `pack_size` when available

Duplicates do not auto-link to existing products on submit. `import_logs.product_id` is set only when a duplicate match id is known (informational).

---

## Approval path

```
Upload CSV/JSON
  → parseCategory1File (client)
  → validateCategory1Row (client)
  → detectInFileDuplicates (client)
  → detectExistingProductDuplicates (read-only Supabase)
  → User selects submittable rows
  → submitCategory1StagingBatch
       → submitCatalogueDraft({ draftType: "product", operation: "create" })
       → createImportLogEntry({ import_status: "draft_submitted" }) — skipped if table missing
  → Reviewer opens /approvals
       → approve_catalogue_product_draft RPC (when deployed on Central)
       → Master `products` write (reviewer only — not automatic)
```

**No auto-publish.** `is_catalogue_ready` in import data is stored in draft payload flags only until a reviewer approves.

---

## Module map

| File | Role |
|------|------|
| `src/features/category1Import/columnMapping.ts` | Header aliases + row normalizer |
| `src/features/category1Import/parseFile.ts` | CSV/JSON parser |
| `src/features/category1Import/validate.ts` | Validation rules |
| `src/features/category1Import/duplicateDetection.ts` | In-file + read-only DB dupes |
| `src/features/category1Import/buildDraftPayload.ts` | Draft JSON builder |
| `src/features/category1Import/importLogService.ts` | `import_logs` insert |
| `src/features/category1Import/submitStagingBatch.ts` | Batch draft submit |
| `src/pages/Category1ImportStaging.tsx` | Staging UI |

---

## Out of scope (explicit)

- SQL / migrations
- Master `products` insert or update
- Category 2 channel pricing/MOQ/tags
- Category 3 catalogues/collections
- Central sync / `LIVE_CENTRAL_WRITE_ENABLED`
- PDF extractor / `bulk_pdf_import` edge function
- Automatic approval or publish

---

## Follow-up PRs (not this release)

1. Verify `approve_catalogue_product_draft` handles `category1_import` payload on Central
2. Add `import_logs` table on shared Supabase (separate migration PR) then enable audit writes
3. Import batch history view (read `import_logs` once deployed)
3. Update-existing flow (`operation: update` + `target_record_id`) for duplicate SKU rows
4. Regenerate `types.ts` from Central for column name alignment
