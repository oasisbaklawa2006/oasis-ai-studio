# Alias & WhatsApp Authority — Deep Audit

**Date:** 2026-06-10  
**Environment:** Central Supabase `tcxvcatsqqertcnycuop` (oasis-baklawa)  
**Question:** Can AI Studio become the single source of truth for product aliases, WhatsApp keywords, search terms, and customer-facing discoverability terms?

**Verdict:** **Not yet.** Aliases are **partially** authoritative in UI and schema design, but production wiring on Central has **schema drift**, **broken search RPC alignment**, **approval metadata loss**, and **no snapshot/Central export path**. WhatsApp keywords and dedicated discoverability terms **do not exist** as a first-class authority layer.

**Constraints observed:** Read-only audit — no code, SQL, migrations, product writes, drafts, approvals, or Central sync changes.

---

## Executive summary

| Authority layer | UI capture | Master persistence | Search consumption | Central sync | Single source of truth? |
|-----------------|------------|-------------------|-------------------|--------------|-------------------------|
| Product aliases | Yes (`AliasManager`) | `product_aliases` (admins) / `catalogue_alias_drafts` (contributors) | Intended via `search_products_with_aliases` | **Not in snapshot** | **Partial** |
| WhatsApp keywords | **No** | **No table/field** | **No** | **No** | **No** |
| Search terms | Conflated with aliases | Same as aliases | Products list search | **No** | **Partial** |
| Customer discoverability | `alias_type: customer_term` exists in UI only | Same as aliases | Same as search | **No** | **Partial** |

---

## A. Alias Authority

### A.1 Where aliases are stored

| Store | Path / table | Role | Authoritative? |
|-------|--------------|------|----------------|
| **Master** | `public.product_aliases` | Approved alias rows per `product_id` | **Yes** (when row exists and `is_active`) |
| **Draft** | `public.catalogue_alias_drafts` | Contributor create/update/delete requests | Pre-approval only |
| **Draft JSON (product)** | `catalogue_product_drafts.payload.aliases.suggested_aliases` | Auto-filled `[product_name, short_name]` on product draft submit | **Not promoted** on product approve |
| **Legacy column** | `products.aliases` (array) | Referenced in `DataCorrection.tsx` search only | Central legacy; **not written by AliasManager** |
| **localStorage** | — | **None** for aliases | N/A |

**Schema drift (critical):**

| Layer | Column model |
|-------|--------------|
| AI Studio repo migrations (`supabase/migrations/20260506053901_…`) | `alias`, `normalized_alias` (generated), `alias_type`, `language`, `script`, `source`, `is_active`, `confidence_score` |
| AI Studio frontend (`AliasManager.tsx`, `types.ts`) | Writes `alias`, `alias_type`, etc. |
| Central approve mapping (`PR06C1_central_tag_alias_approve_mapping.sql`, `docs/PR06C_APPROVAL_MAPPING.md`) | `alias_text`, `canonical_name`, `product_id` only — **drops** `alias_type`, `language`, `is_active` on approve |
| Central cleanup scripts | Reference `alias_text`, `canonical_name` |

Until schemas are reconciled, the same table name (`product_aliases`) may mean **different shapes** on different environments.

### A.2 How aliases are created

| Path | UI | File | Behaviour |
|------|-----|------|-----------|
| **Manual** | Product Edit → Identity → "Aliases & search terms" | `src/components/AliasManager.tsx` | User enters `alias`, optional `language`, `alias_type` |
| **Seed generate** | "Generate basic" button | `AliasManager.tsx` `SEED_RULES` | Regex match on `productName` → deterministic suggestions (kunafa, pyramid, katori patterns only) |
| **Contributor product save** | Product Edit save | `ProductEdit.tsx` | Embeds `suggested_aliases: [product_name, short_name]` in product draft JSON only |
| **Category 1 import** | `/admin/import/category-1` | `buildDraftPayload.ts` | Same `suggested_aliases` auto-fill; **no alias column mapping** |
| **Bulk import** | — | — | **Does not exist** |

