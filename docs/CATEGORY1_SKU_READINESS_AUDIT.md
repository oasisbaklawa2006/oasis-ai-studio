# Category 1 SKU Readiness Audit

**Prepared:** 2026-06-09  
**Source:** `data/source/Products-List-Project.xls`  
**Batch 001 scope:** Category = `Baklawa` (first 25 rows)  
**Constraints:** Read-only file analysis — no SQL, no migrations, no imports.

---

## Executive summary

The workbook available in this workspace contains **25 product rows and zero SKU data**. Every Batch 001 row will surface a `missing_sku` warning at import and require **admin-assigned SKUs before or during approval**. Product names are unique within the file; there are no in-file SKU or name collisions.

**Aliases** and **WhatsApp keywords** from the authority sheet **cannot be imported in Batch 001** through the Category 1 staging route. The importer has no column mapping for them, and product-draft approval does not persist alias or WhatsApp-keyword fields to master tables.

---

## Source file caveat

| Item | Detail |
|------|--------|
| Path audited | `data/source/Products-List-Project.xls` |
| Sheets | `Sheet1` only |
| Rows | 25 |
| OneDrive originals | Not downloadable from this environment (sign-in required) |
| Stand-in note | Current file is a **25-row Baklawa subset** shaped to authority headers; it does **not** include a SKU column. Re-run this audit when the full authority workbook (with SKU, aliases, and keyword columns if present) is uploaded. |

### Columns present in audited workbook

`Product Name`, `Category`, `UOM`, `GST`, `Weight (GM)`, `Shelf Life`, `Departments`, `Departments II`, `Primary Packing`, `Carton Qty`, `Active/Inactive`

### Columns absent (relevant to this audit)

| Expected field | Accepted importer aliases | Present? |
|----------------|---------------------------|----------|
| SKU | `sku`, `product_sku`, `barcode_sku`, `legacy_sku` | **No** |
| Short name / alias source | `short_name`, `original_name` | **No** |
| Dedicated alias list | — (not in `CATEGORY1_COLUMN_ALIASES`) | **No** |
| WhatsApp keywords | — (not in schema or importer) | **No** |

---

## 1. Total product rows

| Scope | Count |
|-------|------:|
| Full workbook (`Sheet1`) | **25** |
| Batch 001 filter (`Category = Baklawa`, cap 25) | **25** |
| Rows with empty `Product Name` | 0 |
| Active rows | 20 |
| Inactive rows | 5 |

All 25 rows are Baklawa and fall within the planned Batch 001 pilot size (25–30 rows).

---

## 2. Rows missing SKU

| Metric | Count | % of Batch 001 |
|--------|------:|---------------:|
| Rows with no SKU column / blank SKU | **25** | **100%** |
| Rows with populated SKU | 0 | 0% |

**Importer behaviour:** `missing_sku` is a **warning only** — it does not block draft submission (`validate.ts`). Every Batch 001 row will carry `needs_admin_review_flags.sku = true` in the draft payload.

**Approval behaviour:** If a reviewer approves without setting SKU, the approve RPC assigns a placeholder `DRAFT-XXXXXXXX` (8-char UUID fragment) rather than a structured Oasis SKU.

---

## 3. Duplicate SKU values

| Check | Result |
|-------|--------|
| In-file duplicate SKUs | **0** (no SKU values in source) |
| Blank SKU treated as duplicate | N/A |

**Operational note:** Once SKUs are assigned, enforce uniqueness **before submit**. In-file duplicate SKUs are **blocking errors** at import (`duplicate_in_file`). Existing-SKU matches against live `products` are warnings but should be treated as hard stops per the first-import playbook.

---

## 4. Duplicate product names

| Check | Result |
|-------|--------|
| Exact duplicate names (case-insensitive) | **0** |
| Empty / null names | **0** |

### Name families (not duplicates, but SKU disambiguation required)

Several products share collection prefixes with different pack counts or weights. Names are distinct strings; SKUs must encode the variant dimension.

