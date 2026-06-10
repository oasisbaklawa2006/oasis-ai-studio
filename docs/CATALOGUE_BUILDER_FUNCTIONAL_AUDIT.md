# Catalogue Builder — Deep Functional Audit

**Date:** 2026-06-09  
**Scope:** Read-only audit of AI Studio catalogue authority surfaces  
**Environment reference:** Central Supabase `tcxvcatsqqertcnycuop` (oasis-baklawa)  
**Constraints observed:** No code, SQL, migrations, product data, draft submissions, approvals, or Central sync changes were made for this audit.

---

## Executive summary

AI Studio operates **two parallel catalogue systems**:

| System | Route | Tables | Maturity |
|--------|-------|--------|----------|
| **New Collection Builder** | `/admin/catalogue-builder` | `catalogue_collections`, `catalogue_collection_items`, `catalogue_share_links` | Foundation — curate, preview, export; not public-live |
| **Legacy Branded Catalogues** | `/catalogues`, `/c/:slug` | `catalogues`, `catalogue_products` | Older client-facing flow with publish + public slug |

Product master data is authored through **Product Edit** (`/products/:id`), **Category 1 Import** (`/admin/import/category-1`), and contributor **draft → approval** paths. The Catalogue Builder **does not create or edit products** — it only selects existing `products` rows into collections.

**Verdict:** Catalogue Builder is a **Category 3 (collection/composition) tool**, not a full catalogue authority UI. It cannot yet serve as the sole permanent authority surface without wiring fixes across naming, pricing, aliases, search RPC, share URLs, and dual-system unification.

---

## A. Step-by-step catalogue builder map

### A.1 Route inventory

| Route | Component | Role gate | Purpose |
|-------|-----------|-----------|---------|
| `/admin/catalogue-builder` | `src/pages/CatalogueBuilder.tsx` | `catalogues` | New collection builder (primary audit target) |
| `/catalogues` | `src/pages/Catalogues.tsx` | `catalogues` | Legacy catalogue list + create |
| `/catalogues/:id` | `src/pages/CatalogueDetail.tsx` | `catalogues` | Legacy catalogue edit, products, publish |
| `/catalogues/:id/proposal` | `src/pages/CatalogueProposal.tsx` | `catalogues` | Client proposal + WhatsApp message |
| `/c/:slug` | `src/pages/PublicCatalogue.tsx` | Public | Legacy published catalogue viewer |
| `/products/:id` | `src/pages/ProductEdit.tsx` | `products` | Product master edit (feeds builder) |
| `/admin/import/category-1` | `src/pages/Category1ImportStaging.tsx` | `category1_import` | Category 1 bulk staging |
| `/tags` | `src/pages/Tags.tsx` | `tags` | Tag vocabulary (Category 2) |
| `/approvals` | `src/features/approvals/ApprovalInbox.tsx` | Reviewer | Draft approval inbox |

---

### A.2 Catalogue Builder flow (`/admin/catalogue-builder`)

**File:** `src/pages/CatalogueBuilder.tsx`  
**Store:** `src/features/catalogueBuilder/collectionStore.ts`

| Step | UI section | User action | Persistence | Reliable? | Risk |
|------|------------|-------------|-------------|-----------|------|
| 1 | Authority badges | Read-only status | N/A | Yes | Low |
| 2 | **New collection** | Enter title; choose `catalogue_type` (b2b, retail, export, franchise, wedding, corporate, whatsapp_mini, qr_exhibition, seasonal) | `catalogue_collections` (Supabase) or `oasis_catalogue_collections` (localStorage dev fallback) | Supabase: yes when connected; local: dev-only opt-in | Medium |
| 3 | **Collection list** | Select active collection | Read from same store | Same as step 2 | Low |
| 4 | **Collection header** | View title, type, status (`draft` default) | Read-only display | Yes | Low |
| 5 | **Add product** | Pick from dropdown of `is_active` products | `catalogue_collection_items` insert | Yes on Supabase | Medium |
| 6 | **Product cards** | View preview cards; reorder (swap adjacent); remove | `sort_order` updates on items | Yes on Supabase | Medium |
| 7 | **Publishability warnings** | See per-card blockers | Computed in-memory via `evaluateCataloguePublishability` | Display only; often false-negative | **High** |
| 8 | **WhatsApp preview** | Click "WhatsApp preview" | In-page state only (`whatsappText`) | Ephemeral | Low |
| 9 | **Share URL** | Click "Share URL" | `catalogue_share_links` + placeholder URL `/c/{token}` | Token persisted; **public route does not resolve** | **High** |
| 10 | **Export PDF** | Click "Export PDF" | Client-side blob download | Ephemeral file | Low |