**Alias types supported in UI** (single enum, no separate WhatsApp type):

`common_name`, `misspelling`, `local_slang`, `authentic_name`, `hindi_name`, `arabic_name`, `turkish_name`, `old_name`, **`customer_term`**, **`salesman_term`**, `visual_description`, `ai_generated`

### A.3 How aliases are approved

```
Contributor                          Reviewer
    │                                    │
    ▼                                    ▼
submitCatalogueDraft({                  /approvals
  draftType: "alias",                   ApprovalInbox.tsx
  operation: create|update|delete_request
})                                     rpc: approve_catalogue_alias_draft(draft_id)
    │                                    │
    ▼                                    ▼
catalogue_alias_drafts                 approve_catalogue_draft_internal
(status: pending_approval)             (PR06C1 on Central — if deployed)
    │                                    │
    └────────────────────────────────────┴──▶ product_aliases
```

| Role | Approval needed? | Mechanism |
|------|------------------|-----------|
| `owner`, `admin`, `product_manager` | No | Direct `product_aliases` upsert/update/delete |
| `catalogue_contributor` | Yes | `catalogue_alias_drafts` → RPC approve |
| Read-only roles | N/A | Blocked |

**Gaps:**

- `PR06B_draft_approval_migration.sql` ships **stub** `approve_catalogue_alias_draft` that raises `Approval mapping not finalized`.
- Production Central is documented as using `PR06C1` mapping (`docs/SUPABASE_ENV_MAP.md`) — must be verified per environment.
- `ApprovalInbox` surfaces `approve_blocked_mapping_not_finalized` as a warning toast when RPC not finalized.
- **Contributor pending aliases are invisible** in `AliasManager` (only reads master table).

### A.4 Whether approved aliases reach master records

| Flow | Reaches `product_aliases`? | Notes |
|------|---------------------------|-------|
| Admin direct add | **Yes** | Immediate upsert on `(product_id, normalized_alias)` |
| Contributor draft + approve (PR06C1 deployed) | **Yes** | Inserts `alias_text` + `canonical_name` on Central |
| Contributor draft + approve (PR06B stub only) | **No** | RPC error |
| Product draft approve | **No** | `suggested_aliases` ignored |
| Category 1 import approve | **No** | Same as product draft |

### A.5 Whether aliases are searchable

| Consumer | Implementation | Status |
|----------|----------------|--------|
| **Products list** (`/products`) | `searchProductsWithAliases(q)` → RPC | **Broken on Central** if RPC missing or schema mismatch (`product_name` vs `name`, `alias` vs `alias_text`) |
| **Empty search** | Falls back to `products` select ordered by `product_name` | Misses Central `name` column |
| **RPC error** | Returns `[]` — **silent total failure** | `src/lib/productSearch.ts` logs error, no fallback |
| **Data Correction** | Client-side filter on `products.aliases` array + `name` | **Parallel legacy path**, not `product_aliases` |
| **Catalogue Builder** | Does not search aliases | N/A |
| **Product Truth** | No alias dimension | N/A |
| **Central sync snapshot** | No alias block in `CatalogueSnapshotJson` | N/A |

**RPC definition (repo migrations):** `search_products_with_aliases(_q)` — trigram/LIKE on `products.product_name`, `sku`, `short_name`, and `product_aliases.normalized_alias` where `is_active`.

### A.6 Whether aliases are used by Product Truth

**No.** `src/features/productTruth/` has zero alias references. Readiness dimensions cover content, media, pricing, UOM, packaging, compliance, MOQ — **not alias coverage**.

`CatalogueSnapshotJson` (`src/features/catalogueSnapshot/types.ts`) includes identity, pricing, media, compliance — **no `aliases` array**.

---

## B. WhatsApp Keyword Authority

### B.1 Existing keyword fields / tables

