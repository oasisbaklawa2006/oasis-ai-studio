# Point 36 — MOQ / Lead-Time / Readiness Canonical Closure

**ASM:** AI Studio Product Master representation and governed editing  
**Mission Control authority:** Central #459 — Point 36 = MOQ / lead-time / readiness  
**Starting SHA:** `6f8e164` (POINT35 merged) · **Rebased onto main:** `68f2e81` (#156 POINT37 merged)  
**Core authority:** oasis-supabase-core #209 @ `50660644056a7a9c6bf5488264ad87595c706c58` (production release run `34027390507`)  
**Classification:** **LIVE RECERTIFIED** for `products.lead_time_days`; BOM `lead_time_days` remains component-only

## Live authority census matrix

| Field / unit | Canonical storage | UI | Write path | Read/publication | Validation | Delta | Derived vs stored |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `moq_rule_type` | Core `products` | ProductEdit UOM/MOQ tab | `formToDbProductPayload` | Products list + Catalogue Studio | Enum semantics | **Closure** | Stored |
| `moq_value` / `moq_uom` | Core `products` | ProductEdit | Adapter | Readiness + snapshot `point36_v1` | Positive value requires UOM | **Closure** | Stored |
| `moq_text` | Core `products` | Legacy note | Adapter | Catalogue copy only | Insufficient alone for B2B publication | **Closure** | Stored |
| `increment_*` | Core `products` | ProductEdit | Adapter | MOQ engine | Increment requires UOM | **Closure** | Stored |
| `private_label_moq*` | Core `products` | ProductEdit | Adapter | Gate when `private_label_allowed` | Both required | **Closure** | Stored |
| `fixed_carton_required` + `carton_qty` | Core `products` | UOM tab | Adapter | Carton-based MOQ | Carton qty required | **None** | Stored |
| Channel MOQ | `product_moq_rules` | `ChannelMoqRules` | Central-governed drafts | Snapshot `channel_rules` | Gap when pricing without rule | **Closure** | Stored per channel |
| `is_catalogue_ready` | Core `products` | ProductEdit toggle | Adapter | Catalogue visibility | `evaluateCatalogueReadyGate` + Point 36 | **Closure** | Stored flag |
| `lead_time_days` (product) | Core `products` (live) | ProductEdit UOM/MOQ tab | `formToDbProductPayload` | Snapshot `product_days` | Positive integer; null = deferred | **Recertified** | Stored |
| `lead_time_days` (BOM) | `product_bom_items` | BOM UI (future) | BOM table | Snapshot `bom_max_days` only | Component-only — never substitutes product row | **Pass-through** | Stored on BOM row |
| Point 35 dimensions | `dimension_*_cm`, `cbm`, `grams_per_piece` | ProductEdit | Adapter | Unchanged | Preserved | **None** | Per Point 35 |

## Retained canonical objects (no parallel tables)

- `channelPricingMoqEngine` — order-qty validation against hierarchy (unchanged API)
- `product_moq_rules` — channel authority (Central approval path unchanged)
- `evaluateCatalogueReadyGate` — extended with Point 36 `evaluatePublicationReadiness`
- `computeCatalogueProductReadiness` — MOQ category uses canonical evaluator
- Point 35 `shippingDimensions` — referenced only, not duplicated
- Point 37 `packagingLabelReadinessCanonical` — separate label gate (not merged into catalogue-ready)

## Core production verification (no production mutation)

| Check | Evidence |
| --- | --- |
| Core migration applied | Production Migration Release run `34027390507` SUCCESS @ `5066064` |
| Post-deploy ledger + semantic parity | PASS per Core release workflow |
| AI Studio adapter contract | Unit tests — `lead_time_days` live write/read on `products` row |
| BOM `lead_time_days` | Separate table authority — snapshot `bom_max_days` only |
| Prior Core-blocked hold | **SUPERSEDED** by #209 protected deploy |

## Publication fail-closed behaviour

| Stale / invalid input | Gate outcome |
| --- | --- |
| `moq_value` without `moq_uom` (fixed_min / B2B) | **Blocked** |
| Legacy `moq_text` only for B2B/export | **Blocked** |
| Channel `b2b`/`retail` pricing without channel MOQ rule | **Blocked** |
| Private label enabled without PL MOQ | **Blocked** |
| Non-positive `lead_time_days` on product row | **Blocked** |
| Export product without `lead_time_days` | **Blocked** |
| BOM `lead_time_days` only (no product row value) | **Does not substitute** — export still blocked |

## Files touched

| File | Change |
| --- | --- |
| `src/features/productAuthority/liveProductsSchema.ts` | `lead_time_days` live compat (Core #209) |
| `src/features/productAuthority/moqLeadTimeReadinessCanonical.ts` | Live `products.lead_time_days` binding |
| `src/features/productAuthority/productSchemaAdapter.ts` | `lead_time_days` persist + round-trip |
| `src/pages/ProductEdit.tsx` | Lead time field + gate inputs |
| `src/features/productAuthority/catalogueReadyGate.ts` | `productLeadTimeDays` input |
| `src/features/catalogueSnapshot/snapshotGenerator.ts` | `product_days` in `point36_v1` |

## Gate matrix (head)

| Gate | Status |
| --- | --- |
| Rebased on `main` @ `68f2e81` | **PASS** |
| Core #209 production live | **PASS** |
| `products.lead_time_days` adapter contract | **PASS** |
| Fail-closed MOQ semantics preserved | **PASS** |
| Unit tests (local) | **PASS** |
| Production mutation (AI Studio) | **NONE** |
| Collaborator approval | **AWAITING** |
