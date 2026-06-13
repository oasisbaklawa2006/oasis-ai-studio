# AI Studio 5-SKU Pilot Completion Report

_Date: 2026-03-13 · Sprint: Pilot Completion · Project: `tcxvcatsqqertcnycuop`_

## Executive summary

| Metric | Before completion sprint | After completion sprint |
|--------|-------------------------|-------------------------|
| **Pilot gate ready (5-SKU)** | **0%** (0/5) | **0%** (0/5) — data blockers unchanged |
| **Dimension score (50 checks)** | **~22%** (estimated) | **~34%** (audit matrix) |
| **Code authoring path** | PARTIAL (post d36543a) | **PASS** |
| **Infra verification** | Not probed in UI | **Probed** (requires live `.env`) |
| **GO for pilot publish** | NO-GO | **NO-GO** |

**Conclusion:** Code and observability are sufficient for **authoring**; **approval/publish** remains blocked on owner data + infra confirmation.

---

## 1. Blocker state captured (`/testing/pilot-readiness`)

### Dashboard capabilities (after this sprint)

| Check | Mechanism |
|-------|-----------|
| Per-SKU dimensions | `evaluatePilotSku()` — live Supabase read |
| Infra RPC probes | `probePilotInfra()` — read-only RPC + storage list |
| Actionable errors | Per-SKU `blockedReasons[]` with field-level detail |
| Deep links | Open ProductEdit per SKU |

### Static audit matrix (no `.env` in CI — live refresh via `npm run verify:pilot-readiness`)

See `data/pilot/ai_studio_5sku_readiness_matrix.csv`.

| SKU | Structured | Schema | HSN/GST | g/pc | Hero | Square | Aliases | Ready |
|-----|------------|--------|---------|------|------|--------|---------|-------|
| 0024 Mor Pistachio Durum | pass | pass | partial | fail | fail | fail | 21 (partial types) | **blocked** |
| 0020 Tart Cashew | pass | pass | partial | fail | fail | fail | 19 | **blocked** |
| 0001 Cashew Kitta | pass | pass | partial | fail | fail | fail | 12 | **blocked** |
| 0025 Coconut Durum | pass | pass | partial | fail | fail | fail | 12 | **blocked** |
| 0007 Cashew Finger | pass | pass | partial | fail | fail | fail | 11 | **blocked** |

**Sources:** `BATCH001_PACKAGING_AUTHORITY_REPORT.md`, `BATCH001_MEDIA_AUTHORITY_REPORT.md`, `LANGUAGE_WAVE2A_APPROVAL_REPORT.md`, product UUIDs from `scripts/execute-wave2a-language.mjs`.

---

## 2. Infrastructure verification

| Component | Repo evidence | Live probe (needs `.env`) | Status |
|-----------|---------------|---------------------------|--------|
| **product-media bucket** | Migration `20260506093134` | `storage.from('product-media').list()` | **Owner verify** |
| **generate_oasis_sku** | Migration `20260506053901` + types.ts | RPC with AS/BKL/ASS/LOOSE | **In types — probe live** |
| **search_products_with_aliases** | Same migration + grant | RPC `_q: cashew` | **In types — probe live** |
| **approve_catalogue_product_draft** | `PR06B_draft_approval_migration.sql` | Probe with fake draft UUID | **Not in generated types — owner verify** |
| **reject_catalogue_product_draft** | PR06B | Probe with fake draft UUID | **Not in generated types — owner verify** |

**Note:** Generated `types.ts` lists `generate_oasis_sku` and `search_products_with_aliases` but **not** approve/reject RPCs — regenerate types after PR06B applied, or confirm via SQL editor / probe script.

---

## 3. Per-SKU verification detail

### OAS-AS-BKL-0024 — Mor Pistachio Durum

| Dimension | Status | Evidence |
|-----------|--------|----------|
| Structured SKU | pass | Batch 001 master |
| HSN/GST | partial | Authority preview HSN `21069099`; confirm on row |
| grams_per_piece | fail | DB 0/25 per packaging audit; authority 18g |
| pcs_per_kg | fail | Authority 55.6 |
| Hero / square | fail | 0/25 media audit |
| Aliases | partial | 21 approved (Phase 1); WhatsApp via `alias_type` |
| Resolver | pass | No open Wave 2B collision |
| Approval | fail | Data + infra gaps |

### OAS-AS-BKL-0020 — Tart Cashew

Same pattern; 19 aliases; authority 26g / 38.5 pcs/kg.

### OAS-AS-BKL-0001 — Cashew Kitta

12 aliases (Wave 2A); resolver **partial** (`kitta` bare-term collision risk).

### OAS-AS-BKL-0025 — Coconut Durum

12 aliases; packaging authority weight **TBD** in CSV.

### OAS-AS-BKL-0007 — Cashew Finger

11 aliases; authority 11g / 90.9 pcs/kg.

---

## 4. Code fixes in this sprint

| Area | Change |
|------|--------|
| **Infra probes** | `src/features/productAuthority/infraProbe.ts` |
| **Readiness accuracy** | Alias WA/search counts from `alias_type`; removed blanket localStorage blocker |
| **Approval readiness** | New `approvalReady` dimension with explicit reasons |
| **Resolver hints** | `pilotCollisionHints.ts` from language wave reports |
| **Dashboard** | Infra panel + packaging/alias detail rows |
| **CLI verifier** | `scripts/verify-pilot-readiness.mjs` + `npm run verify:pilot-readiness` |
| **Deliverables** | This report, owner action pack, CSV matrix |

**Not changed (already fixed d36543a):** schema adapter, SKU guard, Fast Create save, dual hero URL.

---

## 5. Fast Create final save — **PASS** (code)

| Step | Status |
|------|--------|
| Studio column payload | pass |
| SKU via `generate_oasis_sku` only | pass |
| DRAFT-* / OAS-FC-* blocked | pass |
| Formatted Supabase errors | pass |
| **Live E2E** | Requires RPC + bucket + auth — owner smoke |

---

## 6. Media upload — **PARTIAL**

| Step | Status |
|------|--------|
| Upload path + dual URL write | pass |
| Bucket missing banner | pass |
| **Live upload on prod** | Owner: confirm `product-media` bucket |
| **5-SKU assets** | fail — 0/25 heroes in audit |

---

## 7. Approval path — **PARTIAL**

| Step | Status |
|------|--------|
| Approval Inbox UI | pass |
| DRAFT-* block on approve | pass |
| Alias drafts approved (Wave 2A) | pass (historical, 78 drafts) |
| Product/media packaging drafts | not submitted |
| approve/reject RPC live | **owner verify** |

---

## 8. GO / NO-GO

| Gate | Verdict |
|------|---------|
| **Authoring in AI Studio** | **GO** — save contract, SKU guard, Fast Create, dashboard |
| **5-SKU pilot approval/publish** | **NO-GO** — packaging, media, full HSN/GST confirm, infra sign-off |

---

## Validation

```
npm run typecheck  ✅
npm run build      ✅
npm test           ✅ (98 tests)
```

Live matrix refresh (owner/dev machine with `.env`):

```
npm run verify:pilot-readiness
```