| Location | Field / concept | Scope |
|----------|-----------------|-------|
| `products` | — | **No** `whatsapp_keywords` or equivalent |
| `product_aliases` | Could use `alias_type = customer_term` | **Not distinguished** from other aliases in search or WhatsApp flows |
| `catalogues.proposal_whatsapp_message` | Catalogue-level proposal text | Legacy `/catalogues` only |
| `catalogue_collections` | `whatsapp_mini_catalogue` type | Collection metadata only |
| `generateWhatsAppMiniCatalogueText` | Generated from product **names** + prices + image URLs | Not from keywords |

### B.2 Existing keyword generation logic

| Mechanism | What it generates |
|-----------|-------------------|
| `AliasManager` SEED_RULES | Product-name regex → alias suggestions (kunafa, pyramid, katori) |
| Product draft auto | `[product_name, short_name]` in draft JSON only |
| WhatsApp mini catalogue | Bullet list from `CatalogueProductCard.name` |
| `whatsapp_business_api` | Integration test hook in `supabase/functions/test-integration` — **not product keywords** |

**No AI/LLM keyword generation.** No per-product WhatsApp lexicon.

### B.3 Existing keyword approval flow

**None.** Closest analogue is alias draft approval (`catalogue_alias_drafts`). There is no separate WhatsApp keyword draft type.

### B.4 Existing keyword storage

**None dedicated.** Operational workarounds today:

1. Store terms as `product_aliases` with `alias_type = customer_term` or `salesman_term` (manual).
2. Store catalogue-level copy in `proposal_whatsapp_message` (not per SKU).

### B.5 Whether keywords survive product edits

| Storage | Survives `products.name` edit? |
|---------|-------------------------------|
| `product_aliases` rows | **Yes** — FK to `product_id`, not name |
| `suggested_aliases` in draft JSON | N/A — not persisted to master |
| `products.aliases` array (legacy) | Unknown write path; not maintained by AliasManager |
| WhatsApp catalogue text | Regenerated on each preview — ephemeral |

### B.6 Support for example customer terms

Terms requested: *Cashew Kitta, Kitta, Cashew Diamond, Baklava, Baklawa, Baklava sweet, Arabic sweet, Cashew baklava*

| Term | Supported today? | How |
|------|------------------|-----|
| Baklava / Baklawa | **Partial** | Product `name`; SEED_RULES include "Baklava Pyramid" variants for pyramid products only |
| Cashew Pyramid / Kaju variants | **Partial** | SEED_RULES for pyramid/katori name patterns |
| **Kitta** | **No** | Not in SEED_RULES or any generator |
| **Cashew Kitta** | **No** | Not in SEED_RULES |
| **Cashew Diamond** | **No** | Not in SEED_RULES |
| **Baklava sweet** | **Manual only** | User must add as alias |
| **Arabic sweet** | **Manual only** | Generic category term — needs explicit alias rows per SKU |
| **Cashew baklava** | **Manual only** | — |

**Conclusion:** The platform **can store** these strings as aliases once entered, but **cannot auto-provision** them, **cannot tag them as WhatsApp-specific**, and **cannot search reliably** until RPC/schema issues are fixed.

---

## C. Search Architecture

### C.1 `search_products_with_aliases` RPC

**Defined in:** `supabase/migrations/20260506053901_36c80c2c-b58b-487e-ae25-a025980b33e9.sql` (and revision `20260506055900_…`)

**Behaviour:**

1. Normalize query via `normalize_alias(_q)`.
2. Match `products` by `product_name`, `sku`, `short_name` (trigram + LIKE).
3. UNION match `product_aliases.normalized_alias` where `is_active`.
4. Return top 50 by `match_score`, include `matched_alias` when alias hit.

**Central deployment gaps:**

| Issue | Impact |
|-------|--------|
| RPC not deployed on Central | Search returns `[]` for any query |
| RPC searches `product_name`; Central uses `name` | Name-only products invisible to RPC product leg |
| Central `product_aliases` may use `alias_text` not `alias` | Alias leg of RPC fails or empty |
| `pg_trgm` extension dependency | Migration failure if extension missing |

