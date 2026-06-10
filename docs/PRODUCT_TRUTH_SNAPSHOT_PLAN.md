# Product Truth Snapshot Plan

**Date:** 2026-06-10  
**Program:** Product Authority Completion Wave — Workstream E  
**Scope:** `product_truth_snapshot`, generation gaps, authority export, sync preview

---

## Executive summary

| Capability | Status | Readiness |
|------------|--------|-----------|
| In-app snapshot generator | ✓ `generateCatalogueSnapshot()` | 70% |
| DB column `product_truth_snapshot` | **Not on Central `products`** | 0% |
| Snapshot write on approval | ✗ Not implemented | 0% |
| Snapshot read by Builder/public | ✗ Not implemented | 0% |
| Authority export format | Partial (snapshot JSON schema exists) | 40% |
| Central sync preview | Readiness engine only; no frozen snapshot | 30% |
| **Snapshot readiness** | | **28%** |

The application can **generate** a Product Truth snapshot in memory (`catalogueSnapshot` module) but never **persists** it to master or serves it to catalogue/resolver consumers.

---

## Current state audit

### What exists

| Component | Path | Role |
|-----------|------|------|
| `generateCatalogueSnapshot()` | `src/features/catalogueSnapshot/snapshotGenerator.ts` | Builds `CatalogueSnapshotJson` from form + readiness |
| `CatalogueSnapshotJson` type | `src/features/catalogueSnapshot/types.ts` | Schema for identity, media, packaging, compliance, pricing |
| `evaluateProductReadiness()` | `src/features/productTruth/productReadiness.ts` | 8-dimension scoring |
| `catalogueSnapshot.test.ts` | Tests | Generator unit tests pass |
| Approval audit snapshots | `catalogue_approval_audit.payload_snapshot` | Draft-level only |

### What is missing

| Gap | Impact |
|-----|--------|
| No `products.product_truth_snapshot` on Central | Cannot freeze authority at a point in time |
| No write on product draft approval | Snapshot regenerated ad-hoc; inconsistent |
| Builder reads live `products` with optimistic overrides | Stale/wrong publishability |
| Resolver does not consume snapshot | Language/media/compliance not versioned |
| No export API / download | Authority cannot be handed to Central ops |
| No sync preview diff | Cannot compare Studio vs Central truth |

### Central `products` columns (relevant)

Identity, pricing, packaging, compliance fields exist as **scalar columns** — not as a versioned JSONB snapshot. Live columns are partially populated (see packaging/media reports).

---

## Proposed snapshot schema (authority export)

Based on existing `CatalogueSnapshotJson`:

```json
{
  "snapshot_version": "1.0",
  "generated_at": "ISO-8601",
  "product_id": "uuid",
  "sku": "OAS-AS-BKL-0001",
  "identity": { "name", "category", "department", "production_department" },
  "packaging": { "grams_per_piece", "pcs_per_kg", "pack_size", "conversion_rules" },
  "media": { "hero_image_url", "approved_images", "media_status", "profile" },
  "compliance": { "hsn_code", "gst_rate", "ingredients", "allergen_warnings", "manually_approved" },
  "pricing": { "mrp", "channel_prices", "moq_rules" },
  "language": { "alias_count", "whatsapp_keyword_count", "last_wave" },
  "readiness": { "score", "blockers", "badges" },
  "authority_hash": "sha256 of canonical fields"
}
```

---

## Generation gaps

| Trigger | Should generate? | Today |
|---------|------------------|-------|
| Product draft approval | Yes | No |
| Packaging republish approval | Yes | No |
| Media draft approval | Yes | No |
| Language wave completion | Yes (language section) | No |
| Manual "Export authority" button | Yes | No |
| Central sync preview | Yes | Partial (readiness only) |

---

## Authority export requirements

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Frozen snapshot per SKU at approval time | P0 | Immutable audit trail |
| SHA-256 authority hash for diff detection | P1 | Detect drift vs live master |
| Batch export (25 SKUs JSON/CSV zip) | P1 | Handoff to Central ops |
| Include language summary (alias counts, not full list) | P2 | 267 aliases — reference by count |
| Exclude draft-only fields | P0 | Only approved/master data |
| GDPR: no customer PII in snapshot | P0 | Product data only |

---

## Sync preview requirements

| Requirement | Description |
|-------------|-------------|
| Pre-sync readiness gate | `readyForCentralSync` must be true |
| Field-level diff | Studio snapshot vs Central `products` row |
| Blocker report | List dimensions blocking sync |
| Dry-run mode | No writes to Central |
| Post-sync snapshot version bump | New snapshot after successful sync (future) |

**Constraint this wave:** No Central sync execution — preview design only.

---

## Implementation plan (Wave 4D)

### 4D-1 — Snapshot write on approval (requires migration — deferred)

Add `product_truth_snapshot jsonb` + `product_truth_snapshot_at timestamptz` to Central `products` (out of scope: no SQL this wave).

### 4D-2 — Interim: snapshot table or draft payload (no migration)

Store snapshot in `catalogue_product_drafts` payload on republish:
```json
{ "product_truth_snapshot": { ... }, "snapshot_generated_at": "..." }
```

### 4D-3 — Export UI

Add "Export Product Truth" action on Product Edit → downloads `CatalogueSnapshotJson` for current form state.

### 4D-4 — Builder consumption

`CatalogueBuilder` reads latest approved snapshot from draft audit or generated on-the-fly with **honest** flags (no optimistic overrides).

### 4D-5 — Batch 001 baseline snapshot

After packaging + media waves complete, generate and archive baseline snapshots for all 25 SKUs.

---

## Readiness: 28%

| Capability | Weight | Score |
|------------|--------|-------|
| Generator code | 25% | 70% |
| Schema defined | 15% | 60% |
| Persistence | 25% | 0% |
| Consumer integration | 20% | 0% |
| Export / sync preview | 15% | 30% |
| **Weighted** | | **28%** |

---

## References

- `src/features/catalogueSnapshot/snapshotGenerator.ts`
- `src/features/catalogueSnapshot/types.ts`
- `docs/AI_STUDIO_VERSIONED_SNAPSHOT_CENTRAL_SYNC_REPORT.md`
- `docs/BATCH001_PACKAGING_AUTHORITY_REPORT.md`
- `docs/BATCH001_MEDIA_AUTHORITY_REPORT.md`
