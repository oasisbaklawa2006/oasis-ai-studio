# AI Studio Product Authority — Rectification Backlog

_Date: 2026-03-13 · Prioritized remediation backlog (documentation only — no implementation in this task)_

**Inputs:** `AI_STUDIO_PRODUCT_AUTHORITY_MISSING_POINTS_AUDIT.md`, Batch 001 reports, last authority wave (`1d4212d`).

**Priority definitions:**

| Priority | Blocks |
|----------|--------|
| **P0** | **5-SKU pilot** — first governed products publishable to catalogue / WhatsApp / Central preview |
| **P1** | **Batch 001 full catalogue** (25 baklawa SKUs) |
| **P2** | **AI Studio becoming sole Product Authority** (Central read-only consumer) |
| **P3** | Future enhancement |

---

## Backlog summary

| Priority | Items | Est. effort |
|----------|------:|-------------|
| **P0** | 12 | 2–3 weeks |
| **P1** | 14 | 4–6 weeks |
| **P2** | 11 | 1 quarter |
| **P3** | 9 | Roadmap |
| **Total** | **46** | |

---

## P0 — Blocks 5-SKU pilot

| ID | Requirement(s) | Gap | Action | Owner | Tags |
|----|----------------|-----|--------|-------|------|
| P0-01 | 2, 1 | No structured SKU on Batch 001; placeholder on approve | Mandatory `SkuBuilder` / RPC before pilot SKU activate; block `DRAFT-*` for pilot SKUs | Studio dev | UI, APPROVE |
| P0-02 | 13, 14, 12 | 0/25 `grams_per_piece` / `pcs_per_kg` | **Packaging apply tool** (read-only script → governed draft batch) from Category 1 CSV Weight + Carton — no blind master write | Studio dev + ops | UI, MIG (data) |
| P0-03 | 25 | 0/25 hero images | Pilot **media upload sprint**: 1 hero minimum per anchor SKU via `ProductMediaUploader` / Fast Create | Ops + Studio | UI |
| P0-04 | 25, 34 | Dual bucket + taxonomy mismatch | Confirm `product-media` bucket live; map uploader `hero_image` ↔ readiness `primary_image` in code | Supabase admin + Studio | MIG, UI |
| P0-05 | 28, 29, 30 | Term types in localStorage | **Persist `term_type`** on `product_aliases` (column or junction) — no new table required for pilot | Studio dev | MIG, UI |
| P0-06 | 29 | RPC search may be absent | Deploy `search_products_with_aliases` on shared Supabase | Supabase admin | MIG |
| P0-07 | 1, 19 | `formToProductRow` adapter drift | **Single write contract** — write Studio column names OR explicit mapper tested both directions | Studio dev | UI |
| P0-08 | 3 | HSN/GST not on all pilot rows | Apply category defaults + compliance approve on 5 anchor SKUs | Ops | APPROVE |
| P0-09 | 27, 28 | Category 1 cannot import aliases/WA keywords | Extend Category 1 column map OR bulk alias draft import for pilot SKUs | Studio dev | UI |
| P0-10 | 31 | No collision review UI | **Minimal collision inbox** — list `clarification_required` from resolver for pilot utterances | Studio dev | UI |
| P0-11 | 37 | Readiness not actionable for pilot | Pilot dashboard: 5 SKUs × dimension blockers with deep links | Studio dev | UI |
| P0-12 | 38 | Draft RPC deploy uncertain | Verify approve/reject RPCs live for product + alias drafts | Supabase admin | MIG |

### P0 exit criteria (5-SKU pilot GO)

- [ ] 5 SKUs with structured Oasis SKU (not placeholder)
- [ ] HSN + GST approved on each
- [ ] `grams_per_piece` + valid `pcs_per_kg` on each
- [ ] Hero image URL on each (synced `image_url` + `hero_image_url`)
- [ ] ≥3 approved aliases per SKU including ≥1 WhatsApp keyword **in DB**
- [ ] Resolver tests pass for pilot utterances with 0 silent wrong-SKU
- [ ] Product Truth readiness ≥6/8 dimensions per pilot SKU
- [ ] Central B2B snapshot preview generates without blockers

---

## P1 — Blocks Batch 001 full catalogue (25 SKUs)