**Collection item fields captured but not exposed in UI today:**

- `display_name_override`, `description_override`, `price_visibility`, `is_featured`, `catalogue_version_id` — exist in schema/store; builder only uses `is_featured` implicitly (always `false` on add) and ignores overrides.

---

### A.3 Product creation / edit flow (`/products/:id`)

**File:** `src/pages/ProductEdit.tsx`

| Tab | Key inputs | Why it exists | Downstream use | Persistence |
|-----|------------|---------------|----------------|-------------|
| **Identity** | `product_name`, `short_name`, `product_class`, `product_type`, `category`, `subcategory`, `main_department`, `production_department`, descriptions, SKU (SkuBuilder), **AliasManager** | Canonical product identity + search aliases | Central sync, labels, B2B portal, WhatsApp card names, trace | Admin: `products` direct; Contributor: `catalogue_product_drafts` |
| **UOM** | `primary_uom`, `b2b_uom`, `retail_uom`, price basis, piece weight, primary packing, MOQ fields | Selling/packing truth for orders | MOQ engine, Central snapshot, catalogue MOQ labels | Same as identity |
| **Media** | `ProductMediaUploader`, hero URL | Approved visuals for catalogues | Builder cards, PDF, public catalogue, Central media gate | `product_media` + storage; contributor → `catalogue_media_submissions` |
| **Private label** | MOQ, cost, upfront | B2B private-label offers | Channel pricing, sales | Product row / draft payload |
| **Customisation** | Types, notes, caution | Gift/hamper sales rules | Ops, proposals | Product row / draft |
| **Dimensions** | L/W/H, material | Logistics, labels | Trace, export | Product row / draft |
| **Frozen** | Shelf life, thawing | Frozen SKU compliance | Ops, labels | Product row / draft |
| **BOM** | `BomBuilder` internal/hamper BOM | Assembly costing, trace | BOM reports, hamper builds | `product_bom_items`; contributor → `catalogue_bom_drafts` |
| **Channels** | `ChannelMoqRules`, `ChannelPricingRules` | Per-channel price/MOQ (Category 2) | Public catalogue RPC, publishability, Central pricing | `product_pricing_rules`, `product_moq_rules`; contributor drafts |
| **Compliance** | Pack/shelf, ingredients, allergens, nutrition, legacy HSN/GST/MRP | Label generation, tax compliance | Trace labels, GST, Central compliance gate | Product row / draft; compliance strip for unapproved |
| **Ops** | Pricing notes, operational notes, BOM required flag | Internal guidance | Sales, production | Product row / draft |
| **Product Truth** | Readiness panels (see A.4) | Gate before Central sync / publish | Central sync preview, builder publishability (partial) | Mixed — see A.4 |

**Write modes:**

| Role | Save behaviour | Target |
|------|----------------|--------|
| `owner` / `admin` / `product_manager` (direct) | `products` insert/update | Master table |
| `catalogue_contributor` | `submitCatalogueDraft` → `catalogue_product_drafts` | Draft only until approval |
| Read-only | Blocked | — |

**localStorage (non-authoritative UX):**

| Key | Purpose | Labelled? |
|-----|---------|-----------|
| `catalogue_product_form_draft_{id}` | Unsaved form autosave | AUTHORITY DRAFT banner |
| `oasis_product_edit_tab_{id}` | Tab persistence | No |
| Cleared on successful save/submit | — | — |

---

### A.4 Product Truth tab (`ProductEdit` → Product Truth)

**File:** `src/features/productTruth/ProductTruthAdminSection.tsx`

| Sub-tab | Component | What it shows / asks | Downstream | Persistence |
|---------|-----------|----------------------|------------|-------------|
| **Readiness** | `ProductReadinessPanel` | Score, dimensions, blockers | Central sync gate, builder publishability | Computed from form |
| **Media** | `MediaReadinessPanel` | Required asset types, approval status | Central approved URLs only | Form + `product_media` |
| **UOM** | `UomConversionPanel` | Conversion chain validation | Order qty conversion | Computed |
| **Packaging** | `PackagingHierarchyPanel` | Pack hierarchy rules | MOQ carton logic | Computed |
| **Channels** | `ChannelRulesPanel` | Price/MOQ rule display | Pricing for catalogues | **Broken wiring:** `prices=[]`, `moqRules=[]` passed from ProductEdit |
| **Preview** | `PreviewCalculatorPanel` | MOQ/pack calculator | Sales quoting | Computed (empty MOQ rules) |
| **Central Sync** | `CentralSyncPreviewPanel` | Version list, snapshot JSON, sync events | Future Central POST | `catalogue_versions` / localStorage fallback; **live write disabled** |

