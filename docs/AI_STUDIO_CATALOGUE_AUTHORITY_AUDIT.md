# Oasis AI Studio — Catalogue Authority Reality Audit

**Audit date:** 2026-06-09  
**Repo:** Oasis AI Studio (Vite + React Router SPA)  
**Auditor scope:** Read-only code/doc review — no code, SQL, migrations, or Supabase changes were made.

**Verdict (executive):** **PARTIAL** — This repo has substantial product-master and draft-approval UI wired to Oasis Central Supabase, but it is **not yet safe as the sole Catalogue Authority** due to missing import pipeline, unwired authority modules, dual catalogue systems, schema/type drift, localStorage fallbacks on write paths, and preview-only Central sync.

---

## Audit methodology

- Static analysis of `src/`, `supabase/`, `scripts/supabase/`, and `docs/`
- Route inventory from `src/App.tsx`
- Supabase usage traced via `.from()`, `.rpc()`, `storage`, and `functions.invoke`
- No runtime DB queries, no migration application, no live environment testing

---

## Shared Supabase connection / config

| Item | Path | Reality |
|------|------|---------|
| Canonical client | `src/shared/supabase/client.ts` | `createClient<Database>()` with `localStorage` session |
| Env guard | `src/shared/supabase/env.ts` | Requires `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`; rejects non-`*.supabase.co` and Lovable URLs |
| Compatibility shim | `src/integrations/supabase/client.ts` | Re-exports shared client (29+ import sites) |
| Generated types | `src/integrations/supabase/types.ts` | **Stale** — missing draft tables, collections, versions, permission RPCs |
| Project ref guard | `src/shared/supabase/health.ts` | `assertExpectedProjectRef("tcxvcatsqqertcnycuop")` documented, not enforced at boot |
| Documented Central target | `docs/CENTRAL_SUPABASE_CHECKLIST.md` | Project ref `tcxvcatsqqertcnycuop` (Oasis Central) |
| Local CLI config drift | `supabase/config.toml` | `project_id = "wgajrxyoararisiwjzox"` (legacy Lovable lineage) |

**Reads Supabase:** YES (all app data)  
**Writes Supabase:** YES (browser client direct writes + RPC)  
**Safe as catalogue authority:** PARTIAL — single shared anon/publishable-key client with RLS-dependent safety; no service-role in frontend (good), but direct master writes remain for privileged roles.

---

## Module audit table

### 1. Product master screens

| # | Route | Component / file | Reads SB | Writes SB | Tables / RPCs | Mock/demo | Approval | Safe authority | Missing stitching | Risk |
|---|-------|------------------|----------|-----------|---------------|-----------|----------|----------------|-------------------|------|
| 1 | `/products` | `src/pages/Products.tsx` | YES | NO | `products`, `sku_code_rules`, `product_moq_rules`, `product_pricing_rules` | NO | NO | PARTIAL | Alias search via separate helper; no bulk export | LOW |
| 2 | `/products/new`, `/products/:id` | `src/pages/ProductEdit.tsx` | YES | YES | `products`; draft: `catalogue_product_drafts` | localStorage tab/form draft | PARTIAL (draft path) | PARTIAL | `ProductTruthAdminSection` not mounted; compliance strip on direct save only | **HIGH** |
| 3 | (embedded) | `src/components/SkuBuilder.tsx` | YES | YES | `sku_code_rules`; RPC `generate_oasis_sku` | NO | NO | PARTIAL | SKU rules read-only in UI | LOW |
| 4 | (embedded) | `src/components/AliasManager.tsx` | YES | YES | `product_aliases`; draft: `catalogue_alias_drafts` | `SEED_RULES` suggestions (deterministic, not AI) | YES (draft) | PARTIAL | Approve RPC must exist on Central | MEDIUM |
| 5 | (embedded) | `src/components/BomBuilder.tsx` | YES | YES | `product_bom` (not `product_bom_items` in types); draft: `catalogue_bom_drafts` | NO | YES (draft) | PARTIAL | Table name mismatch vs migrations/types | **HIGH** |
| 6 | (embedded) | `src/components/ChannelMoqRules.tsx` | YES | YES | `product_moq_rules`; draft: `catalogue_moq_drafts` → target `moq_rules` | NO | YES (draft) | PARTIAL | Central target `moq_rules` mapping unverified in types | MEDIUM |
| 7 | (embedded) | `src/components/ChannelPricingRules.tsx` | YES | YES | `product_pricing_rules`; draft: `catalogue_pricing_drafts` → target `pricing_slabs` | NO | PARTIAL (in-master `approval_status` + draft) | PARTIAL | `pricing_slabs` compatibility noted as open in PR-05 | **HIGH** |
| 8 | (embedded) | `src/components/ProductMediaUploader.tsx` | YES | YES | `product_media`, `products`; storage `product-media`; draft: `catalogue_media_submissions` | NO | YES (draft) | PARTIAL | Media readiness engine exists but panel not on ProductEdit route | MEDIUM |
| 9 | (banner) | `src/components/CatalogueWriteModeBanner.tsx` | YES | NO | RPCs via `centralPermissions` | NO | N/A | PARTIAL | Surfaces direct/draft/readonly modes | LOW |