| ID | Requirement(s) | Gap | Action | Owner | Tags |
|----|----------------|-----|--------|-------|------|
| P1-01 | 12–17 | Packaging 12% readiness | Full packaging republish for 25 SKUs (primary, secondary 666/888, master carton) | Ops + Studio | UI, data |
| P1-02 | 25 | Media 0% — need 75 assets | Batch media profile: hero + pairing + close-up per `baklawa_small_sweets` | Ops | UI |
| P1-03 | 7 | Nutrition not unified | `NutritionPanelEditor` in ProductEdit → `nutrition_panels` | Studio dev | UI, APPROVE |
| P1-04 | 5, 6 | Ingredients/allergens duplicated | Single structured path: link `product_ingredients` + sync textarea from links | Studio dev | DUP, UI |
| P1-05 | 4, 11, 35 | FSSAI/label split | ProductEdit ↔ `labels` sync panel (FSSAI, batch, MRP, net qty) | Studio dev | WRONG, UI |
| P1-06 | 10 | Veg mark missing | `is_veg` / `veg_mark` on product + label render from truth | Studio dev | MISSING, UI, APPROVE |
| P1-07 | 18 | MOQ placeholder only | Channel MOQ rules for B2B bulk defaults per packaging type | Studio dev | UI |
| P1-08 | 21 | Pricing rules empty | Seed `product_pricing_rules` per channel from MRP economics | Ops + Studio | UI, APPROVE |
| P1-09 | 30 | No `product_language_terms` | Complete language waves 2D+; persist all term types | Studio dev | MIG, UI |
| P1-10 | 32 | Collections not live | Apply `catalogue_collections` migration; smoke Catalogue Builder | Supabase admin | MIG |
| P1-11 | 34 | Snapshot preview only | Batch snapshot export ZIP (25 JSON) for Central ops handoff | Studio dev | UI |
| P1-12 | 27 | Alias LLM UX weaker than Central | Port streaming `oasis-ai-chat` suggestions into `AliasManager` | Studio dev | AI, UI |
| P1-13 | 2 | No EAN | Add optional `ean_gtin` field + label barcode sync | Studio dev | MISSING, MIG |
| P1-14 | 39 | No product audit | Product change log table + write on save/approve | Studio dev | MISSING, MIG |

### P1 exit criteria (Batch 001 GO)

- [ ] 25/25 packaging authority applied
- [ ] 25/25 media minimum profile (3 assets)
- [ ] 25/25 nutrition panel exists or explicit waiver
- [ ] 25/25 label row complete or in Label Queue
- [ ] Language coverage 25/25 with typed terms in DB
- [ ] Resolver coverage 25/25 golden tests
- [ ] Catalogue collection created for Batch 001 export

---

## P2 — Blocks AI Studio as Product Authority

| ID | Requirement(s) | Gap | Action | Owner | Tags |
|----|----------------|-----|--------|-------|------|
| P2-01 | 34 | `LIVE_CENTRAL_WRITE_ENABLED = false` | Webhook pilot: versioned snapshot push to Central read model | Studio + Central | UI |
| P2-02 | 36 | No WA resolver snapshot | Define `whatsapp_resolver_snapshot` section in catalogue version | Studio dev | MISSING, UI |
| P2-03 | 31 | Resolver UI missing | Full collision admin + merge suggestions | Studio dev | UI |
| P2-04 | 1 | No variants | Variant draft type + BOM linkage | Studio dev | MISSING, MIG |
| P2-05 | 25 | Taxonomy duplication | Unify uploader types ↔ readiness types; add `square_image` slot | Studio dev | DUP, UI |
| P2-06 | 33 | Weak B2C fields | Product SEO/slug + public catalogue field group | Studio dev | UI |
| P2-07 | 23, 24 | Export/country weak | Export compliance pack (COO, HS, destination rules) | Studio dev | UI |
| P2-08 | 40 | Fragmented overrides | Emergency override policy + audit for compliance/price/label | Studio dev | UI, APPROVE |
| P2-09 | 38 | Compliance approval not persisted | Persist `complianceMetaMap` / approval events to DB | Studio dev | MIG, APPROVE |
| P2-10 | 37 | Truth score simplistic | Weighted readiness + nutrition/label dimensions | Studio dev | UI |
| P2-11 | — | Central still writes products | Central create → Studio draft API; read-only product master in Central | Central team | WRONG |

