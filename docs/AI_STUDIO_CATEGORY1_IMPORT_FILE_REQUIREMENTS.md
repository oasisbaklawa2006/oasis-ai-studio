# AI Studio — Category 1 Import File Requirements

_Date: 2026-03-28 · Repo: `oasis-ai-studio`_

## Symptom

Category 1 Import staging page (`/admin/import/category-1`) opened but **no file was pre-loaded** — owner expected a bundled import file.

## Root cause

**By design — no auto-loaded production file.** The import route is upload-driven:

1. User selects CSV or JSON via file input
2. `parseCategory1File()` validates and maps columns
3. User submits selected rows as `catalogue_product_drafts` (approval required)

There is **no hard failure** when no file is present — the empty state was unclear.

## Expected files

| File | Location | Purpose |
|------|----------|---------|
| **Downloadable template** | `public/templates/category1-import-template.csv` | Owner/staging smoke — minimal column example |
| **Preview batch (repo)** | `data/category1-preview/CATEGORY1_IMPORT_BATCH_001.csv` | 25-row baklawa sample for dev/QA (not served unless copied to public) |
| **User authority export** | Uploaded by owner | Real Category 1 import source |

### Template URL (production)

```
https://oasis-ai-studio.vercel.app/templates/category1-import-template.csv
```

### Required columns

| Column | Required | Notes |
|--------|----------|-------|
| `product_name` | **Yes** | Minimum for submittable row |
| `sku` | No | Recommended; duplicate detection uses SKU |
| `category` | No | Display category |
| `primary_uom` | No | e.g. `kg`, `pcs`, `pack` |
| `gst_rate` | No | Numeric |
| `main_department` | No | e.g. `ready_goods_store`, `packing_assembly` |
| `production_department` | No | When main = ready_goods_store |
| `primary_pack_type` | No | Carton/box labels from authority |
| `qty_per_pack` | No | Numeric |
| `is_active` | No | `true`/`false` (default true) |

Full alias map: `src/features/category1Import/columnMapping.ts` (`CATEGORY1_COLUMN_ALIASES`).

### Supported formats

- `.csv` — header row + data rows
- `.json` — array of objects or `{ rows: [...] }`

## Fix applied in code

1. **Template served** at `/templates/category1-import-template.csv` (copied from preview batch structure).
2. **Category1ImportStaging.tsx** — clear copy:
   - No file is bundled; user must upload
   - Download template link
   - Reference to repo preview path for developers
3. Empty state explains required column (`product_name`) and workflow.

## Workflow (no destructive writes)

```
Upload file → validate → select rows → Submit as drafts → /approvals
```

Products are **never** auto-published to master.

## Owner action

1. Export Category 1 authority data as CSV (or use template for smoke).
2. Upload on `/admin/import/category-1`.
3. Review validation tab; fix errors in source file if needed.
4. Submit selected rows; approve in Approval Inbox when ready.

## Validation

- [ ] Page loads without error when no file uploaded
- [ ] Template download works
- [ ] Upload template CSV → rows appear in staging table
- [ ] Draft submit creates inbox items (if RLS/RPC allow)