### C.2 Current fallback search

| Trigger | Fallback |
|---------|----------|
| RPC error | **None** — empty results (`productSearch.ts`) |
| Empty query string | Direct `products` select (50 rows, `product_name` order) |
| Data Correction page | In-memory filter on loaded rows including legacy `products.aliases` |
| Products list filters | Applied **after** RPC id set — if RPC fails, filtered list empty when searching |

**After PR #29:** Display uses `product_name ?? name` fallback, but **search RPC still does not**.

### C.3 Missing pieces

1. RPC deployed and aligned to Central column names (`name`, `alias_text` or unified schema).
2. Client-side fallback: direct query on `products.name` + `product_aliases` when RPC errors.
3. Search includes inactive-alias toggle for admins vs customers.
4. Alias coverage readiness gate in Product Truth.
5. Bulk alias import staging (Category 2).
6. Promotion of `suggested_aliases` on product approve.
7. Snapshot/export of active aliases for Central connector.
8. Pending-draft visibility for contributors.
9. Deduplication across global terms ("Baklawa") vs SKU-specific terms.
10. WhatsApp Business API matching layer (future).

### C.4 Whether Central can consume this later

**Yes, with schema contract work.**

| Approach | Fit |
|----------|-----|
| **Separate `product_aliases` table** (current direction) | Best — many-to-one terms per SKU, approval, soft-disable |
| **Embed in catalogue snapshot JSON** | Add `discoverability: { aliases: [...] }` block — **not implemented** |
| **Version aliases with `catalogue_versions`** | Recommended for audit trail; **not implemented** |
| **Live read from AI Studio** | Central could call search RPC or replicate table via sync webhook |

`ApprovedCatalogueProductSnapshot` today has **no alias fields** — Central order-taking cannot consume alias authority from sync preview yet.

---

## D. Product Authority Fit (Category 1)

For Category 1 products (identity/UOM/pack/compliance master):

| Term type | Current home | Should live in `products`? | Separate table? | Versioned? | Approval? |
|-----------|--------------|---------------------------|-----------------|------------|-----------|
| **Aliases** | Draft JSON hint only; manual post-approve | **No** (array on row does not scale) | **`product_aliases`** | Optional via `catalogue_versions` | **Yes** for contributors |
| **WhatsApp keywords** | Nowhere | **No** | **`product_aliases`** with `alias_type` or new `product_discoverability_terms` | Recommended | **Yes** |
| **Search terms** | Same as aliases | **No** | **`product_aliases`** | Optional | **Yes** |
| **Customer keywords** | `customer_term` alias type (UI only) | **No** | **`product_aliases`** or dedicated table | Recommended | **Yes** |

### Recommended model

```
products (Category 1)
  └── product_id (immutable)
        └── product_aliases (Category 2 discoverability)
              ├── alias_text / alias
              ├── alias_type (customer_term | salesman_term | …)
              ├── channel_scope (all | whatsapp | b2b_portal | …)  [future]
              ├── language, script, source, is_active
              └── approval via catalogue_alias_drafts
```

**Do not** store aliases on `products` row (legacy `aliases` array should be deprecated).  
**Do** version discoverability changes in `catalogue_versions` snapshot when Central sync goes live.  
**Do** require approval for all non-admin writes (already designed).

---

## Current state

### What works

- `AliasManager` UI on Product Edit Identity tab (manual + seed generate).
- Direct master write for admin roles with rich metadata (`alias_type`, language, etc.).
- Contributor draft submit to `catalogue_alias_drafts`.
- Approval inbox lists alias drafts.
- Repo-local RPC + `product_aliases` schema with trigram index (AI Studio migrations).
- Products list integrates alias-aware search **when RPC works**.
- UI copy correctly states: aliases are search helpers; SKU is system identity.

### What is broken or missing