**Write-mode model:** `direct` (super_admin / legacy roles via `canWriteMasterDirectly`) | `draft` (`catalogue_contributor` + permission) | `readonly`.

---

### 2. Catalogue import / upload screens

| # | Route | Component / file | Reads SB | Writes SB | Tables / RPCs | Mock/demo | Approval | Safe authority | Missing stitching | Risk |
|---|-------|------------------|----------|-----------|---------------|-----------|----------|----------------|-------------------|------|
| 10 | *(none)* | Catalogue bulk import | NO | NO | `import_logs` in types only; `bulk_pdf_import` feature flag seeded | N/A | NO | **NO** | Entire import UI, extractor, staging tables, review queue | **CRITICAL** |
| 11 | `/media` | `src/pages/Media.tsx` | YES | YES | `product_media`, `products`; storage `product-media`; draft path | NO | YES (draft) | PARTIAL | Media library ≠ catalogue import | MEDIUM |
| 12 | `/settings` | `src/pages/Settings.tsx` (feature flags) | YES | YES | `feature_flags`, `feature_activation_audit`, `integration_settings` | NO | NO | NO | `bulk_pdf_import` status = **planned** only | LOW |
| 13 | `/testing` | `src/pages/Testing.tsx` | PARTIAL | YES | storage `product-media` | localStorage checklist | NO | NO | QA harness, not production import | LOW |

**Finding:** No CSV/PDF catalogue import screen exists. `bulk_pdf_import` is a planned feature flag (`supabase/migrations/...sql`) with stub handler in `supabase/functions/test-integration/index.ts` only.

---

### 3. AI catalogue builder screens

| # | Route | Component / file | Reads SB | Writes SB | Tables / RPCs | Mock/demo | Approval | Safe authority | Missing stitching | Risk |
|---|-------|------------------|----------|-----------|---------------|-----------|----------|----------------|-------------------|------|
| 14 | `/admin/catalogue-builder` | `src/pages/CatalogueBuilder.tsx` | YES | YES | `products` (picker); via store: `catalogue_collections`, `catalogue_collection_items`, `catalogue_share_links` | **YES** — `complianceApproved: true` hardcoded; empty channel prices in preview | NO | **NO** | Not linked to branded `catalogues` flow; localStorage fallback | **HIGH** |
| 15 | — | `src/features/catalogueBuilder/collectionStore.ts` | YES | YES | Same as above | **YES** — localStorage fallback for collections/items/shares | NO | NO | Silent fallback masks DB failures | **HIGH** |
| 16 | `/ai-studio` | `src/pages/AIStudio.tsx` | NO | NO | — | **YES** — static roadmap steps | NO | **NO** | No AI backend; marketing page only | LOW |
| 17 | `/` (cards) | `src/pages/Dashboard.tsx` | YES | NO | `products`, `product_media`, etc. | Static “planned” AI cards | NO | NO | Dashboard stats only | LOW |

