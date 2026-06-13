# AI Studio Category Pre-Feed Defaults

_Date: 2026-03-13 · Sprint: 5-SKU Pilot Remediation · Workstream 5_

## Concept

Most Oasis categories share default **HSN**, **GST**, **UOM**, **shelf life**, **storage**, and **veg mark** unless overridden per SKU. Pre-feeds accelerate Fast Create and ProductEdit without asserting legal/tax truth.

## Implementation (local, safe)

| Module | Role |
|--------|------|
| `src/features/productDefaults/categoryDefaults.ts` | Base category rules (existing) |
| `src/features/productDefaults/categoryPrefeed.ts` | Sprint bundle + disclaimer |

### Disclaimer (shown in UI)

> Suggested defaults only — not legal or tax truth. Review HSN/GST, shelf life, and veg mark with compliance before catalogue approval.

Constant: `CATEGORY_PREFEED_DISCLAIMER`.

### Fields in prefeed bundle

| Field | Source tag | Overridable |
|-------|------------|-------------|
| `category` | `category_rule` | ✅ |
| `hsn_code` | `central_parity` | ✅ |
| `gst_rate` | `central_parity` | ✅ |
| `primary_uom` | `category_rule` | ✅ |
| `shelf_life_days` | `category_rule` | ✅ |
| `storage_instructions` | `category_rule` | ✅ |
| `veg_mark` | `category_rule` | ✅ (UI-only until `is_veg` column) |

All fields carry `needsReview: true`.

### Baklawa example (pilot category)

| Field | Suggested value |
|-------|-----------------|
| HSN | `19059090` |
| GST | `18` |
| UOM | `kg` |
| Shelf life | `90` days |
| Storage | Cool, dry place |
| Veg mark | `veg` |

## Application rules

`applyPrefeedSuggestions(form, categoryKey)`:

- Fills **empty** form fields only — never overwrites user/compliance-approved values.
- Attaches `_prefeed_disclaimer` on form for UI display.

Fast Create uses `applyCategoryDefaults` in heuristic suggestions; disclaimer shown on Fast Create page.

## Future: defaults table (design only)

```text
category_prefeed_defaults (
  category_key text PK,
  default_hsn text,
  default_gst numeric,
  default_uom text,
  default_shelf_life_days int,
  default_storage text,
  default_veg_mark text,
  source text,
  effective_from date,
  needs_review boolean default true
)
```

**Not implemented** — local TS rules sufficient for pilot. Owner may promote to DB when multi-app sync needed.

## Compliance governance

- Pre-feed values are **stripped or blocked** on save if user lacks compliance approval (`stripUnapprovedComplianceFields`).
- Compliance AI panel remains suggest-only; no auto-approval of live product changes.

## Tests

`categoryPrefeed` tests in `productAuthority.test.ts`:

- HSN/GST suggested with `needsReview`
- `applyPrefeedSuggestions` does not override explicit HSN

## Status

| Item | Status |
|------|--------|
| Local prefeed module | **Done** |
| UI disclaimer | **Done** |
| DB defaults table | **Future** |
| Pilot SKU HSN/GST data | **Ops** — apply + approve on 5 rows |
