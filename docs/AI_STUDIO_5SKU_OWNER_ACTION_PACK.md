# AI Studio 5-SKU Owner Action Pack

_Date: 2026-03-13 · Pilot: 5 anchor SKUs · Project: `tcxvcatsqqertcnycuop`_

**Purpose:** Explicit owner/ops actions required to move 5-SKU pilot from **authoring GO** to **approval GO**.  
**Rules honored:** No destructive SQL applied from this pack. Each action is documented for sign-off before execution.

---

## Priority order

1. **Infra confirm** (bucket + RPCs) — blocks uploads and governed approve
2. **Packaging apply** — blocks Product Truth and MOQ
3. **Hero media** — blocks catalogue and Central preview
4. **HSN/GST confirm** — blocks compliance approval
5. **Search alias types** — blocks full language authority (optional for minimal pilot if WA aliases exist)

---

## OA-1 — Confirm `product-media` storage bucket

| Field | Value |
|-------|-------|
| **Owner** | Supabase admin |
| **Risk** | Low (additive) |
| **Blocks** | Fast Create upload, ProductMediaUploader |

### Action

1. Supabase Dashboard → Storage → verify bucket **`product-media`** exists and is **public read**.
2. If missing, apply migration: `supabase/migrations/20260506093134_87d1b4de-b0d8-423a-9fe3-7c75efe3381b.sql`
3. Smoke: upload test image via AI Studio Fast Create or Product Edit Media tab.

### Verify

```bash
npm run verify:pilot-readiness
# Expect: product-media bucket: available
```

---

## OA-2 — Verify `generate_oasis_sku` RPC

| Field | Value |
|-------|-------|
| **Owner** | Supabase admin |
| **Risk** | Low (read test only) |
| **Blocks** | Fast Create, new product SKU assignment |

### Action

1. SQL editor: `SELECT public.generate_oasis_sku('AS','BKL','ASS','LOOSE');`
2. Confirm `sku_code_rules` has active division/category/subcategory/packaging rows.

### Verify

- Fast Create → Generate suggestions → **Structured SKU** panel shows `OAS-…` (not error banner).

---

## OA-3 — Verify approve/reject catalogue RPCs

| Field | Value |
|-------|-------|
| **Owner** | Supabase admin |
| **Risk** | Medium — governs master writes |
| **Blocks** | Contributor draft approval path |

### Action

1. Confirm PR06B migration applied: `scripts/supabase/PR06B_draft_approval_migration.sql` (owner sign-off).
2. SQL: list functions `approve_catalogue_product_draft`, `reject_catalogue_product_draft`, `approve_catalogue_alias_draft`, etc.
3. Regenerate types:  
   `supabase gen types typescript --project-id tcxvcatsqqertcnycuop > src/integrations/supabase/types.ts`

### Verify

- `/testing/pilot-readiness` → Infrastructure → approve/reject RPC **pass** (probe may show validation error — that means RPC exists).

---

## OA-4 — Verify `search_products_with_aliases` RPC

| Field | Value |
|-------|-------|
| **Owner** | Supabase admin |
| **Risk** | Low |
| **Blocks** | Alias-aware product search (ProductPicker, catalogue builder) |

### Action

```sql
SELECT * FROM public.search_products_with_aliases('cashew kitta') LIMIT 5;
```

### Verify

- Products page search returns "Matched by alias" when applicable (no console RPC fallback warning).

---

## OA-5 — Apply packaging authority (5 SKUs only)

| Field | Value |
|-------|-------|
| **Owner** | Ops + catalogue reviewer |
| **Risk** | Medium — governed master update |
| **Blocks** | Pilot gate `grams_per_piece` / `pcs_per_kg` |

**Do not** run blind SQL updates. Use **catalogue product drafts** per `BATCH001_PACKAGING_AUTHORITY_REPORT.md` Wave 4A.

| SKU | Authority g/pc | Authority pcs/kg |
|-----|----------------|------------------|
| OAS-AS-BKL-0001 | 18 | 55.6 |
| OAS-AS-BKL-0007 | 11 | 90.9 |
| OAS-AS-BKL-0020 | 26 | 38.5 |
| OAS-AS-BKL-0024 | 18 | 55.6 |
| OAS-AS-BKL-0025 | TBD — confirm CSV | TBD |

