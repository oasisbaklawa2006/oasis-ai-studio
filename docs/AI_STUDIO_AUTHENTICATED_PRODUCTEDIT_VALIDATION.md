# AI Studio — Authenticated ProductEdit Validation

_Validation run: 2026-03-28 · Repo: `oasis-ai-studio` · Branch: `main` · Commit: `bdc66c9`_

## Executive summary

| Item | Result |
|------|--------|
| Production blank-screen fix (`COMPLIANCE_APPROVER`) | **FIXED** — `permissions.ts` imports `COMPLIANCE_APPROVER_ROLES` from `@/shared/ai/complianceConstants` |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** (2245 modules, no compile errors) |
| `npm test` | **PASS** (15 files, 81 tests) |
| ProductEdit overall | **PARTIAL GO** |
| Ready as primary Product PIM now? | **PARTIAL** — catalogue authoring works; compliance AI panel unwired; Central live sync disabled |

### Validation method

This report combines:

1. **Boot / build verification** — confirms the production `ReferenceError: COMPLIANCE_APPROVER is not defined` is resolved.
2. **Static route & component audit** — maps each requested flow to code paths, Supabase tables, and role gates.
3. **Unit / engine tests** — 81 passing tests covering Product Truth, aliases, media readiness, catalogue builder, drafts, compliance safety.
4. **Live authenticated UI** — **not executed in this session** (no browser session or production credentials in the agent environment). Items marked **LIVE UNVERIFIED** require a human smoke pass in production/staging with an authenticated `owner` / `admin` / `product_manager` account.

No destructive writes, SQL, migrations, or dev-server startup were performed.

---

## Production recovery (prerequisite)

| Check | Status |
|-------|--------|
| Repo confirmed | `oasisbaklawa2006/oasis-ai-studio` |
| File | `src/lib/permissions.ts` |
| Fix | `compliance_approve: COMPLIANCE_APPROVER_ROLES` (imported from `@/shared/ai/complianceConstants`) |
| Undefined `COMPLIANCE_APPROVER` references | **None** in codebase |
| Commit | `bdc66c94f34beeea68f046bc069ee1036f3b06ae` |
| Push | `origin/main` up to date |

---

## Routes tested

| # | Route | Component | Role gate | Static audit | Live auth |
|---|-------|-----------|-----------|--------------|-----------|
| 1 | `/products` | `Products.tsx` | `products` | OK — list + search + filters | LIVE UNVERIFIED |
| 2 | `/products/:id` | `ProductEdit.tsx` | `products` | OK — full tab shell | LIVE UNVERIFIED |
| 3 | `/media` | `Media.tsx` | `media` | OK — global media library | LIVE UNVERIFIED |
| 4 | `/approvals` | `ApprovalInbox` | none (reviewer RPC) | OK — 7 draft sources | LIVE UNVERIFIED |
| 5 | `/admin/catalogue-builder` | `CatalogueBuilder.tsx` | `catalogues` | OK — collections + PDF/WhatsApp | LIVE UNVERIFIED |
| 6 | `/labels` | `Labels.tsx` | `labels` | OK — Label Studio | LIVE UNVERIFIED |
| 7 | `/label-queue` | `LabelQueue.tsx` | `labels` | OK — queue filters | LIVE UNVERIFIED |
| 8 | `/admin/import/category-1` | `Category1ImportStaging.tsx` | `category1_import` | OK — parse + staging | LIVE UNVERIFIED |
| 9 | `/data-correction` | `DataCorrection.tsx` | `data_correction` | OK — gap filters | LIVE UNVERIFIED |
| 10 | `/ai-studio` | `AIStudio.tsx` | `ai_studio` | OK — roadmap only | LIVE UNVERIFIED |

---

## ProductEdit flow checklist (20 items)

### Core navigation & identity

