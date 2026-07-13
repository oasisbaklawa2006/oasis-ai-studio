# AI Studio — Versioned Snapshot + Central Sync Preview

## Summary

Adds immutable approved catalogue snapshots and a **preview-only** Central connector (25B/25C) export path from AI Studio Product Truth. No live writes to Oasis Central; no service-role keys exposed.

## Migrations

**Yes** — additive only:

- `supabase/migrations/20260602140000_catalogue_versions_and_sync_events.sql`
  - `catalogue_versions` — versioned `snapshot_json`, approval/publish/sync timestamps
  - `catalogue_sync_events` — preview/export event log (`sync_status` includes `preview_only`)

Apply on AI Studio Supabase when ready. UI falls back to `localStorage` if tables are not yet applied.

## Files changed

| Area | Path |
|------|------|
| Schema | `supabase/migrations/20260602140000_catalogue_versions_and_sync_events.sql` |
| Snapshot core | `src/features/catalogueSnapshot/types.ts` |
| | `src/features/catalogueSnapshot/snapshotGenerator.ts` |
| | `src/features/catalogueSnapshot/snapshotValidation.ts` |
| | `src/features/catalogueSnapshot/centralSyncPayload.ts` |
| | `src/features/catalogueSnapshot/catalogueVersionStore.ts` |
| | `src/features/catalogueSnapshot/centralSyncPreviewService.ts` |
| UI | `src/features/catalogueSnapshot/panels/CentralSyncPreviewPanel.tsx` |
| | `src/features/productTruth/ProductTruthAdminSection.tsx` (Central Sync sub-tab) |
| Tests | `src/features/catalogueSnapshot/catalogueSnapshot.test.ts` |
| | `src/test/setup.ts` (test publishable env defaults) |

## Snapshot model

`catalogue_versions` rows hold:

- `version_code` / `version_number` (monotonic per product)
- `snapshot_json` — full Product Truth bundle (identity, readiness, UOM, packaging, channels, pricing, media, `fulfillment_transform`)
- `status`: `draft` → `approved` / `published` / `synced` (immutable once approved)

GST/HSN in snapshot:

- If compliance is **not** manually approved: `gst_classification_status = "manual_review_required"`, `gst_hsn = null`, `gst_rate = null`
- No auto-approval of GST/HSN

## Canonical Central publication envelope

`CentralSyncPreviewBundle`:

- `preview_only: true`, `no_live_central_write: true`, `connector: "catalogue-publication-v1"`
- `publication_envelope` — the exact `oasis.catalogue.publication.v1` wire shape owned by the canonical backend: publication identity/time/target, immutable source version and content hash, shared-product mapping, and the exact approved snapshot
- `full_snapshot` — a convenience mirror for the Studio preview only; the server publication event uses `publication_envelope.catalogue` as its immutable authority
- `validation.allowed` + `validation.blockers`

The browser preview uses a provisional UUID/time/hash and never claims target application. The
authoritative publication ID, PostgreSQL canonical-jsonb hash, approval actor, publish time and
idempotency outcome are created by `publish_catalogue_version_v1` in `oasis-supabase-core`.

## Validation blockers

Snapshot / preview blocked unless:

- Content, media, pricing, UOM, packaging, compliance (manual), and production mapping are approved
- `ready_for_central_sync` is true
- Central payload shape validates (GST null when `manual_review_required`)

Blockers are listed in the Product Truth **Central Sync** panel.

## UI added

Product Edit → **Product Truth** → **Central Sync**:

- Version history (immutable approved rows locked)
- Validation blockers
- Payload JSON preview + copy/export
- “Ready for Central Sync” badge
- “Preview only — no live Central write” warning
- Sync event log (DB or local fallback)

## Tests run

```bash
npm install
npm run typecheck   # pass
npm run build       # pass
npm run test        # 32 passed
```

Coverage includes: compliance/pricing blocks, UOM/packaging/channel/pricing in snapshot, GST null rule, immutability, Central payload validation, stale version detection, no live Central write flag.

## What is now ready

- Type-safe snapshot generation from Product Truth form + channel rules
- Validation gate aligned with readiness dimensions
- Central 25B/25C preview/export JSON (copy/download)
- Version draft + approve flow with immutability guard
- Preview-only sync event logging

## What is still not live

- No POST/webhook to Oasis Central
- No `synced_to_central_at` production updates
- Migration not applied automatically in this PR
- Media readiness automation, PDF catalogue builder, and production Central receive pilot remain future work

## Next phases

1. **Media readiness** — stricter approved media workflow before publish
2. **Catalogue / PDF builder** — customer-facing exports from approved snapshots
3. **Webhook / live sync** — gated pilot with Central receive endpoint
4. **Central receive production pilot** — promote from preview to controlled sync

## Oasis Central

**Not modified.** Preview payloads are generated in AI Studio only.