**Finding:** “AI Catalogue Builder” is a **manual collection composer** (drag products, PDF/WhatsApp export), not an AI pipeline. `AIStudio` is a static roadmap.

---

### 4. Alias / tag / keyword screens

| # | Route | Component / file | Reads SB | Writes SB | Tables / RPCs | Mock/demo | Approval | Safe authority | Missing stitching | Risk |
|---|-------|------------------|----------|-----------|---------------|-----------|----------|----------------|-------------------|------|
| 18 | `/tags` | `src/pages/Tags.tsx` | YES | YES | `tags`; draft: `catalogue_tag_drafts` → `product_tag_mapping` | NO | YES (draft) | PARTIAL | No product↔tag assignment UI; `product_tags` table unused | **HIGH** |
| 19 | (shared) | `src/lib/productSearch.ts`, `src/components/ProductPicker.tsx` | YES | NO | `products`; RPC `search_products_with_aliases` | NO | NO | PARTIAL | Search only | LOW |
| 20 | *(none)* | Keywords | NO | NO | — | — | NO | **NO** | **No keyword entity or screen anywhere in `src/`** | MEDIUM |

---

### 5. Approval / review workflow

| # | Route | Component / file | Reads SB | Writes SB | Tables / RPCs | Mock/demo | Approval | Safe authority | Missing stitching | Risk |
|---|-------|------------------|----------|-----------|---------------|-----------|----------|----------------|-------------------|------|
| 21 | `/approvals` | `src/features/approvals/ApprovalInbox.tsx` | YES | YES | 7 draft tables; 14 approve/reject RPCs | NO | **YES** | PARTIAL | Draft tables in `scripts/supabase/` not in repo migrations; RPC deployment status unknown | **HIGH** |
| 22 | `/catalogues/:id` | `src/pages/CatalogueDetail.tsx` | YES | YES | `catalogues`, `catalogue_products` | NO | PARTIAL (status machine) | PARTIAL | `draft`→`internal_review`→`published` is role-gated, not draft-table based | MEDIUM |
| 23 | `/data-correction` | `src/pages/DataCorrection.tsx` | YES | YES | `products` (direct update for fixes) | **YES** — `localStorage` reviewed flags | PARTIAL (local only) | **NO** | Review state not persisted to DB | **HIGH** |
| 24 | (unwired) | `src/features/productTruth/ProductTruthAdminSection.tsx` | YES | YES | `catalogue_versions`, `catalogue_sync_events` | localStorage version fallback | PARTIAL | NO | **Not mounted on any route** | **HIGH** |
| 25 | (unwired) | `src/features/catalogueSnapshot/panels/CentralSyncPreviewPanel.tsx` | YES | PARTIAL | sync preview only | `LIVE_CENTRAL_WRITE_ENABLED = false` | PARTIAL | NO | Preview never POSTs to Central | **HIGH** |
| 26 | (unwired) | `src/features/compliance/ComplianceAiPanel.tsx` | YES | NO | edge fn `generate-product-attributes` | Heuristic AI in edge fn | PARTIAL (client meta) | NO | Panel not mounted; edge fn returns suggestions only | MEDIUM |

**Three parallel review models:**
1. Contributor → draft tables → Approval Inbox → approve/reject RPCs → master
2. Catalogue publish status on `catalogues` (direct update by `catalogues_write` role)
3. Direct master writes for privileged roles (bypasses drafts)

---

### 6–7. Branded catalogues & public consumption (Oasis Central downstream)