| # | Flow | Static result | Notes |
|---|------|---------------|-------|
| 1 | Products list loads | **EXPECTED OK** | `Products` queries `products` via Supabase; alias search via `searchProductsWithAliases`. |
| 2 | Open existing product | **EXPECTED OK** | Route `/products/:id`; loads `products` row, maps via `dbProductToForm`. |
| 3 | ProductEdit tabs render | **EXPECTED OK** | Tabs: Identity, UOM/MOQ, Media (existing only), Private Label, Customisation, Dimensions, Frozen, BOM, Business Rules, Compliance, Ops Notes, Product Truth. Conditional tabs depend on `product_class` / department. |
| 4 | Identity fields load | **EXPECTED OK** | Name, class, type, category, departments, descriptions, `SkuBuilder`. |
| 5 | SKU / UOM / MOQ fields load | **EXPECTED OK** | UOM tab: primary/B2B/retail UOM, primary packing, MOQ rule type/value/UOM, carton logic. Data mapped from legacy `products` columns. |
| 6 | Packaging fields load | **EXPECTED OK** | Primary pack type/UOM, qty per pack, content UOM, preview string, carton/master carton (non-contributor). |

### Media & aliases

| # | Flow | Static result | Notes |
|---|------|---------------|-------|
| 7 | Media Library opens | **EXPECTED OK** | Global `/media` route; per-product Media tab uses `ProductMediaUploader`. |
| 8 | Product media uploader | **PARTIAL** | `ProductMediaUploader` supports direct upload (admin/PM) or draft submission (contributor). **Blocker risk:** Supabase storage bucket / RLS must be configured; contributor path returns pending-approval notice. |
| 9 | Alias section loads | **EXPECTED OK** | `AliasManager` on Identity tab (existing products only); typed term tabs. |
| 10 | Alias generation | **EXPECTED OK (heuristic)** | "Generate basic" uses `SEED_RULES` regex heuristics — not LLM. Writes direct or via `catalogue_alias_drafts` depending on role. |

### Compliance, nutrition, Product Truth

| # | Flow | Static result | Notes |
|---|------|---------------|-------|
| 11 | Compliance AI panel | **NOT WIRED** | `ComplianceAiPanel` exists (`src/features/compliance/ComplianceAiPanel.tsx`) but is **not imported** in `ProductEdit.tsx`. Compliance tab is manual fields only (ingredients, allergens, nutrition textarea, HSN/GST). Edge fn `generate-product-attributes` exists but panel not mounted. |
| 12 | Nutrition / ingredients | **EXPECTED OK** | Compliance tab textareas; data from `products.ingredients`, `allergen_warnings`, `nutritional_info`. No structured nutrition panel editor on ProductEdit (Label Studio has `nutrition_panels`). |
| 13 | Product Truth readiness | **EXPECTED OK** | Product Truth tab → `ProductTruthAdminSection` with readiness, language, media, UOM, packaging, channels, preview, Central sync preview. Engine tests pass. |

### Drafts & catalogue workflows

| # | Flow | Static result | Notes |
|---|------|---------------|-------|
| 14 | Draft submission flow | **EXPECTED OK** | Contributors call `submitCatalogueDraft` → `catalogue_product_drafts`. Admins with `canWriteMasterDirectly` save to `products` directly with `stripUnapprovedComplianceFields`. |
| 15 | Approval Inbox | **EXPECTED OK** | Loads from 7 draft tables; approve/reject RPCs per type. Requires `isCatalogueReviewer()`. |
| 16 | Catalogue Builder | **EXPECTED OK** | Collections, WhatsApp text, PDF export; DB or localStorage fallback. Publishability engine tested. |
| 17 | Label Studio / Label Queue | **EXPECTED OK** | `/labels` picker + label/ingredient/nutrition forms; `/label-queue` aggregated readiness filters. |
| 18 | Category 1 Import | **EXPECTED OK** | File parse, column mapping, duplicate detection, staging batch submit. Import logs table optional (`importLogsUnavailable` banner). |
| 19 | Data Correction | **EXPECTED OK** | Filters for missing photo/price/MOQ/category/department/label data; local review flags in `localStorage`. |

### Console errors

| # | Flow | Static result | Notes |
|---|------|---------------|-------|
| 20 | Console errors per route | **BOOT ERROR FIXED** | Pre-fix: `ReferenceError: COMPLIANCE_APPROVER is not defined` at `permissions.ts` module load → blank screen. Post-fix: build succeeds; no undefined symbol in permissions matrix. **Residual risks (live only):** Supabase RLS denials, missing edge-fn secrets, `bootstrapError` on role setup — surface as toast/UI errors, not boot crashes. |

---

## Working features (high confidence)

