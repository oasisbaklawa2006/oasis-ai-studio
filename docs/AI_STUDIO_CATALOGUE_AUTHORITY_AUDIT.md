# Oasis AI Studio — Catalogue Authority Audit

**Last updated:** 2026-06-09

## Foundation hardening applied (PR: Catalogue Authority Foundation)

The following safe hardening changes were applied without enabling live Central writes, SQL, or schema changes:

| Change | Detail |
|--------|--------|
| **Supabase types refresh** | `src/integrations/supabase/types.extensions.ts` — supplemental table/RPC shapes derived from in-repo migrations (`catalogue_versions`, `catalogue_sync_events`, `catalogue_collections*`, draft tables per PR06B). Marker: `CATALOGUE_AUTHORITY_TYPES_REFRESHED_AT = 2026-06-09`. |
| **Product Truth mounted** | `ProductTruthAdminSection` wired on `/products/:id` → **Product Truth** tab (includes `CentralSyncPreviewPanel`, media readiness, UOM/packaging, channel rules). |
| **localStorage write gating** | Catalogue collection + version stores no longer write to `localStorage` unless `VITE_ALLOW_LOCAL_CATALOGUE_FALLBACK=true` in **dev only**. Production/default: Supabase required; silent local authority writes blocked. |
| **Authority badges** | `AuthorityStatusBadges` component surfaces: `AUTHORITY DRAFT`, `LOCAL ONLY`, `NOT SYNCED TO CENTRAL`, `CENTRAL LIVE WRITE DISABLED`. |
| **Central Sync read-only** | `CentralSyncReadOnlyBanner` on Central Sync preview; `LIVE_CENTRAL_WRITE_ENABLED` remains `false`. |
| **Data Correction labelled** | Reviewed checkmarks explicitly marked `LOCAL ONLY` (browser `localStorage` only). |

### Gated localStorage keys (authority data)

| Key pattern | Store | Write gated |
|-------------|-------|-------------|
| `oasis_catalogue_collections` | `collectionStore.ts` | YES |
| `oasis_catalogue_collection_items` | `collectionStore.ts` | YES |
| `oasis_catalogue_share_links` | `collectionStore.ts` | YES |
| `oasis_catalogue_versions_{productId}` | `catalogueVersionStore.ts` | YES |
| `oasis_catalogue_sync_events_{productId}` | `catalogueVersionStore.ts` | YES |

### Not gated (UX-only, labelled where shown)

| Key | Purpose |
|-----|---------|
| `oasis_product_edit_tab_*` | Tab persistence |
| `catalogue_product_form_draft_*` | Unsaved form draft (badged AUTHORITY DRAFT on Product Edit) |
| `oasis_data_correction_reviewed_v1` | Reviewed flags (badged LOCAL ONLY) |
| Testing checklist keys | QA harness only |

### Central live write status

`LIVE_CENTRAL_WRITE_ENABLED` in `src/features/catalogueSnapshot/centralSyncPayload.ts` — **still `false`**. No outbound Central API POST enabled.

### Dev-only opt-in for local fallback

```bash
# .env.local (development only — never in production)
VITE_ALLOW_LOCAL_CATALOGUE_FALLBACK=true
```

---

## Prior audit summary (2026-06-09)

**Verdict:** PARTIAL — substantial product-master and draft-approval UI; not yet sole Catalogue Authority due to missing import pipeline, unwired modules (now partially addressed), schema/type drift (partially addressed), and preview-only Central sync.

**Modules audited:** 35

**Remaining highest-risk gaps after foundation PR:**

1. No catalogue bulk import UI
2. Draft/approval SQL deployment verification on Central still required
3. Dual catalogue systems (`catalogues` vs `catalogue_collections`) not unified
4. `product_tags` / product↔tag mapping UI missing
5. Live Central outbound sync still disabled by design

**Recommended next PR:** Verify PR06 draft tables + RPCs on Central via read-only schema audit; unify catalogue collection vs branded catalogue flows.
