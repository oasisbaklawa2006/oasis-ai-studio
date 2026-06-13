# AI Studio SKU Generation Guard

_Date: 2026-03-13 · Sprint: 5-SKU Pilot Remediation · Workstream 2_

## Problem

Pilot products must not use `DRAFT-*` or ad-hoc `OAS-FC-*` placeholder SKUs. Fast Create previously fell back to `OAS-FC-${timestamp}` when `generate_oasis_sku` RPC failed.

## Pilot SKU allowlist

| SKU | Product |
|-----|---------|
| `OAS-AS-BKL-0024` | Mor Pistachio Durum |
| `OAS-AS-BKL-0020` | Tart Cashew |
| `OAS-AS-BKL-0001` | Cashew Kitta |
| `OAS-AS-BKL-0025` | Coconut Durum |
| `OAS-AS-BKL-0007` | Cashew Finger |

Defined in `src/features/productAuthority/skuGuard.ts` (`PILOT_SKUS`).

## Guard rules

| Rule | Enforcement |
|------|-------------|
| No `DRAFT-*` on save | `assertStructuredSkuForSave` — ProductEdit + Fast Create |
| No `OAS-FC-*` fallback | Removed from `saveFastCreateProduct.ts` |
| Structured `OAS-…` format | Regex + length check in `isStructuredOasisSku` |
| RPC required for new products | `requireFastCreateSku()` calls `generate_oasis_sku` via `generateFastCreateSku()` |
| Pilot approval block | `ApprovalInbox` rejects product drafts with `DRAFT-*` or non-structured SKU |

## Fast Create flow

1. User generates suggestions → **Refresh SKU** resolves via RPC.
2. UI shows **Structured SKU (before save)** panel on `/products/new/fast`.
3. On **Create product**, `requireFastCreateSku()` runs again (fail-closed).
4. If RPC or `sku_code_rules` missing → clear error:

   > Structured SKU could not be generated. Ensure sku_code_rules are configured and generate_oasis_sku RPC is deployed. Placeholder SKUs (DRAFT-*, OAS-FC-*) are blocked.

## RPC dependency

`generateFastCreateSku()` (`fastCreateSuggestions.ts`):

1. Loads active rows from `sku_code_rules` (division, category, subcategory, packaging).
2. Calls `supabase.rpc("generate_oasis_sku", { _division_code, _category_code, _subcategory_code, _packaging_code })`.

**Owner action if unavailable:** Deploy `generate_oasis_sku` on shared Supabase and seed `sku_code_rules` for Arabic Sweets / Baklawa codes.

## ProductEdit / SkuBuilder

Existing products: SKU guard runs on every direct master save. Editors must use **SkuBuilder** to assign structured SKU before catalogue-ready approval.

## Contributor drafts

Contributors submit drafts without master SKU; admin must finalize SKU at approval (UI blocks `DRAFT-*` approve).

## Tests

- `isDraftSku("DRAFT-…")` → blocked
- `assertStructuredSkuForSave("OAS-AS-BKL-0001-0001")` → pass
- `assertStructuredSkuForSave("OAS-FC-ABC123")` → fail
- `FAST_CREATE_SKU_BLOCK_MESSAGE` documents RPC requirement

## Status

| Item | Status |
|------|--------|
| SKU guard module | **Done** |
| Fast Create RPC-only SKU | **Done** |
| SKU preview UI | **Done** |
| Approval inbox block | **Done** |
| Pilot rows already structured | **Data** — verify live DB |
