# AI Studio — Media Readiness + Catalogue Builder Foundation

## Summary

Adds a type-safe **Media Readiness Engine**, **Catalogue Collection Builder** foundation (DB + localStorage), and **preview/export** foundations (digital cards, WhatsApp text, basic PDF). Central live sync remains disabled. Oasis Central repo was not modified.

## Migrations

**Yes** — additive only:

- `supabase/migrations/20260602160000_catalogue_collections_foundation.sql`
  - `catalogue_collections`
  - `catalogue_collection_items`
  - `catalogue_share_links`
  - RLS: authenticated team read/write via `is_team_member`
  - No public write; share-token public routes are a future phase

Apply on AI Studio Supabase when DB-backed collections are required. Until then, builder uses `localStorage` fallback (same pattern as catalogue versions).

## Files changed

| Area | Paths |
|------|--------|
| Media engine | `src/features/mediaReadiness/types.ts`, `mediaReadinessEngine.ts`, `mediaAssetsFromForm.ts`, `panels/MediaReadinessPanel.tsx`, `mediaReadinessEngine.test.ts` |
| Catalogue builder | `src/features/catalogueBuilder/types.ts`, `collectionStore.ts`, `cataloguePublishability.ts`, `whatsappPreview.ts`, `pdfExport.ts`, `catalogueBuilder.test.ts` |
| UI | `src/pages/CatalogueBuilder.tsx`, `src/App.tsx`, `src/components/AppLayout.tsx` |
| Product Truth | `src/features/productTruth/types.ts`, `productReadiness.ts`, `ProductTruthAdminSection.tsx` |
| Central sync | `src/features/catalogueSnapshot/snapshotGenerator.ts`, `snapshotValidation.ts`, `types.ts`, `centralSyncPreviewService.ts`, `catalogueSnapshot.test.ts` |
| Schema | `supabase/migrations/20260602160000_catalogue_collections_foundation.sql` |
| Deps | `jspdf`, `jspdf-autotable` |

## Media readiness model

- **14 asset types** (primary, pack, label, hamper, lifestyle, etc.)
- **Profiles** by category/class: Baklawa, gift box, export pack, hamper, general
- **Rules**: AI/draft assets do not count until human-approved; only approved URLs go to Central payload
- **APIs**: `getRequiredMediaAssets`, `evaluateMediaReadiness`, `calculateMediaScore`, `getMissingMediaAssets`, `canPublishMedia`, `canSyncMediaToCentral`, `selectApprovedImageUrlsForCentral`
- **UI**: Product Truth → **Media** sub-tab (score, blockers, Central URL preview)
- **Persistence**: form `hero_image_url` + optional `media_assets[]` JSON; full `product_media` table = future

## Catalogue collection model

- **Types**: b2b, retail, export, franchise, wedding, corporate, whatsapp_mini, qr_exhibition, seasonal
- **Items**: product_id, sort_order, featured, overrides, optional `catalogue_version_id`
- **Share links**: token, type (view/whatsapp/qr/pdf), status, expires_at (placeholder)

## UI routes / panels

| Route / panel | Purpose |
|---------------|---------|
| `/admin/catalogue-builder` | Create collections, add products, reorder, featured, readiness warnings, WhatsApp/PDF/share placeholders |
| Product Truth → **Media** | Media readiness score and blockers |
| Product Truth → Central Sync | Now validates approved media URLs in snapshot gate |

## PDF / WhatsApp preview status

| Feature | Status |
|---------|--------|
| Digital catalogue cards | Ready in builder |
| WhatsApp mini text | `generateWhatsAppMiniCatalogueText` — ready |
| QR / share URL | Placeholder token + `/c/{token}` style URL (not live public) |
| PDF export | Basic jsPDF + AutoTable — title, image attempt, name/SKU/category/price/MOQ, Oasis footer |

## Tests run

```bash
npm install
npm run typecheck   # pass
npm run build       # pass
npm run test        # 46 passed
```

Includes: Baklawa pairing, gift box packs, export labels, media blockers, Central approved URLs only, catalogue publishability, WhatsApp text, PDF without image crash.

## What is ready

- Media readiness scoring and Central-approved URL selection
- Collection builder CRUD (local + Supabase when migrated)
- Publishability warnings per product in builder
- Snapshot/Central preview media gate
- PDF/WhatsApp export foundations

## What is not live yet

- Live Central POST/webhook sync (still `LIVE_CENTRAL_WRITE_ENABLED = false`)
- Public catalogue analytics
- Signed share links with public RLS read
- Full product_media DB pipeline
- Advanced brochure PDF design / AI image generation

## Next phases

1. Signed webhook to Central (approved snapshots + media bundle)
2. Public catalogue links (published + share-token read policies)
3. View/open analytics
4. One-product end-to-end pilot (Product Truth → snapshot → collection → Central receive)

## Oasis Central

**Not modified.** Preview and export remain in AI Studio only.
