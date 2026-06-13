# AI Studio 5-SKU Alias Authority Plan

_Date: 2026-03-13 · Sprint: 5-SKU Pilot Remediation · Workstream 4_

## Current alias model

### Database (`product_aliases`)

| Column | Persisted | Notes |
|--------|-----------|-------|
| `alias` | ✅ | Canonical text |
| `alias_type` | ✅ | String — maps loosely to term class |
| `product_id` | ✅ | FK to products |
| `language`, `script` | ✅ | Optional |
| `source` | ✅ | e.g. `fast_create`, `manual` |
| `confidence_score` | ✅ | Default 0.85 on Fast Create |
| `is_active` | ✅ | Soft disable |
| `normalized_alias` | ✅ | Optional normalized form |

**Not in DB today:** `term_type` (6-class), `channel_scope`, `review_status` as first-class columns.

### UI-only term types

`src/features/productLanguage/termTypeStorage.ts` — **localStorage** map `(productId, aliasId) → term_type`.

`TERM_TYPE_UI_NOTICE` in `AliasManager`: *"Term type is tracked in AI Studio UI only until language-term schema is deployed."*

**Sprint fix:** UI does not claim DB persistence for WhatsApp vs search distinction beyond `alias_type` string.

## Fast Create alias writes (fixed)

`persistFastCreateAliases` now uses valid schema only:

- Seed aliases → `alias_type` from seed rules (`official_alias`, `hindi_name`, etc.)
- WhatsApp keywords → `alias_type: "whatsapp_keyword"`
- Search keywords → `alias_type: "search_keyword"`

Removed invalid columns: `alias_text`, `canonical_name`.

## 5-SKU alias authority plan (safe, no migration)

For each pilot SKU, target **minimum 3 active aliases** in DB:

| Term class | Storage (now) | `alias_type` value | Channel intent |
|------------|---------------|-------------------|----------------|
| Official alias | DB | `official_alias` | Central, catalogue |
| WhatsApp keyword | DB | `whatsapp_keyword` | WhatsApp resolver |
| Search keyword | DB | `search_keyword` | Product search / picker |

### Per-SKU seed guidance

| SKU | Official alias example | WhatsApp keyword | Search keyword |
|-----|------------------------|------------------|----------------|
| OAS-AS-BKL-0024 | Mor Pistachio Durum | mor pistachio | pistachio durum |
| OAS-AS-BKL-0020 | Tart Cashew | tart cashew | cashew tart |
| OAS-AS-BKL-0001 | Cashew Kitta | cashew kitta | kitta cashew |
| OAS-AS-BKL-0025 | Coconut Durum | coconut durum | nariyal durum |
| OAS-AS-BKL-0007 | Cashew Finger | cashew finger | finger cashew |

**Authoring path:** ProductEdit → AliasManager (direct write) or governed alias drafts (contributor).

## Future migration (document only — do not apply)

Proposed additive migration (owner sign-off required):

```sql
-- PROPOSED — NOT APPLIED
ALTER TABLE product_aliases
  ADD COLUMN IF NOT EXISTS term_type text,
  ADD COLUMN IF NOT EXISTS channel_scope text[],
  ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'pending';
```

Backfill: `term_type` from `alias_type` + localStorage export script.

Until then:

1. Do not show "saved to database" for term type tab switches beyond `alias_type`.
2. Pilot readiness marks alias term types **partial** with explicit migration note.

## Collision / resolver

Resolver collision inbox (P0-10) remains **unknown** in pilot dashboard — separate sprint item. No silent wrong-SKU approval.

## Status

| Item | Status |
|------|--------|
| Audit complete | **Done** |
| Fast Create alias schema fix | **Done** |
| UI honesty (TERM_TYPE_UI_NOTICE) | **Done** |
| DB term_type migration | **Owner — not applied** |
| 5-SKU alias data population | **Ops** |