| # | Route | Component / file | Reads SB | Writes SB | Tables / RPCs | Mock/demo | Approval | Safe authority | Missing stitching | Risk |
|---|-------|------------------|----------|-----------|---------------|-----------|----------|----------------|-------------------|------|
| 27 | `/catalogues` | `src/pages/Catalogues.tsx` | YES | YES | `catalogues` insert | NO | NO | PARTIAL | Separate from `catalogue_collections` builder | MEDIUM |
| 28 | `/catalogues/:id/proposal` | `src/pages/CatalogueProposal.tsx` | YES | NO | `catalogues`, `catalogue_products`; RPC `get_public_catalogue_channel_data` | NO | NO | PARTIAL | Read-only proposal view | LOW |
| 29 | `/c/:slug` | `src/pages/PublicCatalogue.tsx` | YES | NO | Same as proposal | NO | NO (consumer) | PARTIAL | Published catalogues only (`status === published`) | LOW |
| 30 | — | `src/features/catalogueSnapshot/centralSyncPayload.ts` | N/A | NO | — | Preview-only bundle | NO | **NO** | `LIVE_CENTRAL_WRITE_ENABLED = false`; no outbound Central API | **CRITICAL** |

**Oasis Central consumption (visible in repo):**
- Reads product master, aliases, pricing/MOQ, media, catalogues via shared Supabase project
- Public channel data via `get_public_catalogue_channel_data`
- Governed outbound sync uses the canonical `oasis.catalogue.publication.v1` server envelope. The
  browser does not write to Central; the canonical backend creates an immutable pending event for
  the Central intake connector.
- `test-integration` edge fn checks `oasis_central_sync` integration config (secrets `OASIS_CENTRAL_URL`, `OASIS_CENTRAL_TOKEN`) but does not push catalogue data

---

### 8–10. Adjacent write surfaces (not core authority but production writes)

| # | Route | Component / file | Reads SB | Writes SB | Risk |
|---|-------|------------------|----------|-----------|------|
| 31 | `/ingredients` | `src/pages/Ingredients.tsx` | YES | YES | MEDIUM — master writes |
| 32 | `/labels`, `/label-queue` | `src/pages/Labels.tsx`, `LabelQueue.tsx` | YES | YES | MEDIUM — label domain |
| 33 | `/hampers` | `src/pages/Hampers.tsx` | YES | YES | LOW |
| 34 | `/audit-log` | `src/pages/AuditLog.tsx` | YES | NO | LOW |
| 35 | edge fn | `supabase/functions/test-integration/index.ts` | YES | YES (service role) | MEDIUM — `feature_flags`, `integration_settings` |

---

## Supabase tables & RPCs inventory (catalogue-relevant)

### Master tables (direct R/W from app)

`products`, `product_aliases`, `product_media`, `product_bom`, `product_moq_rules`, `product_pricing_rules`, `tags`, `catalogues`, `catalogue_products`, `sku_code_rules`

### Draft / approval tables (app code; SQL in `scripts/supabase/`, not tracked migrations)

| Draft table | Approve RPC | Reject RPC | Target (per `draftTableMap`) |
|-------------|-------------|------------|------------------------------|
| `catalogue_product_drafts` | `approve_catalogue_product_draft` | `reject_catalogue_product_draft` | `products` |
| `catalogue_media_submissions` | `approve_catalogue_media_submission` | `reject_catalogue_media_submission` | `products` |
| `catalogue_alias_drafts` | `approve_catalogue_alias_draft` | `reject_catalogue_alias_draft` | `product_aliases` |
| `catalogue_bom_drafts` | `approve_catalogue_bom_draft` | `reject_catalogue_bom_draft` | `product_bom` |
| `catalogue_moq_drafts` | `approve_catalogue_moq_draft` | `reject_catalogue_moq_draft` | `moq_rules` |
| `catalogue_pricing_drafts` | `approve_catalogue_pricing_draft` | `reject_catalogue_pricing_draft` | `pricing_slabs` |
| `catalogue_tag_drafts` | `approve_catalogue_tag_draft` | `reject_catalogue_tag_draft` | `product_tag_mapping` |

### Versioning / builder tables (migrations exist; types missing)

`catalogue_versions`, `catalogue_sync_events`, `catalogue_collections`, `catalogue_collection_items`, `catalogue_share_links`

### In schema but unused by frontend

`product_tags`, `share_links`, `ai_generation_jobs`, `import_logs`, `product_bom_items` (types name; code uses `product_bom`)

### Auth / permission RPCs