| Family | Variants in file |
|--------|------------------|
| Baklawa Classic Collection | Pack of 4 / 6 / 9 Pcs |
| Baklawa Crystal Collection | Pack of 4 / 6 / 9 Pcs |
| Baklawa Sugar-Free Collection | Pack of 4 / 6 / 9 Pcs |
| Baklawa Vegan Collection | Pack of 4 / 6 / 9 Pcs |
| Baklawa Misr Collection | Pack of 15 / 24 Pcs |
| Baklawa Petit Gourmet Collection | Pack of 16 / 28 Pcs |
| Baklawa Sultan Collection | Pack of 6 / 12 Pcs |
| Baklawa Royal Collection | 250g / 380g |
| Basbousa | Almond / Cashew |
| Standalone | Assorted Tin 600gm, Baklawa Ball, Baklawa Bite |

**Risk:** Because this stand-in was reconstructed from existing Central catalogue names, **name + pack_size duplicate warnings against live `products` are likely** when the batch is uploaded — even though the file itself has no internal name duplicates. Reviewers should expect `duplicate_existing_name` signals and reject net-new creates that match existing master rows.

---

## 5. Recommended SKU generation strategy

### Do not rely on approval-time placeholders

Approving 25 rows without pre-assigned SKUs will create 25 `DRAFT-*` placeholders. That blocks catalogue readiness, breaks search-by-SKU workflows, and forces a second correction pass. **Assign structured SKUs before or during approval review.**

### Preferred: Oasis structured SKU (`generate_oasis_sku`)

Central supports the pattern:

```text
OAS-{division}-{category}-{subcategory}-{packaging}-{####}
```

Example from seed rules: `OAS-AS-BKL-ASS-LOOSE-0001`

| Segment | Batch 001 recommendation | Code |
|---------|--------------------------|------|
| Division | Arabic Sweets (Baklawa production) | `AS` |
| Category | Baklawa | `BKL` |
| Subcategory | Map from product family / flavour / form (see table below) | e.g. `ASS`, `CSH`, `ALM`, `MIX` |
| Packaging | Map from `Primary Packing` / pack format | e.g. `TIN`, `RBOX`, `LOOSE`, `MAAPET` |
| Serial | Auto-increment per segment tuple via `generate_oasis_sku` RPC | `0001`–`9999` |

#### Suggested subcategory mapping (Batch 001)

| Product pattern | Suggested `subcategory_code` |
|-----------------|----------------------------|
| Assorted / mixed collections | `ASS` |
| Cashew (Basbousa Cashew) | `CSH` |
| Almond (Basbousa Almond) | `ALM` |
| Single-form bulk (Ball, Bite) | `MIX` or family-specific code after ops sign-off |
| Collection lines (Classic, Crystal, Sultan, etc.) | `ASS` + encode pack count in packaging serial bucket, **or** add collection-specific subcategory codes in `sku_code_rules` before import |

#### Suggested packaging mapping (from `Primary Packing`)

| Authority pattern | Suggested `packaging_code` |
|-------------------|----------------------------|
| `Jumbo Master`, `Large Master`, rigid gift boxes | `RBOX` |
| Tin packs | `TIN` |
| Loose / kg UOM (Ball, Bite) | `LOOSE` |
| PET trays (if introduced later) | `MAAPET` |

### Practical workflow for Batch 001

1. **Add a `sku` column** to the authority export (or a sidecar CSV keyed by `Product Name`).
2. Pre-generate 25 SKUs using `OAS-AS-BKL-{subcat}-{pack}-{serial}` — one serial sequence per `(subcategory, packaging)` tuple to avoid collisions.
3. Store legacy / barcode values in `legacy_sku` or `source_pdf_sku` if the sheet has old codes (not present in current file).
4. Upload CSV with `product_name`, `sku`, `category`, and mapped fields.
5. At approval, **confirm** each `sku_draft.sku` in the draft payload; do not approve with empty SKU.

### Fallback (not recommended for production Batch 001)

| Stage | Behaviour |
|-------|-----------|
| Import submit | Warning `missing_sku`; draft stores `sku_draft.sku: null` |
| Approve without edit | Master row gets `DRAFT-XXXXXXXX` |
| Post-approve fix | Manual SKU correction + possible alias/search re-index |