### P2 exit criteria (Authority shift GO)

- [ ] Central product create disabled or draft-only
- [ ] All new products authored in Studio only (30-day parallel audit clean)
- [ ] Live Central sync from approved snapshots
- [ ] Single bucket `product-media` for all new uploads
- [ ] Product Authority readiness score ≥8.5/10

---

## P3 — Future enhancement

| ID | Requirement(s) | Gap | Action |
|----|----------------|-----|--------|
| P3-01 | 26 | 360 media | Spin viewer + storage convention |
| P3-02 | 26 | Video pipeline | Transcode + WA rich media |
| P3-03 | 25 | Photo AI | Raw → catalogue shot enhancement |
| P3-04 | 7 | Nutrition AI | Suggest-only with QA gate (keep no auto-truth) |
| P3-05 | 22 | Distributor tiers | Region/volume price ladders |
| P3-06 | 33 | B2C storefront | Full consumer PDP field set |
| P3-07 | 35 | Label print | TSC / barcode app integration |
| P3-08 | 1 | Clone wizard | Duplicate product with selective copy |
| P3-09 | 34 | Real-time sync | Event-driven Central invalidation |

---

## What to build next (recommended order)

1. **P0-07** — Schema write contract fix (prevents silent data corruption)
2. **P0-05** — Persist alias term types to DB (unblocks WhatsApp authority)
3. **P0-02 + P0-03** — Packaging + hero media for 5 anchor SKUs (data ops + UI)
4. **P0-01 + P0-08** — Structured SKU + compliance approve on pilot set
5. **P0-10** — Resolver collision inbox for pilot utterances
6. **P0-06 + P0-04** — Supabase infra (RPC + bucket)
7. **P1-03** — Nutrition panel in ProductEdit (largest PIM gap)

**Do not build yet:**

- 360 / video transcode pipeline (P3)
- Central live write enable before P0/P1 data complete (P2-01)
- Variant manager before packaging/media authority on Batch 001 (P2-04)
- Nutrition AI auto-truth (governance violation)
- New destructive migrations without owner sign-off
- Duplicate Central product editor features in Studio (merge, don't fork)

---

## Requirement → backlog mapping (quick reference)

| # | Requirement | Priority |
|---|-------------|----------|
| 1 Identity | P0-07, P2-11 |
| 2 SKU/EAN | P0-01, P1-13 |
| 3 HSN/GST | P0-08 |
| 4 FSSAI | P1-05 |
| 5 Ingredients | P1-04 |
| 6 Allergens | P1-04 |
| 7 Nutrition | P1-03, P3-04 |
| 8–9 Shelf/storage | — (adequate for pilot) |
| 10 Veg mark | P1-06 |
| 11 Batch/MRP/label | P1-05 |
| 12–17 Packaging | P0-02, P1-01 |
| 18 MOQ | P1-07 |
| 19–22 Pricing | P0-07, P1-08 |
| 23–24 Export/country | P2-07 |
| 25 Images | P0-03, P0-04, P1-02, P2-05 |
| 26 Video/360 | P3 |
| 27–30 Language | P0-05, P0-09, P1-09, P1-12 |
| 31 Collisions | P0-10, P2-03 |
| 32 Collections | P1-10 |
| 33 B2C web | P2-06, P3-06 |
| 34 Central snapshot | P0-11, P1-11, P2-01 |
| 35 Label snapshot | P1-05 |
| 36 WA snapshot | P2-02 |
| 37 Product Truth | P0-11, P2-10 |
| 38 Approvals | P0-12, P2-09 |
| 39 Audit | P1-14, P2-08 |
| 40 Emergency override | P2-08 |

---

## Final counts (for leadership)

| Metric | Value |
|--------|------:|
| **Total missing points** (MISSING + WEAK + DUP + WRONG + blocking gaps) | **31** |
| **P0 blockers** | **12** |
| **P1 blockers** | **14** |
| **P2 blockers** | **11** |
| **P3 items** | **9** |

**Recommended next sprint:** P0-07, P0-05, P0-02, P0-03, P0-01 (schema, term types, packaging/media data, SKU) — **no new feature surface** until pilot 5 SKUs pass exit criteria.
