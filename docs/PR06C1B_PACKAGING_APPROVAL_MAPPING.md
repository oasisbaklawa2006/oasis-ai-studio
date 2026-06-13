# PR-06C1b — Packaging Product Approval Mapping

**Wave:** 4A-0  
**Migration:** `supabase/migrations/20260610231247_pr06c1b_packaging_product_approve_mapping.sql`  
**Verification:** `scripts/supabase/PR06C1b_packaging_mapping_verify.sql`  
**Status:** Staging-ready — **not applied to production**

---

## Purpose

Extend `approve_catalogue_draft_internal` **product branch only** so governed `catalogue_product_drafts` approvals can promote Wave 4A packaging authority scalars into `public.products`.

Tag, alias, BOM, MOQ, pricing, and media branches are **unchanged** from PR-06C1a.

---

## New field mapping

| Draft path | Product column | Apply rule |
|------------|----------------|------------|
| `packing.packaging_scalars.grams_per_piece` | `grams_per_piece` | `coalesce(nullif(payload), existing)` on UPDATE |
| `packing.packaging_scalars.pcs_per_kg` | `pcs_per_kg` | same |
| `packing.packaging_scalars.primary_pack_weight_kg` | `primary_pack_weight_kg` | same |
| `packing.packaging_scalars.pcs_per_primary_pack` | `pcs_per_primary_pack` | same |
| `packing.packaging_scalars.carton_type` | `carton_type` | same (+ fallback `packing.carton_type` for Wave 4A payloads) |
| `packing.packaging_scalars.pcs_per_master_carton` | `pcs_per_master_carton` | same |
| `packing.packaging_scalars.packs_per_master_carton` | `packs_per_master_carton` | same |
| `packing.packaging_scalars.packs_per_carton` | `packs_per_carton` | same |

### `pack_size` precedence fix

| Operation | Behavior |
|-----------|----------|
| **UPDATE** | `coalesce(nullif(packing.pack_size,''), pack_size)` — never promotes `primary_pack_type` |
| **CREATE** | `coalesce(pack_size, pack_preview, primary_pack_type)` — backward compatible |

---

## Safety rules

1. `NULLIF(..., '')` before `::numeric` casts
2. UPDATE uses `coalesce(new_scalar, existing_column)` — absent/empty payload keys do not null-out master
3. Legacy ProductEdit drafts without `packaging_scalars` behave as before (identity/pricing unchanged)
4. No Central sync, UI, or draft submission changes

---

## Deployment

### Staging (required before production)

```bash
# Apply via Supabase CLI against staging project only
supabase db push   # or supabase migration up

# Verify
psql $STAGING_DATABASE_URL -f scripts/supabase/PR06C1b_packaging_mapping_verify.sql
```

### Manual approve test (staging only)

1. Select test SKU `OAS-AS-BKL-0001` product UUID
2. Record `pack_size`, `grams_per_piece`, `pcs_per_kg`, `mrp` **before**
3. Insert one `catalogue_product_drafts` row with payload from `data/packaging/batch001_packaging_drafts_payload.json[0]`
4. Call `approve_catalogue_product_draft(draft_id)` as reviewer
5. Confirm packaging columns populated; `pack_size = '3kg'`; pricing unchanged
6. Do **not** bulk-approve Wave 4A batch until spot-check passes

### Production

**Not applied.** Requires explicit sign-off after staging verification.

---

## Out of scope (Wave 4B+)

- MOQ (`catalogue_moq_drafts` still unmapped)
- `weight_per_pc_grams` / `kg_per_primary_pack` mirror fields
- `retail_pack_qty` (no product column)
- Auto-approve Wave 4A batch

---

## Related docs

- `docs/WAVE4A0_PACKAGING_APPROVAL_MAPPING_PACKET.md` — investigation
- `docs/BATCH001_PACKAGING_AUTHORITY_EXECUTION_PLAN.md` — Wave 4A execution
- `docs/PR06C_APPROVAL_MAPPING.md` — PR06C1a tag/alias mapping