- **Schema drift** between app (`alias`) and Central approve mapping (`alias_text`, `canonical_name`).
- **Approval drops metadata** (`alias_type`, `language`, `is_active`) per `PR06C_APPROVAL_MAPPING.md`.
- **Search RPC** likely broken or misaligned on Central production.
- **No RPC fallback** — failed search shows zero products.
- **`suggested_aliases` never promoted** from product/Category 1 drafts.
- **No bulk alias import**.
- **No WhatsApp keyword authority** — only collection-level text.
- **Product Truth / Central snapshot** exclude aliases.
- **SEED_RULES** cover ~3 product families; not Baklawa Kitta/Diamond vocabulary.
- **Dual search paths** (`product_aliases` vs `products.aliases` in Data Correction).

---

## Missing wiring

| From | To | Status |
|------|-----|--------|
| `AliasManager` | `catalogue_alias_drafts` | Wired (contributor) |
| `approve_catalogue_alias_draft` | `product_aliases` full schema | **Partial** (Central PR06C1) |
| `product_aliases` | `search_products_with_aliases` | **Broken on Central** |
| `search_products_with_aliases` | Products list | Wired but fails silently |
| `suggested_aliases` | `product_aliases` on product approve | **Not wired** |
| `product_aliases` | Product Truth readiness | **Not wired** |
| `product_aliases` | Central sync snapshot | **Not wired** |
| `customer_term` aliases | WhatsApp matching | **Not wired** |
| Category 1 CSV | Alias columns | **Not wired** |

---

## Recommended architecture

### Phase 1 — Unify schema (blocking)

Single `product_aliases` contract across AI Studio app, migrations, RPC, and Central approve:

| Column | Purpose |
|--------|---------|
| `id` | UUID PK |
| `product_id` | FK |
| `alias` | Display/search text (rename from `alias_text` on Central OR alias view) |
| `normalized_alias` | Generated, indexed |
| `alias_type` | Including `customer_term`, `whatsapp_keyword` (optional new enum value) |
| `language`, `script`, `source` | Provenance |
| `is_active` | Soft disable |
| `confidence_score` | AI suggestions |
| `created_by`, `created_at` | Audit |

Deprecate `canonical_name` as redundant with `products.name` (keep only if Central requires for denormalized search).

### Phase 2 — Search authority

1. Redeploy `search_products_with_aliases` matching live columns: `coalesce(product_name, name)`, active aliases only.
2. Add client fallback in `productSearch.ts` when RPC fails.
3. Return `matched_alias_type` for UI/analytics (optional).

### Phase 3 — Discoverability authority

1. Treat **WhatsApp keywords ⊆ aliases** with `alias_type IN ('customer_term', 'salesman_term')` **or** add `channel_scope = 'whatsapp'`.
2. Add Product Truth dimension: "Discoverability" (% SKUs with ≥N active customer terms).
3. Include `active_aliases[]` in `CatalogueSnapshotJson` for Central export.

### Phase 4 — Operational workflows

1. Category 2 alias import staging (`catalogue_alias_drafts` bulk).
2. Auto-promote `suggested_aliases` on product approve (optional flag).
3. Contributor pending-alias panel in AliasManager.
4. Extend SEED_RULES or rules engine for Baklawa shape vocabulary (Kitta, Diamond, rolls, etc.).

---

## Safe migration path

| Step | Action | Risk |
|------|--------|------|
| 1 | **Read-only schema audit** on Central: `product_aliases` columns, RPC existence, sample search | None |
| 2 | **Align RPC** to `name` + unified alias column — deploy on Central staging | Low if read-only test first |
| 3 | **Update PR06C1 approve mapping** to write full alias metadata | Medium — test with staging drafts |
| 4 | **Client fallback search** — no DB change | Low |
| 5 | **Backfill aliases** for Batch 001 SKUs via admin direct write or alias draft batch | Low — manual review |
| 6 | **Deprecate `products.aliases`** array reads in Data Correction | Low |
| 7 | **Add snapshot alias block** + Central connector field | Medium — coordinated release |
| 8 | **WhatsApp keyword policy** documented as alias_type convention (no new table until needed) | None |