`get_current_user_roles`, `get_my_role_keys`, `has_catalogue_permission`, `is_catalogue_reviewer`, `search_products_with_aliases`, `generate_oasis_sku`, `get_public_catalogue_channel_data`

### Storage

`product-media` bucket — direct and staging uploads

---

## A. Existing usable catalogue modules

| Module | Usability | Notes |
|--------|-----------|-------|
| Product list + edit | **Usable** | Richest master editor; draft boundary for contributors |
| Alias manager | **Usable** | Direct + draft paths; seed suggestions |
| BOM / MOQ / pricing tabs | **Usable with caveats** | Schema mapping gaps to Central (`product_bom`, `moq_rules`, `pricing_slabs`) |
| Media library + per-product uploader | **Usable** | Draft boundary works; readiness panel unwired |
| Tags vocabulary CRUD | **Usable** | Global tags only — no product mapping UI |
| Approval inbox | **Usable if RPCs deployed** | 7-type unified queue; depends on Central SQL scripts |
| Branded catalogues + public share | **Usable** | Mature publish workflow on `catalogues` |
| Product search (alias-aware) | **Usable** | RPC `search_products_with_aliases` |
| Draft service layer | **Usable** | `draftService.ts`, `draftTableMap.ts`, `useDraftSubmit.ts` |

---

## B. Mock / demo / local-only modules

| Module | Evidence |
|--------|----------|
| AI Studio roadmap (`/ai-studio`) | Static `steps` array, no API |
| Dashboard AI cards | “Planned” features only |
| Catalogue Builder compliance preview | `complianceApproved: true` hardcoded in `CatalogueBuilder.tsx` |
| Collection store | localStorage fallback when Supabase empty/errors |
| Version store | localStorage fallback; `updateCatalogueVersionSnapshot` local-only |
| Data Correction reviewed flags | `localStorage` key `oasis_data_correction_reviewed_v1` |
| ProductEdit form persistence | localStorage tab/draft keys (UX only) |
| Testing page | localStorage checklist + PDF test uploads |
| Central sync | `preview_only: true`, `LIVE_CENTRAL_WRITE_ENABLED = false` |
| Share URL placeholder | `catalogue.oasis.example` when no `window` |
| Compliance AI edge fn | Heuristic suggestions, not production LLM pipeline |

---

## C. Live write paths (production-capable today)

All writes go through browser Supabase client (RLS-dependent). No server-side API layer.

| Path | Who | Target |
|------|-----|--------|
| Direct master CRUD | `super_admin` + legacy roles (`owner`, `admin`, `product_manager`, etc.) | `products`, `product_aliases`, `product_bom`, `product_moq_rules`, `product_pricing_rules`, `product_media`, `tags`, `catalogues`, `catalogue_products`, `ingredients`, `labels`, `hampers` |
| Contributor drafts | `catalogue_contributor` + permission keys | 7 `catalogue_*_drafts` / `catalogue_media_submissions` tables |
| Reviewer promotion | Catalogue reviewer | 14 approve/reject RPCs |
| Catalogue publish | `catalogues_write` role | `catalogues.status` transitions |
| Data correction | `data_correction` role | Direct `products` update |
| Settings admin | Owner/admin | `feature_flags`, `products`/`product_media` cleanup, audit log |
| Collection builder | Catalogue role | `catalogue_collections*` (+ localStorage fallback) |
| Versioning (partial) | Unwired UI | `catalogue_versions` insert/update, `catalogue_sync_events` insert |
| Edge function | Service role | `test-integration` mutates integration/flag tables |

**Risk:** Privileged roles can still bypass draft workflow entirely via direct master writes.

---

## D. Missing tables / RPCs / stitching