**Critical wiring gap:** `ProductEdit` renders:

```tsx
<ProductTruthAdminSection form={form} productId={id} complianceApproved={false} />
```

It does **not** pass channel `prices` or `moqRules`, and hard-codes `complianceApproved={false}`. Readiness, publishability, and Central sync preview therefore under-report completeness for real products with approved channel rules.

---

### A.5 Category 1 import (related master staging)

**Route:** `/admin/import/category-1`  
**Not part of Catalogue Builder UI**, but feeds the same `products` pool the builder selects from.

Flow: Upload CSV → validate → submit drafts → `/approvals` → `approve_catalogue_product_draft` → `products` insert.

Does **not** write: aliases (beyond `suggested_aliases` in draft JSON), tags, collections, channel rules, or `product_aliases`.

---

### A.6 Legacy catalogues (parallel Category 3)

**Files:** `Catalogues.tsx`, `CatalogueDetail.tsx`, `PublicCatalogue.tsx`

| Step | User enters | Persists to | Public? |
|------|-------------|-------------|---------|
| Create catalogue | title, subtitle, client, type, theme, price_visibility | `catalogues` + `public_slug` | After publish |
| Add products | Product picker, sort, featured | `catalogue_products` | Yes |
| Publish | Status change | `catalogues.status` | `/c/:slug` works |
| Proposal | WhatsApp message template | `proposal_whatsapp_message` | Client share |

This path **is** wired to a live public route. The new Collection Builder share URLs (`/c/{share_token}`) **do not** use `public_slug` and are not served by `PublicCatalogue`.

---

## B. Field purpose explanation

### B.1 Catalogue Builder fields

| Field | User prompt | Why | Used by |
|-------|-------------|-----|---------|
| `title` | "Summer B2B 2026" | Human catalogue name | WhatsApp text header, PDF title |
| `catalogue_type` | Dropdown (9 types) | Channel/intent classification | PDF subtitle, future routing; sets `channel` via string replace |
| `product_id` (item) | "Select product…" | Links master SKU into collection | Cards, WhatsApp lines, PDF rows |
| `sort_order` | Reorder buttons | Display sequence | WhatsApp (first 12), PDF order |
| `is_featured` | Not in UI (schema only) | Highlight products | Would affect card star badge |
| `share_token` | Generated on "Share URL" | Future public access | Placeholder URL only today |

### B.2 Product master fields (feeds builder)

| Field group | Examples | Why | Builder consumption |
|-------------|----------|-----|---------------------|
| Identity | `product_name`, `sku`, `category` | Recognition + navigation | Card title, SKU line, category in PDF |
| Description | `short_description` | Sales copy | Card description (not shown in WhatsApp template) |
| Media | `hero_image_url`, `product_media` | Visual catalogue | Card image, PDF thumbnail, WhatsApp image URL line |
| Pricing | `mrp`, channel rules | Price display | **Builder passes `getChannelPrice([], "retail")` — always empty** |
| MOQ | `moq_value`, channel MOQ rules | B2B ordering | **Always null in builder cards** |
| Compliance | `hsn_code`, `gst_rate` | Tax/labels | Publishability blocker in Product Truth, not shown in builder |
| Visibility | `is_active`, `visible_in_catalog` | Inclusion gates | Builder filters `is_active` only; ignores `visible_in_catalog` |
| Aliases | `product_aliases` table | Search/WhatsApp recognition | **Not used by builder** |

### B.3 Alias fields (`AliasManager`)

| Field | Prompt | Why | Downstream |
|-------|--------|-----|------------|
| `alias` | "e.g. Kadayif" | Alternate search terms | `search_products_with_aliases` RPC (when deployed) |
| `language` | ar/hi/tr | Locale-specific matching | Search ranking |
| `alias_type` | common_name, misspelling, hindi_name, etc. | Match quality / filtering | Search, analytics |
| `is_active` | Toggle | Soft-disable without delete | Search inclusion |
| `source` | manual / system_generated | Provenance | Audit |

### B.4 WhatsApp-related surfaces

