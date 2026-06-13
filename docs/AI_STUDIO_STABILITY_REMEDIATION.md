# AI Studio Stability Remediation

_Date: 2026-03-13 · Repository: oasis-ai-studio only_

## Summary

Phase 1 closes stability, parity, and governance gaps identified across recovery audits, parity matrix, authoring UX audit, and image storage audit. **No Central changes. No destructive migrations. No production writes in this pack.**

| # | Deficiency | Root cause | Remediation | Status |
|---|------------|------------|-------------|--------|
| 1 | Collections loading failures | `catalogue_collections` table/migration not applied on live DB; errors surfaced as blank UI | `collectionStore` + `diagnostics.ts` + actionable banner in `CatalogueBuilder.tsx` | **Fixed (code)** — owner must apply migration |
| 2 | Missing collections foundation | Same as above | `AI_STUDIO_CATALOGUE_BUILDER_COLLECTIONS_FIX.md`; dev-only local fallback gated by env | **Fixed (code)** |
| 3 | Favicon / branding cleanup | Lovable default assets | `index.html` + `public/favicon.svg` Oasis branding | **Fixed** |
| 4 | Category 1 import template | Missing download path | `public/templates/category1-import-template.csv` + staging page link | **Fixed** |
| 5 | Advanced alias search limitations | RPC `search_products_with_aliases` may be absent on live DB | Client fallback in `productSearch.ts` + neutral banner | **Fixed (client)** — deploy RPC for full parity |
| 6 | Product image ecosystem inconsistencies | Central `image_url` vs Studio `hero_image_url`; bucket split | `resolveProductHeroUrl` + dual-column write | **Fixed** |
| 7 | product-media vs image_url reconciliation | Write path only set `hero_image_url` | `heroUrlWritePayload` syncs both columns | **Fixed** |
| 8 | Compliance AI panel not wired | `ComplianceAiPanel` built but not mounted | Wired in `ProductEdit` Compliance tab + meta map + baseline | **Fixed** |
| 9 | Product Truth friction | `complianceApproved` hardcoded `false` | Derived from `complianceMetaMap` | **Fixed** |
| 10 | Blank-screen recovery leftovers | `COMPLIANCE_APPROVER` undefined in `permissions.ts` | Replaced with `COMPLIANCE_APPROVER_ROLES` | **Fixed** |

**Additional fix (save governance):** `canWriteProductsDirectly()` — owner/admin/product_manager can save products (was super_admin-only via `canWriteMasterDirectly`).

---

## Root causes (detailed)

### Collections

- **Symptom:** Catalogue Builder shows empty collections or error state.
- **Cause:** Supabase query to `catalogue_collections` fails when migration not applied.
- **Fix:** `diagnoseSupabaseFailure()` classifies error; UI shows retry guidance; production blocks silent localStorage fallback.

### Images

- **Symptom:** Images uploaded in Central invisible in AI Studio.
- **Cause:** Column mismatch (`image_url` vs `hero_image_url`).
- **Fix:** Unified read/write helpers in `src/lib/productImage.ts`.

### Compliance AI

- **Symptom:** AI attribute generation unavailable despite edge function existing.
- **Cause:** Panel never imported in `ProductEdit.tsx`.
- **Fix:** Mount panel; track AI vs manual field meta; strip unapproved fields on save.

### Permissions / blank screen

- **Symptom:** Production blank screen after deploy.
- **Cause:** `ReferenceError` on boot in permissions module.
- **Fix:** Import compliance approver roles from shared constants.

---

## Files changed (Phase 1 wave)

| Area | Files |
|------|-------|
| Collections | `collectionStore.ts`, `dataSource.ts`, `diagnostics.ts`, `CatalogueBuilder.tsx` |
| Images | `productImage.ts`, `ProductMediaUploader.tsx`, `ProductEdit.tsx`, `Products.tsx` |
| Search | `productSearch.ts`, `Products.tsx` |
| Compliance | `ProductEdit.tsx`, `ComplianceAiPanel.tsx` (consumer) |
| Permissions | `permissions.ts`, `centralPermissions.ts` |
| Branding | `index.html`, `public/favicon.svg` |
| Category 1 | `Category1ImportStaging.tsx`, template CSV |

---

## Owner actions (Supabase — not executed by agent)

1. Apply `catalogue_collections` migration on shared project `tcxvcatsqqertcnycuop`.
2. Confirm `product-media` bucket + policies (AI Studio migration).
3. Create `product-images` bucket for Central OR migrate Central to `product-media`.
4. Deploy `search_products_with_aliases` RPC if not present.

---

## Validation

```bash
npm run typecheck   # PASS
npm run build       # PASS
npm test            # PASS (88 tests)
```

---

## Remaining stability risks

| Risk | Mitigation |
|------|------------|
| Live DB missing tables | Migration checklist in owner docs |
| RPC absent | Client fallback; deploy RPC |
| Dual bucket URLs | Unified read path; architecture doc Phase 4 |
| Contributor vs admin save confusion | `CatalogueWriteModeBanner` + `canWriteProductsDirectly` |