| Gap | Severity |
|-----|----------|
| Catalogue import UI + `import_logs` integration | CRITICAL |
| Draft/approval tables + RPCs not in `supabase/migrations/` (only `scripts/supabase/PR06*.sql`) | CRITICAL |
| `types.ts` not regenerated — widespread `(supabase as any)` | HIGH |
| `product_bom` vs `product_bom_items` naming mismatch | HIGH |
| `product_tags` / `product_tag_mapping` assignment UI missing | HIGH |
| `moq_rules` / `pricing_slabs` Central targets — approve mapping unverified in app types | HIGH |
| Live Central outbound sync (POST/publish) | CRITICAL |
| `ProductTruthAdminSection` + `CentralSyncPreviewPanel` unwired | HIGH |
| `ComplianceAiPanel` unwired | MEDIUM |
| Dual catalogue systems (`catalogues` vs `catalogue_collections`) unmerged | HIGH |
| Keywords domain entirely absent | MEDIUM |
| `catalogue_approval_audit` table in SQL scripts, unused in frontend | LOW |
| `supabase/config.toml` project_id ≠ documented Central ref | MEDIUM |
| No keyword search entity | MEDIUM |

---

## E. Recommended safest next PR

**PR: Regenerate types + wire Product Truth admin + enforce draft-only for contributors (no new features)**

Rationale: Highest leverage with lowest blast radius before claiming authority status.

1. **Regenerate `src/integrations/supabase/types.ts`** from Central project `tcxvcatsqqertcnycuop` (read-only gen) — removes `(supabase as any)` blind spots
2. **Mount `ProductTruthAdminSection`** on `/products/:id` (or dedicated `/admin/product-truth/:id`) — exposes versioned snapshots and Central sync preview already built
3. **Remove or gate localStorage write fallbacks** in `collectionStore.ts` and `catalogueVersionStore.ts` behind explicit dev flag — prevents silent non-authoritative state
4. **Verify PR06 draft tables + RPCs exist on Central** via schema audit (`scripts/supabase/schema-audit.sql`) — document pass/fail only; do not apply SQL in app PR
5. **Do not enable `LIVE_CENTRAL_WRITE_ENABLED`** until outbound connector is reviewed

This PR does **not** add import, AI, or new tables — it stitches existing authority code to routes and closes type/safety gaps.

---

## F. Category 1 / 2 / 3 authority files — import here first?

**Repo finding:** No files, docs, or code references define “Category 1/2/3 authority files” in this repository. Interpretation below is inferred from module maturity and `docs/PR_SEQUENCE.md` (PR-10 = data import).

| Inferred tier | Likely content | Import here first? | Rationale |
|---------------|----------------|--------------------|-----------|
| **Category 1** | Product master truth — SKU, identity, department, UOM, compliance, aliases, BOM | **YES — first** | `ProductEdit` + draft approval are the most complete authority surfaces; Central sync snapshot targets this layer |
| **Category 2** | Commercial rules — channel pricing, MOQ, tags/mappings | **Second** | UI exists but Central mapping (`pricing_slabs`, `moq_rules`, `product_tag_mapping`) is unverified; high schema risk |
| **Category 3** | Published catalogue compositions — branded catalogues, collections, share links | **Third** | Two parallel systems; builder uses localStorage fallback; not safe as authority until Cat 1/2 are canonical |

**Recommendation:** Import **Category 1 authority data first** into this app (or validate it already lives in Central `products` + related master tables). Defer Category 2 until approve RPC → Central table mapping is confirmed. Defer Category 3 until `catalogues` and `catalogue_collections` are unified under one publish model.

---

## Overall suitability matrix

| Criterion | Status |
|-----------|--------|
| Product master editing | PARTIAL |
| Catalogue import | NO |
| AI catalogue builder | NO (manual builder only) |
| Alias/tag management | PARTIAL (no keywords, no product-tag UI) |
| Approval workflow | PARTIAL (built; deployment + bypass risk) |
| Central as single source of truth | PARTIAL (shared DB; no live outbound sync) |
| Safe as sole Catalogue Authority | **NO** (today) |
| Path to authority with stitching PRs | **YES** (with PR sequence above) |

---

## Audit confirmation

- **Code changed:** NO  
- **SQL applied:** NO  
- **Migrations created/applied:** NO  
- **Supabase modified:** NO  
- **Deliverable:** This document only

**Modules audited:** 35 (30 catalogue-scoped + 5 adjacent write surfaces)