| Surface | What user provides | Storage | Behaviour |
|---------|-------------------|---------|-----------|
| Builder "WhatsApp preview" | Nothing per product — generated text | None | `generateWhatsAppMiniCatalogueText` from collection title + card names/prices/images |
| Legacy `CatalogueProposal` | Editable proposal message | `catalogues.proposal_whatsapp_message` | Client-facing proposal copy |
| Per-product WhatsApp keywords | **Does not exist** | **No table/field** | N/A |

---

## C. Downstream dependency matrix

| Data / step | WhatsApp recognition | Customer app / public catalogue | Trace labels | Central order taking | BOM | Pricing | Search | Compliance | Collection export |
|-------------|---------------------|--------------------------------|--------------|---------------------|-----|---------|--------|------------|-------------------|
| `products.product_name` / `name` | Indirect (card text) | Legacy `/c/:slug` | Label title | SKU lookup | — | — | Primary | — | Builder cards |
| `product_aliases` | **Intended** via search RPC | — | — | Order matching | — | — | **Primary** | — | Not wired |
| `suggested_aliases` (draft JSON) | — | — | — | — | — | — | — | — | **Not persisted** |
| `catalogue_collections` + items | Mini catalogue text | **Not live** (no public RLS) | — | — | — | — | — | — | PDF/WhatsApp preview |
| Legacy `catalogues` | `proposal_whatsapp_message` | **Live** `/c/:slug` | — | Channel RPC | — | `get_public_catalogue_channel_data` | — | — | Proposal page |
| `product_pricing_rules` | Builder price lines | Public catalogue prices | — | Central pricing | — | **Authoritative** | — | — | **Not loaded in builder** |
| `product_moq_rules` | MOQ in WhatsApp text | Public MOQ | — | MOQ enforcement | — | — | — | — | **Not loaded** |
| `product_media` | Image URLs in WhatsApp | Public images | Label art | — | — | — | — | — | Builder hero selection |
| HSN/GST/compliance | — | — | **Required** | Tax | — | GST calc | — | **Required** | Publishability gate |
| `product_bom_items` | — | — | Composition | — | **Required** for hampers | — | — | Allergen chain | — |
| `catalogue_product_drafts` | — | — | — | — | — | — | — | Review flags | Staging only |
| Central sync snapshot | — | Future sync | — | **Future** | Included | Included | — | Included | Version pin on items (unused) |

---

## D. Alias / WhatsApp keyword workflow assessment

### D.1 Alias creation workflow

```
┌─────────────────────┐     ┌──────────────────────────┐     ┌──────────────────┐
│ ProductEdit         │     │ Draft path (contributor) │     │ Admin path       │
│ Identity tab        │────▶│ catalogue_alias_drafts   │────▶│ product_aliases  │
│ AliasManager        │     │ /approvals inbox         │     │ (direct upsert)  │
└─────────────────────┘     └──────────────────────────┘     └──────────────────┘
         │                              │                              │
         │                              ▼                              ▼
         │                    approve_catalogue_alias_draft    Immediate search
         │                    (must be deployed + mapped)       (if RPC exists)
         ▼
┌─────────────────────┐
│ Category 1 import   │──▶ draft payload aliases.suggested_aliases only
│ buildDraftPayload   │   (NOT written to product_aliases on product approve)
└─────────────────────┘
```

| Question | Finding |
|----------|---------|
| Do aliases go to `product_aliases`? | **Yes** — admin/direct roles upsert immediately; contributors go through `catalogue_alias_drafts` → approval RPC → `product_aliases` |
| Draft-only / local state? | Contributor submissions are draft until approved; **no localStorage** for aliases |
| Does AliasManager show pending drafts? | **No** — only reads `product_aliases`; contributors see empty list until approval |
| Does product draft approval promote `suggested_aliases`? | **No** — `aliases.suggested_aliases` in grouped payload is informational only |
| Category 1 import aliases? | Auto-fills `[product_name, short_name]` in draft JSON; no column mapping for authority-sheet alias columns |
| Generate basic aliases | Rule-based seed (`SEED_RULES`) for kunafa/pyramid/katori patterns — not AI |
| Search consumption | `src/lib/productSearch.ts` → RPC `search_products_with_aliases` — **reported missing/broken on Central** |

**Alias workflow status: PARTIALLY WIRED**

- UI capture: **Working** (direct + draft submit)
- Persistence to master: **Working for admins**; **approval-dependent for contributors**
- Search downstream: **Blocked** (RPC dependency)
- Import → alias promotion: **Not implemented**

### D.2 WhatsApp keyword workflow