**Do not** enable Central live sync until snapshot includes aliases and schema is unified.

---

## Top 10 fixes (priority order)

| # | Fix | Why |
|---|-----|-----|
| 1 | **Schema reconciliation** — single `product_aliases` shape (`alias` vs `alias_text`) across app, RPC, approve RPC | Unblocks all authority claims |
| 2 | **Deploy/fix `search_products_with_aliases` on Central** — search `name` + correct alias column | Makes aliases actually discoverable |
| 3 | **Client search fallback** when RPC errors (query `products` + `product_aliases` directly) | Prevents silent empty search |
| 4 | **Extend approve mapping** to persist `alias_type`, `language`, `is_active`, `source` | Preserves contributor intent |
| 5 | **Promote `suggested_aliases` on product draft approve** (optional auto-insert as `common_name`) | Closes Category 1 → search gap |
| 6 | **Add aliases to `CatalogueSnapshotJson`** for Central sync preview | Enables Central consumption |
| 7 | **Product Truth discoverability dimension** (alias count / customer_term coverage) | Governance for authority UI |
| 8 | **Category 2 bulk alias import staging** | Operational scale for 300+ SKUs |
| 9 | **Expand SEED_RULES / rules for Baklawa vocabulary** (Kitta, Diamond, sweet, etc.) | Faster onboarding of example terms |
| 10 | **Document WhatsApp keywords as `customer_term` aliases** + future `channel_scope` | Single authority model without new table sprawl |

---

## Can AI Studio be single source of truth?

| Question | Answer |
|----------|--------|
| Product aliases | **Eventually yes** — UI and table design exist; production Central wiring incomplete |
| WhatsApp keywords | **Not without policy** — use alias types or new table; no dedicated flow today |
| Search terms | **Same as aliases** — one table, one RPC, one approval path |
| Customer discoverability | **Partial** — `customer_term` type in UI; not enforced, not in sync, not in WhatsApp matcher |

**Minimum bar for "single source of truth" declaration:**

1. Unified `product_aliases` schema on Central  
2. Working `search_products_with_aliases`  
3. Full-metadata alias approval  
4. Aliases in versioned Central export  
5. Documented WhatsApp keyword = alias convention (or dedicated table)  
6. Category 2 bulk import for backfill  

Until then, authority is **split** across `product_aliases`, legacy `products.aliases`, draft JSON hints, and catalogue-level WhatsApp messages.

---

## Key file reference

| Area | Path |
|------|------|
| Alias UI | `src/components/AliasManager.tsx` |
| Product search | `src/lib/productSearch.ts` |
| Products list consumer | `src/pages/Products.tsx` |
| Draft submit | `src/features/catalogueDrafts/draftService.ts`, `draftTableMap.ts` |
| Approvals | `src/features/approvals/ApprovalInbox.tsx` |
| Category 1 suggested aliases | `src/features/category1Import/buildDraftPayload.ts` |
| Product draft suggested aliases | `src/pages/ProductEdit.tsx` |
| Legacy aliases array search | `src/pages/DataCorrection.tsx` |
| RPC migration | `supabase/migrations/20260506053901_36c80c2c-b58b-487e-ae25-a025980b33e9.sql` |
| Central approve mapping | `scripts/supabase/PR06C1_central_tag_alias_approve_mapping.sql` |
| Mapping docs | `docs/PR06C_APPROVAL_MAPPING.md` |
| Snapshot types (no aliases) | `src/features/catalogueSnapshot/types.ts` |
| WhatsApp catalogue text | `src/features/catalogueBuilder/whatsappPreview.ts` |

---

## Confirmation

This audit was **read-only**:

- No application code changed (except adding this document)
- No SQL or migrations created or applied
- No product data modified
- No drafts submitted
- No approvals executed
- Central sync not enabled