- App boots after `COMPLIANCE_APPROVER_ROLES` fix (build + typecheck green).
- Role-gated routing via `ProtectedRoute` → `RoleGate` → `canAccessPage`.
- ProductEdit full tab model with contributor vs admin write paths.
- SKU builder, UOM/MOQ/packaging forms with validation warnings.
- Alias manager with typed language terms and heuristic generation.
- Media uploader with direct vs draft boundary.
- Product Truth readiness scoring and sub-panels.
- Draft submission to `catalogue_product_drafts` and related tables.
- Approval Inbox for product/media/alias/BOM/MOQ/pricing/tag drafts.
- Catalogue Builder (collections, WhatsApp preview, PDF).
- Label Studio and Label Queue.
- Category 1 import staging.
- Data Correction gap dashboard.
- Compliance field stripping on save (`stripUnapprovedComplianceFields`) — unit tested.

---

## Broken / partial features

| Feature | Severity | Detail |
|---------|----------|--------|
| Compliance AI panel on ProductEdit | **MEDIUM** | Component built but not mounted; users see manual compliance fields only. |
| AI Studio page | **INFO** | Roadmap placeholder — not operational PIM automation. |
| Central live sync | **BY DESIGN** | Preview-only; `AuthorityStatusBadges` show `central_live_write_disabled`. |
| Public catalogue share links | **PARTIAL** | Placeholder URLs in Catalogue Builder. |
| Nutrition structured editing on ProductEdit | **LOW** | Free-text / JSON textarea; structured editing lives in Label Studio. |
| Live authenticated smoke | **BLOCKED** | Requires human pass with production credentials. |

---

## Console errors

| Context | Error | Status |
|---------|-------|--------|
| App boot / permissions load | `ReferenceError: COMPLIANCE_APPROVER is not defined` | **RESOLVED** (`bdc66c9`) |
| Build / typecheck | — | **None** |
| Unit tests | — | **None** (81/81 pass) |
| Expected live-only (not reproduced here) | Supabase 401/403, storage upload failures, edge fn 500 | **LIVE UNVERIFIED** |

---

## ProductEdit verdict: **PARTIAL GO**

| Criterion | Assessment |
|-----------|------------|
| App loads for authenticated users | **GO** (boot crash fixed) |
| Product CRUD / edit UI | **GO** (static + tests) |
| Packaging / UOM / MOQ | **GO** |
| Media & aliases | **GO** (pending live storage/RLS check) |
| Compliance AI | **NO-GO** (panel unwired) |
| Product Truth / readiness | **GO** |
| Draft → approval workflow | **GO** (code complete; live RPC check needed) |
| Catalogue / label workflows | **GO** |

---

## Is AI Studio ready to become Product PIM now?

**PARTIAL — yes for internal catalogue authoring, no for full production PIM handoff.**

**Ready now:**

- Master product editing with role-based direct write vs draft submission.
- SKU, UOM, MOQ, packaging hierarchy on ProductEdit.
- Alias / language terms with approval boundary.
- Media upload with draft approval path.
- Product Truth readiness and catalogue builder outputs.
- Label data prep and queue.
- Category 1 import staging.

**Not ready without follow-up:**

- Wire `ComplianceAiPanel` into ProductEdit Compliance tab.
- Live authenticated smoke on production Supabase (storage, RLS, draft RPCs).
- Central live sync (intentionally disabled).
- Structured nutrition workflow consolidation between ProductEdit and Label Studio.
- AI Studio automation (roadmap only).

---

## Next fixes required

1. **Mount `ComplianceAiPanel`** on ProductEdit Compliance tab; pass `complianceMetaMap`, wire `generate-product-attributes` edge fn, show AI disclaimer.
2. **Live smoke pass** (owner/admin account): `/products` → open product → each tab → save (no prod data mutation; use read-only or test draft).
3. **Verify Supabase storage + RLS** for media upload on production project.
4. **Verify draft RPCs** (`approve_catalogue_product_draft`, etc.) respond for reviewer role.
5. **Optional:** Surface Product Truth channel prices/MOQ into ProductEdit Business Rules tab data feed (currently form-only props).
6. **Optional:** Apply catalogue collections migration if team-wide DB persistence needed (localStorage fallback works today).

---

## Commands run

```bash
npm ci
npm run typecheck   # PASS
npm run build       # PASS
npm test            # PASS (81 tests)
```

_No `npm run dev`, `vite`, or other start scripts were executed._