| Question | Finding |
|----------|---------|
| Per-product WhatsApp keyword field? | **None** in schema or UI |
| Importer support? | **None** |
| Builder behaviour | Collection-level plain-text preview from product **names**, prices, image URLs |
| Legacy behaviour | Catalogue-level `proposal_whatsapp_message` + optional channel data RPC |
| Future integration | `whatsapp_business_api` referenced in test-integration function only |

**WhatsApp keyword workflow status: NOT IMPLEMENTED (by design)**

WhatsApp discoverability today = **product name + alias search (when RPC works) + collection composition**, not dedicated keywords.

---

## E. Category 1 / 2 / 3 / 4 fit assessment

| Category | Definition in Oasis model | UI surface | Catalogue Builder support |
|----------|---------------------------|------------|---------------------------|
| **Category 1** | Product master (identity, UOM, pack, base compliance) | `/products/:id`, `/admin/import/category-1` | **Indirect** — builder picks approved products; does not author master |
| **Category 2** | Channel pricing, MOQ, tags, aliases | Product Edit Channels tab, `/tags`, AliasManager | **Not in builder** — separate tabs; builder does not load channel rules |
| **Category 3** | Catalogue/collection composition | `/admin/catalogue-builder`, legacy `/catalogues` | **Primary scope** — new builder + legacy parallel |
| **Category 4** | Platform sync / distribution / Central authority | Product Truth → Central Sync; future webhooks | **Preview only** — `LIVE_CENTRAL_WRITE_ENABLED = false`; versions in localStorage or DB |

### Collection / platform concepts

| Concept | Supported? | Notes |
|---------|------------|-------|
| Multi-type collections (B2B, retail, WhatsApp mini, etc.) | **Yes** | `CATALOGUE_COLLECTION_TYPES` enum |
| Platform / channel field | **Partial** | `channel` derived from type string; not a full platform registry |
| Collection themes | **Schema only** | Default `classic_white`; no theme picker in builder UI |
| Version-pinned items | **Schema only** | `catalogue_version_id` on items — unused in UI |
| Public publish pipeline | **No** (new system) | Status stays `draft`; no publish button; share links not publicly readable |
| Legacy client catalogues | **Yes** | Full publish + `/c/:slug` |

### Can Catalogue Builder become the permanent catalogue authority UI?

**Not yet.** It lacks:

1. Product master authoring (by design — separate flow)
2. Category 2 rule loading for accurate prices/MOQ in previews
3. Alias/search integration
4. Public publish + analytics
5. Unification with legacy `catalogues` or migration path
6. Collection publish workflow (`internal_review` → `published`)
7. `visible_in_catalog` / readiness enforcement on product picker

It **can** become the **Category 3 composition authority** once share URLs, pricing wiring, and publish gates are completed.

---

## F. Missing features before real catalogue authority use

| # | Gap | Impact | Risk |
|---|-----|--------|------|
| 1 | **Product name column drift** — Builder queries `product_name`; Central products use `name` (ProductEdit maps `name` → form) | Blank names in picker and cards | **High** |
| 2 | **Channel pricing/MOQ not loaded** in Builder or Product Truth | False "pricing missing" blockers; empty WhatsApp/PDF prices | **High** |
| 3 | **`search_products_with_aliases` RPC** missing or failing | Alias search dead; WhatsApp/order matching degraded | **High** |
| 4 | **Share URL mismatch** — Builder `/c/{share_token}` vs PublicCatalogue `public_slug` on `catalogues` | Share links 404 | **High** |
| 5 | **Dual catalogue systems** not unified | Data split, operator confusion | **High** |
| 6 | **Alias draft approval RPC** may be stub (`Approval mapping not finalized`) on some deployments | Contributor aliases never promote | **High** |
| 7 | **`suggested_aliases` not promoted** on product draft approve | Manual alias re-entry after bulk import | Medium |
| 8 | **No `product_tags` / product↔tag UI** | Collection filtering by occasion/market missing | Medium |
| 9 | **Collection item overrides** (`display_name_override`, `price_visibility`) not in UI | Cannot tailor per-collection presentation | Medium |
| 10 | **Featured flag** not toggleable in builder | Marketing highlights unused | Low |
| 11 | **`visible_in_catalog` not enforced** in product picker | Non-catalogue-ready SKUs appear | Medium |
| 12 | **Central sync** preview-only | No live distribution to Central | Medium (by design) |
| 13 | **No collection publish workflow** | Collections stuck in `draft` | Medium |
| 14 | **Public RLS for share tokens** not implemented | Cannot safely expose collections | Medium |
| 15 | **Compliance approval hard-coded false** in Product Truth mount | Perpetual compliance blocker in readiness | Medium |