Use fallback only for smoke tests, not the first production Baklawa batch.

---

## 6. Aliases and WhatsApp keywords — safe for Batch 001?

### Aliases

| Question | Answer |
|----------|--------|
| Alias columns in authority sheet? | **None** in audited workbook |
| Importer column support? | **No** — `CATEGORY1_COLUMN_ALIASES` has no `alias`, `aliases`, or `alternate_name` |
| Auto behaviour on import | Draft payload sets `aliases.suggested_aliases` to `[product_name, short_name]` only (`buildDraftPayload.ts`) |
| Persisted on product approve? | **No** — `approve_catalogue_product_draft` writes `products` only; it does **not** insert into `product_aliases` |
| Separate alias import path? | Yes — `catalogue_alias_drafts` → `approve_catalogue_alias_draft` (Category 2 / dedicated alias workflow) |

**Verdict: Not safe to import authority-sheet aliases in Batch 001.**

- There is nothing to import from the current file.
- Even if alias columns were added, the Category 1 staging route would **ignore** them unless `columnMapping.ts` is extended.
- Post-approve search aliases require a **follow-on alias draft batch** after product IDs exist.

**Safe minimum for Batch 001:** Rely on `product_name` for search until a dedicated alias import pass is planned.

### WhatsApp keywords

| Question | Answer |
|----------|--------|
| WhatsApp keyword columns in workbook? | **None** |
| `products` table field? | **None** — no `whatsapp_keywords` (or equivalent) in Central product schema |
| Importer support? | **None** |
| WhatsApp in AI Studio today | Catalogue-level only (`proposal_whatsapp_message`, `generateWhatsAppMiniCatalogueText`) — not per-product keywords |

**Verdict: WhatsApp keywords cannot be imported in Batch 001.**

There is no storage target, no column mapping, and no approve-path wiring. WhatsApp mini-catalogue text is generated at collection build time from product names/prices, not from imported keyword fields.

---

## Batch 001 readiness checklist (SKU-focused)

| # | Gate | Status |
|---|------|--------|
| 1 | Authority file includes `sku` column with unique values | **Fail** — column missing |
| 2 | 0% rows missing SKU at upload | **Fail** — 25/25 missing |
| 3 | 0 in-file duplicate SKUs | **Pass** (vacuous — no SKUs) |
| 4 | 0 in-file duplicate product names | **Pass** |
| 5 | Structured `OAS-*` SKUs assigned before approval | **Pending** — ops action |
| 6 | Alias import deferred to post-product alias batch | **Pass** (correct scope separation) |
| 7 | WhatsApp keywords deferred (not in Category 1 scope) | **Pass** (correct scope separation) |

---

## Recommended next actions

1. Obtain the **full** `Products-List-Project` workbook (with SKU column if it exists in the real file) and re-run this audit.
2. Add `sku` to the export template; pre-fill 25 `OAS-AS-BKL-*` codes using the mapping tables above.
3. Proceed with Category 1 CSV upload only after SKU column is populated and uniqueness is verified.
4. Plan **alias import** as Batch 002+ via `catalogue_alias_drafts` once product `id`s exist.
5. Treat WhatsApp discoverability as a **catalogue builder / collection** concern, not a Category 1 import field.

---

## References (code, no SQL executed)

| Artifact | Relevance |
|----------|-----------|
| `src/features/category1Import/columnMapping.ts` | SKU header aliases; no alias/WhatsApp fields |
| `src/features/category1Import/validate.ts` | `missing_sku` warning semantics |
| `src/features/category1Import/buildDraftPayload.ts` | Auto `suggested_aliases`; `sku_draft` shape |
| `src/features/category1Import/duplicateDetection.ts` | In-file and existing SKU/name checks |
| `scripts/supabase/PR06C1_central_tag_alias_approve_mapping.sql` | Approve → `products`; `DRAFT-*` fallback |
| `supabase/migrations/20260506053901_*.sql` | `generate_oasis_sku`, `sku_code_rules` seed |
| `docs/CATEGORY1_FIRST_IMPORT_PLAYBOOK.md` | Batch sizing and duplicate-SKU operational policy |
