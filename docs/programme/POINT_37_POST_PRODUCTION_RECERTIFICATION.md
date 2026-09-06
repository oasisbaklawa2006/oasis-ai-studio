# Point 37 — Post-production recertification (AI Studio)

**Starting main:** `b30b94dc1d60cc47d881790770edb2e38241b689`  
**Core production anchor:** `9c93fc32edb65ece2b125e787046e0c001d29b47`  
**Production Migration Release:** run `34034910469` (ledger / semantic / contract smoke PASS)

## Re-census vs live Core columns

| Concept | Pre-recert (merged #156) | Post-recert (live Core) |
| --- | --- | --- |
| FSSAI licence | `DATA_GAPS.no_column` — fail-closed Draft | `products.fssai_licence_number` — read/write via adapter |
| Country of origin | `DATA_GAPS.no_column` | `products.country_of_origin` |
| Manufacturer / marketer | `DATA_GAPS.no_column` (`manufacturer_marketer_details`) | `products.label_manufacturer_details` |
| Net quantity / MRP / batch / dates | Still `no_column` | Unchanged — remain Core follow-ups |

## AI Studio bindings (this PR only)

- `liveProductsSchema.ts` — compat columns for the three live fields
- `productSchemaAdapter.ts` — save/read round-trip
- `labelComplianceLiveColumns.ts` — fail-closed validation (null / blank / placeholder)
- `labelReadiness.ts` — `legal_label_fields` scored category (replaces gap stubs for the three columns)
- `packagingLabelReadinessCanonical.ts` — snapshot `point37_v2` with `live_legal_fields` + remaining Core deps
- `ProductEdit.tsx` — form defaults for save path

## Fail-closed behavior

Customer-facing sale types (`domestic`, `export`, `both`): null, blank, or placeholder (`TBD`, `N/A`, …) values on any live legal column emit publication blockers and keep `readyForLabelDesign` false.

Internal / BOM / service sale types: legal fields `not_required` at Point 37 packaging layer.

## Boundaries preserved

- No Core migration or production mutation
- Point 34 factual composition, Point 38 workflow, media Points 41–47, Trace Point 95 — not absorbed
- Catalogue-ready gate and `label_status` workflow remain separate toggles

## Verification gates

Run at exact PR head:

- `npm run lint:biome:changed`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run check:boundaries`

**PR merged ≠ Point 37 programme cleared** — runtime/production evidence remains separate where required.