### localStorage / draft state summary

| Store | Keys | Authoritative? | Production behaviour |
|-------|------|----------------|----------------------|
| Collection store | `oasis_catalogue_collections*`, share links | **No** (dev opt-in) | Supabase required; writes gated |
| Version store | `oasis_catalogue_versions_{productId}` | **No** (dev opt-in) | Supabase preferred |
| Product form draft | `catalogue_product_form_draft_*` | **No** | UX recovery only; badged |
| Builder WhatsApp text | React state | **No** | Ephemeral |
| Approval drafts | Supabase draft tables | **Yes** (pre-approval) | Reliable when RLS/RPC deployed |

---

## G. Recommended next 5 fixes (priority order)

| Priority | Fix | Rationale | Suggested PR scope |
|----------|-----|-----------|-------------------|
| **1** | **Fix product display name in Catalogue Builder** — select `name` with `product_name` fallback (same pattern as Products list fix) | Unblocks usable builder for Batch 001 products immediately | `CatalogueBuilder.tsx` query + `rowToCard` |
| **2** | **Deploy/fix `search_products_with_aliases` RPC** on Central | Unlocks alias search, order matching, and validates alias investment | SQL/RPC on Central + verify `productSearch.ts` |
| **3** | **Wire channel prices/MOQ into Builder cards and Product Truth** — load `product_pricing_rules` / `product_moq_rules` when rendering publishability | Accurate pricing in WhatsApp/PDF; fixes false blockers | `CatalogueBuilder.tsx`, `ProductEdit.tsx` → `ProductTruthAdminSection` |
| **4** | **Finalize `approve_catalogue_alias_draft` mapping** + optional auto-promote `suggested_aliases` on product approve | Closes contributor alias loop after Category 1 import | Central RPC + optional approve hook |
| **5** | **Unify public share routing** — either bridge `catalogue_share_links` to a public collection page or migrate legacy `catalogues` into `catalogue_collections` | Makes share URLs and publish path real | New public route or deprecation plan |

**Recommended next PR:** Priority **1** (Catalogue Builder `name`/`product_name` fallback) — smallest change, highest immediate UX impact for operators curating Batch 001 SKUs.

---

## Audit coverage count

| Area | Sections audited |
|------|------------------|
| Catalogue Builder page | 8 |
| Product Edit tabs | 12 |
| Product Truth sub-tabs | 7 |
| Category 1 import staging | 4 |
| Legacy catalogues flow | 4 |
| Alias manager | 3 |
| Tags page | 2 |
| Approval inbox draft types | 7 |
| Central sync preview | 3 |
| localStorage / persistence policies | 4 |
| **Total distinct sections** | **50** |

---

## Confirmation

This audit was **read-only**:

- No application code changed (except adding this document)
- No SQL or migrations created or applied
- No product data modified
- No drafts submitted
- No approvals executed
- Central sync not enabled (`LIVE_CENTRAL_WRITE_ENABLED` remains `false`)

---

## Key file reference

| Area | Path |
|------|------|
| Catalogue Builder page | `src/pages/CatalogueBuilder.tsx` |
| Collection persistence | `src/features/catalogueBuilder/collectionStore.ts` |
| Publishability engine | `src/features/catalogueBuilder/cataloguePublishability.ts` |
| WhatsApp text generator | `src/features/catalogueBuilder/whatsappPreview.ts` |
| PDF export | `src/features/catalogueBuilder/pdfExport.ts` |
| Product edit | `src/pages/ProductEdit.tsx` |
| Product Truth | `src/features/productTruth/ProductTruthAdminSection.tsx` |
| Aliases | `src/components/AliasManager.tsx` |
| Product search | `src/lib/productSearch.ts` |
| Draft map | `src/features/catalogueDrafts/draftTableMap.ts` |
| Approvals | `src/features/approvals/ApprovalInbox.tsx` |
| Central sync preview | `src/features/catalogueSnapshot/panels/CentralSyncPreviewPanel.tsx` |
| localStorage policy | `src/lib/catalogueAuthority/localStoragePolicy.ts` |
| Category 1 import | `src/features/category1Import/`, `src/pages/Category1ImportStaging.tsx` |
| Legacy public catalogue | `src/pages/PublicCatalogue.tsx` |
| Collections migration | `supabase/migrations/20260602160000_catalogue_collections_foundation.sql` |