### Action per SKU

1. Product Edit → Packaging tab → set `approximate_piece_weight_g` and `pieces_per_kg` **or** submit governed draft with `packaging_authority_republish: true`.
2. Reviewer approves via Approval Inbox.

### Verify

- `/testing/pilot-readiness` → Packaging **pass** for each SKU.

---

## OA-6 — Upload hero images (5 SKUs minimum)

| Field | Value |
|-------|-------|
| **Owner** | Ops / photography |
| **Risk** | Low |
| **Blocks** | Hero, catalogue, Central preview |

### Action per SKU

1. Product Edit → Media → upload hero (min 800×800).
2. Confirm both `hero_image_url` and `image_url` populated on save.
3. Optional: add `square_image` or `white_background` row in `product_media` for catalogue profile.

### Verify

- Pilot readiness → Hero **pass**; Square **pass** when square asset uploaded.

---

## OA-7 — Confirm HSN/GST on product rows

| Field | Value |
|-------|-------|
| **Owner** | Compliance reviewer |
| **Risk** | Medium |
| **Blocks** | Compliance approval, invoice path |

### Suggested values (review required)

| Field | Suggested | Disclaimer |
|-------|-----------|------------|
| HSN | `21069099` | From language authority preview — not legal truth until approved |
| GST | `5` or `18` | Confirm with compliance; category prefeed uses 18% for baklawa UI default |

### Action

1. Product Edit → Compliance → set HSN + GST.
2. Use Compliance AI as **suggest only**; manual approve per governance.

### Verify

- Pilot readiness → HSN/GST **pass**.

---

## OA-8 — Alias completeness (5 SKUs)

| SKU | DB aliases (reported) | Target |
|-----|----------------------|--------|
| 0024 | 21 | ≥3 + ≥1 WA `alias_type` |
| 0020 | 19 | same |
| 0001 | 12 | same |
| 0025 | 12 | same |
| 0007 | 11 | same |

### Gap

Wave 2A submitted `official_alias` + `whatsapp_keyword` only. **`search_keyword` rows may be missing in DB.**

### Action (if search dimension required)

1. Submit alias drafts with `alias_type: search_keyword` via AliasManager or batch script.
2. Approve via `approve_catalogue_alias_draft`.

### Optional migration (separate sign-off)

See `docs/AI_STUDIO_5SKU_ALIAS_AUTHORITY_PLAN.md` — `term_type` column **not applied**.

---

## OA-9 — Live readiness refresh

| Field | Value |
|-------|-------|
| **Owner** | Studio dev / ops |
| **Risk** | None (read-only) |

```bash
cp .env.example .env
# Fill VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm run verify:pilot-readiness
```

Updates `data/pilot/ai_studio_5sku_readiness_matrix.csv` from live DB.

---

## OA-10 — Owner smoke checklist (post actions)

- [ ] `/testing/pilot-readiness` shows ≥1 SKU **Ready** (stretch: 5/5)
- [ ] Fast Create completes without SKU or schema error
- [ ] Media upload succeeds (no bucket banner)
- [ ] Approval Inbox approves a test **product draft** (non-prod SKU) without RPC error
- [ ] Search `cashew kitta` resolves OAS-AS-BKL-0001

---

## Sign-off template

| Action ID | Owner | Date | Status |
|-----------|-------|------|--------|
| OA-1 product-media | | | |
| OA-2 generate_oasis_sku | | | |
| OA-3 approve RPCs | | | |
| OA-4 search RPC | | | |
| OA-5 packaging (5 SKUs) | | | |
| OA-6 hero images (5 SKUs) | | | |
| OA-7 HSN/GST | | | |
| OA-8 search aliases | | | |
| OA-9 live matrix refresh | | | |
| OA-10 smoke | | | |

**Pilot approval GO criteria:** OA-1 through OA-7 complete for all 5 SKUs; OA-8 if search channel required.
