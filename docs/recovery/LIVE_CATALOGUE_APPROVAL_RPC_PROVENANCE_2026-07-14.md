# Live Catalogue Approval RPC Provenance Capture

**This file is a point-in-time evidence record. It is not a migration.**
It must never be placed under `supabase/migrations/` or `scripts/supabase/`, and nothing in this
repository or any CI/CD pipeline should ever execute its contents. It exists solely so that the
live production definitions captured below are not the *only* copy of this information.

| | |
|---|---|
| Capture timestamp (UTC) | `2026-07-14T04:43:07Z` |
| Production project ref | `tcxvcatsqqertcnycuop` (`oasis-baklawa`) |
| Captured via | Direct read-only SQL introspection (`pg_proc`, `pg_get_functiondef`, `aclexplode`) against the live database. No writes were made. |
| Scope | The 16 catalogue-draft approval/rejection RPCs listed below, plus the row-count census of the tables they operate on. |

---

## ⚠️ Prominent security note — not yet remediated

**All 16 functions below are `SECURITY DEFINER`, owned by `postgres`, and grant `EXECUTE` to
`authenticated, anon, service_role, postgres` — including `anon`.**

This is broader than anything tracked in this repository: `main`'s own
`scripts/supabase/PR06B_draft_approval_migration.sql` only issues
`GRANT EXECUTE ... TO authenticated` for these functions. The live `anon` grant was applied
directly against production and was never captured in any committed script.

Each function's own internal `is_catalogue_reviewer()` check means an anonymous caller currently
receives `RAISE EXCEPTION 'Catalogue reviewer permission required'` rather than a bypass — this is
**not** presented as an active exploit. But the grant is unauthorized-by-source, is wider than the
principle of least privilege calls for on a `SECURITY DEFINER` function touching `products`,
`product_tags`, and `product_aliases`, and **remediation (tightening the grant to `authenticated`
only, matching the repository's own tracked intent) has not been applied.** This capture records
the fact; it does not fix it. Fixing it is out of scope for this Phase 1a task.

---

## Coexistence rule

Two independent draft/approval systems are simultaneously live in production today. They share no
tables, no functions, and no frontend calling code:

1. **Legacy seven-table workflow** (`catalogue_product_drafts`, `catalogue_media_submissions`,
   `catalogue_alias_drafts`, `catalogue_bom_drafts`, `catalogue_moq_drafts`,
   `catalogue_pricing_drafts`, `catalogue_tag_drafts`, plus `catalogue_approval_audit`) —
   field-level drafts submitted by contributors against existing or new master records, reviewed
   through `src/features/approvals/ApprovalInbox.tsx`. This is the system documented in this file.
   It is the higher-volume, actively-used system: 307 draft rows and 313 audit entries at capture
   time.
2. **AI Studio draft workflow** (`catalogue_ai_studio_drafts`, `catalogue_ai_studio_draft_audit_log`)
   — versioned AI-assisted catalogue-copy drafts for a single product at a time, owned by
   `src/features/catalogueAiStudio/catalogueDraftRepository.ts` and consumed by
   `src/pages/CatalogueProductStudio.tsx`. Lower volume: 5 draft rows and 15 audit entries at
   capture time.

**Neither system reads nor writes the other's tables.** The AI Studio workflow is not a
replacement for the legacy workflow, and the legacy workflow was not deprecated when the AI Studio
workflow was introduced — this is coexistence, not migration.

### The four soft-blocked approval types

Within the legacy workflow, `approve_catalogue_draft_internal` only implements a real
draft-to-master mapping for three of the seven draft types: **product** (`catalogue_product_drafts`
→ `products`), **tag** (`catalogue_tag_drafts` → `product_tags`), and **alias**
(`catalogue_alias_drafts` → `product_aliases`). The remaining four —
**BOM, MOQ, pricing, and media** — fall through to the function's final fallback branch, which
inserts an audit row with `action = 'approve_blocked_mapping_not_finalized'` and returns
`{ok:false, message:'Approval mapping not finalized for this draft type'}` rather than performing
any master-table write. This is corroborated by the live row census below: `catalogue_bom_drafts`,
`catalogue_moq_drafts`, `catalogue_pricing_drafts`, and `catalogue_media_submissions` each hold
exactly one `pending_approval` row and zero `approved` rows — consistent with the approve path
having never successfully completed for any of these four types. The corresponding **reject**
wrappers for all seven types, including these four, are fully implemented and functional live.

---

## Live row-count census (captured at the timestamp above)

| Table | Status | Count |
|---|---|---|
| `catalogue_product_drafts` | `approved` | 25 |
| `catalogue_product_drafts` | `pending_approval` | 1 |
| `catalogue_product_drafts` | `rejected` | 10 |
| `catalogue_alias_drafts` | `approved` | 267 |
| `catalogue_bom_drafts` | `pending_approval` | 1 |
| `catalogue_media_submissions` | `pending_approval` | 1 |
| `catalogue_moq_drafts` | `pending_approval` | 1 |
| `catalogue_pricing_drafts` | `pending_approval` | 1 |
| `catalogue_tag_drafts` | `—` | 0 |
| `catalogue_approval_audit` | `n/a (all actions)` | 313 |
| `catalogue_ai_studio_drafts` | `APPROVED` | 2 |
| `catalogue_ai_studio_drafts` | `DRAFT` | 1 |
| `catalogue_ai_studio_drafts` | `REJECTED` | 2 |
| `catalogue_ai_studio_draft_audit_log` | `n/a (all actions)` | 15 |

`catalogue_product_drafts` total: 36 (25 approved + 1 pending + 10 rejected).
`catalogue_alias_drafts` total: 267, all approved, zero pending or rejected.

---

## Per-function provenance

Common to all 16 functions below (verified per-function, identical in every case):
owner = `postgres`; `SECURITY DEFINER` = **true** (none are `SECURITY INVOKER`);
`search_path` = `public, pg_temp`; EXECUTE granted to **authenticated, anon, service_role, postgres**.

### `approve_catalogue_draft_internal`

- **Signature:** `approve_catalogue_draft_internal(p_draft_table text, p_draft_id uuid) → jsonb`
- **SHA-256 of `pg_get_functiondef` output:** `3e2f755fb78d207b1f59217695a29cb7818a9e5b8a1fb6ff5851d17ddc5744f4`
- **Live callers in Studio:** None directly — only reached via the 7 approve wrappers below.
- **Repository source status:** **TRACKED** — byte-identical to `main:scripts/supabase/PR06C1_central_tag_alias_approve_mapping.sql`, sourced from commit `6496831` ("PR-06C1a Central tag and alias approval in approve_catalogue_draft_internal", 2026-06-02), itself building on `993f8d9` ("PR-06C1 tag and alias catalogue draft approval mapping").

```sql
CREATE OR REPLACE FUNCTION public.approve_catalogue_draft_internal(p_draft_table text, p_draft_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_status text;
  v_payload jsonb;
  v_operation text;
  v_target_record_id uuid;
  v_product_id uuid;
  v_tag_id uuid;
  v_tag_key text;
  v_tag_label text;
  v_group_slug text;
  v_alias_id uuid;
  v_alias_text text;
  v_canonical_name text;
  v_master_before jsonb;
  v_allowed text[] := ARRAY[
    'catalogue_product_drafts',
    'catalogue_media_submissions',
    'catalogue_alias_drafts',
    'catalogue_bom_drafts',
    'catalogue_moq_drafts',
    'catalogue_pricing_drafts',
    'catalogue_tag_drafts'
  ];
BEGIN
  IF NOT public.is_catalogue_reviewer() THEN
    RAISE EXCEPTION 'Catalogue reviewer permission required';
  END IF;

  IF NOT (p_draft_table = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'Unsupported draft table: %', p_draft_table;
  END IF;

  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1 FOR UPDATE', p_draft_table)
    USING p_draft_id
    INTO v_before;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'Draft not found: %.%', p_draft_table, p_draft_id;
  END IF;

  v_status := v_before ->> 'status';

  IF v_status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Only pending_approval drafts can be approved. Current status: %', v_status;
  END IF;

  v_payload := v_before -> 'payload';
  v_operation := coalesce(v_before ->> 'operation', 'create');

  IF nullif(v_before ->> 'target_record_id', '') IS NOT NULL THEN
    v_target_record_id := (v_before ->> 'target_record_id')::uuid;
  END IF;

  -- -------------------------------------------------------------------------
  -- PRESERVED VERBATIM: catalogue_product_drafts branch (Central staging baseline)
  -- -------------------------------------------------------------------------
  IF p_draft_table = 'catalogue_product_drafts' THEN
    IF v_operation = 'create' OR v_target_record_id IS NULL THEN
      INSERT INTO public.products (
        sku,
        name,
        category,
        sub_category,
        description,
        department,
        production_department,
        hsn_code,
        gst_rate,
        gst_percentage,
        mrp,
        price_b2b,
        price_bulk,
        price_wholesale,
        wholesale_price,
        uom,
        is_active,
        visible_in_catalog,
        pack_size,
        ingredients,
        allergen_warnings,
        nutrition_facts,
        product_family,
        created_at
      )
      VALUES (
        coalesce(
          nullif(v_payload #>> '{sku_draft,sku}', ''),
          'DRAFT-' || upper(substr(gen_random_uuid()::text, 1, 8))
        ),
        coalesce(v_payload #>> '{identity,product_name}', 'Unnamed Product'),
        coalesce(v_payload #>> '{identity,category}', 'Uncategorized'),
        v_payload #>> '{identity,subcategory}',
        coalesce(
          v_payload #>> '{identity,description}',
          v_payload #>> '{identity,short_description}'
        ),
        v_payload #>> '{identity,main_department}',
        nullif(v_payload #>> '{identity,production_department}', ''),
        v_payload #>> '{pricing,hsn}',
        nullif(v_payload #>> '{pricing,gst_rate}', '')::numeric,
        nullif(v_payload #>> '{pricing,gst_rate}', '')::numeric,
        nullif(v_payload #>> '{pricing,mrp}', '')::numeric,
        nullif(v_payload #>> '{pricing,b2b_price}', '')::numeric,
        nullif(v_payload #>> '{pricing,bulk_price}', '')::numeric,
        nullif(v_payload #>> '{pricing,wholesale_price}', '')::numeric,
        nullif(v_payload #>> '{pricing,wholesale_price}', '')::numeric,
        v_payload #>> '{uom,primary_uom}',
        true,
        false,
        coalesce(
          v_payload #>> '{packing,pack_preview}',
          v_payload #>> '{packing,primary_pack_type}'
        ),
        v_payload #>> '{compliance,ingredients}',
        v_payload #>> '{compliance,allergen_information}',
        v_payload #>> '{compliance,nutritional_information}',
        coalesce(v_payload #>> '{identity,product_type}', 'General'),
        now()
      )
      RETURNING id INTO v_product_id;
    ELSE
      UPDATE public.products
      SET
        sku = coalesce(
          nullif(v_payload #>> '{sku_draft,sku}', ''),
          sku
        ),
        name = coalesce(v_payload #>> '{identity,product_name}', name),
        category = coalesce(v_payload #>> '{identity,category}', category),
        sub_category = coalesce(v_payload #>> '{identity,subcategory}', sub_category),
        description = coalesce(
          v_payload #>> '{identity,description}',
          v_payload #>> '{identity,short_description}',
          description
        ),
        department = coalesce(v_payload #>> '{identity,main_department}', department),
        production_department = coalesce(
          nullif(v_payload #>> '{identity,production_department}', ''),
          production_department
        ),
        hsn_code = coalesce(v_payload #>> '{pricing,hsn}', hsn_code),
        gst_rate = coalesce(nullif(v_payload #>> '{pricing,gst_rate}', '')::numeric, gst_rate),
        gst_percentage = coalesce(nullif(v_payload #>> '{pricing,gst_rate}', '')::numeric, gst_percentage),
        mrp = coalesce(nullif(v_payload #>> '{pricing,mrp}', '')::numeric, mrp),
        price_b2b = coalesce(nullif(v_payload #>> '{pricing,b2b_price}', '')::numeric, price_b2b),
        price_bulk = coalesce(nullif(v_payload #>> '{pricing,bulk_price}', '')::numeric, price_bulk),
        price_wholesale = coalesce(nullif(v_payload #>> '{pricing,wholesale_price}', '')::numeric, price_wholesale),
        wholesale_price = coalesce(nullif(v_payload #>> '{pricing,wholesale_price}', '')::numeric, wholesale_price),
        uom = coalesce(v_payload #>> '{uom,primary_uom}', uom),
        pack_size = coalesce(
          v_payload #>> '{packing,pack_preview}',
          v_payload #>> '{packing,primary_pack_type}',
          pack_size
        ),
        ingredients = coalesce(v_payload #>> '{compliance,ingredients}', ingredients),
        allergen_warnings = coalesce(v_payload #>> '{compliance,allergen_information}', allergen_warnings),
        nutrition_facts = coalesce(v_payload #>> '{compliance,nutritional_information}', nutrition_facts),
        product_family = coalesce(v_payload #>> '{identity,product_type}', product_family)
      WHERE id = v_target_record_id
      RETURNING id INTO v_product_id;

      IF v_product_id IS NULL THEN
        RAISE EXCEPTION 'Target product not found: %', v_target_record_id;
      END IF;
    END IF;

    EXECUTE format(
      'UPDATE public.%I
         SET status = ''approved'',
             target_record_id = $2,
             reviewed_by = auth.uid(),
             reviewed_at = now(),
             review_notes = ''Approved and mapped to public.products'',
             updated_at = now()
       WHERE id = $1',
      p_draft_table
    )
    USING p_draft_id, v_product_id;

    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1', p_draft_table)
      USING p_draft_id
      INTO v_after;

    INSERT INTO public.catalogue_approval_audit (
      draft_table,
      draft_id,
      action,
      performed_by,
      payload_snapshot,
      before_snapshot,
      after_snapshot,
      notes
    )
    VALUES (
      p_draft_table,
      p_draft_id,
      'approved',
      auth.uid(),
      v_payload,
      v_before,
      v_after,
      'Product draft approved and mapped to public.products'
    );

    RETURN jsonb_build_object(
      'ok', true,
      'action', 'approved',
      'draft_table', p_draft_table,
      'draft_id', p_draft_id,
      'target_record_id', v_product_id
    );
  END IF;
  -- -------------------------------------------------------------------------
  -- END PRESERVED product branch
  -- -------------------------------------------------------------------------

  -- -------------------------------------------------------------------------
  -- catalogue_tag_drafts -> public.product_tags
  -- -------------------------------------------------------------------------
  IF p_draft_table = 'catalogue_tag_drafts' THEN
    IF coalesce(v_payload ->> 'scope', '') <> 'tag_vocabulary' THEN
      RAISE EXCEPTION 'Unexpected payload scope "%", expected "tag_vocabulary"', coalesce(v_payload ->> 'scope', '');
    END IF;

    IF v_operation = 'update' THEN
      RAISE EXCEPTION 'Tag vocabulary update is not supported; reject or submit create/delete_request';
    END IF;

    IF v_operation NOT IN ('create', 'delete_request') THEN
      RAISE EXCEPTION 'Unsupported tag draft operation: %', v_operation;
    END IF;

    v_tag_label := nullif(btrim(coalesce(v_payload ->> 'tag_label', v_payload ->> 'name')), '');
    IF v_tag_label IS NULL THEN
      RAISE EXCEPTION 'Tag draft requires name or tag_label in payload';
    END IF;

    v_group_slug := public.catalogue_slugify_tag_part(coalesce(v_payload ->> 'group_name', 'general'));
    v_tag_key := nullif(btrim(v_payload ->> 'tag_key'), '');
    IF v_tag_key IS NULL THEN
      v_tag_key := v_group_slug || ':' || public.catalogue_slugify_tag_part(v_tag_label);
    END IF;

    IF v_operation = 'create' THEN
      BEGIN
        INSERT INTO public.product_tags (tag_key, tag_label, is_active, sort_order)
        VALUES (
          v_tag_key,
          v_tag_label,
          coalesce((v_payload ->> 'is_active')::boolean, true),
          coalesce((v_payload ->> 'sort_order')::integer, 0)
        )
        RETURNING id INTO v_tag_id;
      EXCEPTION
        WHEN unique_violation THEN
          SELECT pt.id
          INTO v_tag_id
          FROM public.product_tags pt
          WHERE pt.tag_key = v_tag_key;

          IF v_tag_id IS NULL THEN
            RAISE EXCEPTION 'Tag key conflict but existing row not found: %', v_tag_key;
          END IF;
      END;

      v_target_record_id := v_tag_id;
    ELSE
      IF v_target_record_id IS NULL THEN
        RAISE EXCEPTION 'Tag delete_request requires target_record_id';
      END IF;

      SELECT to_jsonb(pt.*)
      INTO v_master_before
      FROM public.product_tags pt
      WHERE pt.id = v_target_record_id;

      IF v_master_before IS NULL THEN
        RAISE EXCEPTION 'Tag not found for delete_request: %', v_target_record_id;
      END IF;

      IF v_tag_label IS DISTINCT FROM (v_master_before ->> 'tag_label') THEN
        RAISE EXCEPTION 'Tag delete_request payload label does not match target tag row';
      END IF;

      v_tag_id := v_target_record_id;
      DELETE FROM public.product_tags WHERE id = v_target_record_id;
    END IF;

    EXECUTE format(
      'UPDATE public.%I
         SET status = ''approved'',
             target_record_id = $2,
             reviewed_by = auth.uid(),
             reviewed_at = now(),
             review_notes = ''Approved and mapped to public.product_tags'',
             updated_at = now()
       WHERE id = $1',
      p_draft_table
    )
    USING p_draft_id, v_tag_id;

    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1', p_draft_table)
      USING p_draft_id
      INTO v_after;

    INSERT INTO public.catalogue_approval_audit (
      draft_table,
      draft_id,
      action,
      performed_by,
      payload_snapshot,
      before_snapshot,
      after_snapshot,
      notes
    )
    VALUES (
      p_draft_table,
      p_draft_id,
      'approved',
      auth.uid(),
      v_payload,
      v_before,
      v_after,
      CASE WHEN v_operation = 'delete_request' THEN 'Tag delete_request approved (public.product_tags)' ELSE 'Tag create approved (public.product_tags)' END
    );

    RETURN jsonb_build_object(
      'ok', true,
      'action', 'approved',
      'draft_table', p_draft_table,
      'draft_id', p_draft_id,
      'target_record_id', v_tag_id,
      'tag_key', v_tag_key
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- catalogue_alias_drafts -> public.product_aliases
  -- -------------------------------------------------------------------------
  IF p_draft_table = 'catalogue_alias_drafts' THEN
    IF coalesce(v_payload ->> 'scope', '') <> 'product_alias' THEN
      RAISE EXCEPTION 'Unexpected payload scope "%", expected "product_alias"', coalesce(v_payload ->> 'scope', '');
    END IF;

    BEGIN
      v_product_id := nullif(btrim(v_payload ->> 'product_id'), '')::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Alias draft requires valid product_id uuid';
    END;

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Alias draft requires product_id';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = v_product_id) THEN
      RAISE EXCEPTION 'Product not found for alias draft: %', v_product_id;
    END IF;

    v_alias_text := nullif(btrim(coalesce(v_payload ->> 'alias_text', v_payload ->> 'alias')), '');
    IF v_alias_text IS NULL THEN
      RAISE EXCEPTION 'Alias draft requires alias or alias_text in payload';
    END IF;

    v_canonical_name := nullif(btrim(coalesce(v_payload ->> 'canonical_name', v_payload ->> 'product_name')), '');
    IF v_canonical_name IS NULL THEN
      SELECT p.name
      INTO v_canonical_name
      FROM public.products p
      WHERE p.id = v_product_id;
    END IF;

    IF v_canonical_name IS NULL OR btrim(v_canonical_name) = '' THEN
      RAISE EXCEPTION 'Alias draft requires canonical_name or resolvable products.name for product_id %', v_product_id;
    END IF;

    IF v_operation = 'create' THEN
      INSERT INTO public.product_aliases (alias_text, canonical_name, product_id)
      VALUES (v_alias_text, v_canonical_name, v_product_id)
      RETURNING id INTO v_alias_id;

      v_target_record_id := v_alias_id;
    ELSIF v_operation = 'update' THEN
      IF v_target_record_id IS NULL THEN
        RAISE EXCEPTION 'Alias update requires target_record_id';
      END IF;

      SELECT to_jsonb(pa.*)
      INTO v_master_before
      FROM public.product_aliases pa
      WHERE pa.id = v_target_record_id
      FOR UPDATE;

      IF v_master_before IS NULL THEN
        RAISE EXCEPTION 'Alias not found for update: %', v_target_record_id;
      END IF;

      IF (v_master_before ->> 'product_id')::uuid IS DISTINCT FROM v_product_id THEN
        RAISE EXCEPTION 'Alias update payload product_id does not match target row';
      END IF;

      UPDATE public.product_aliases pa
      SET
        alias_text = v_alias_text,
        canonical_name = v_canonical_name,
        product_id = v_product_id
      WHERE pa.id = v_target_record_id
      RETURNING pa.id INTO v_alias_id;
    ELSIF v_operation = 'delete_request' THEN
      IF v_target_record_id IS NULL THEN
        RAISE EXCEPTION 'Alias delete_request requires target_record_id';
      END IF;

      SELECT to_jsonb(pa.*)
      INTO v_master_before
      FROM public.product_aliases pa
      WHERE pa.id = v_target_record_id;

      IF v_master_before IS NULL THEN
        RAISE EXCEPTION 'Alias not found for delete_request: %', v_target_record_id;
      END IF;

      IF (v_master_before ->> 'product_id')::uuid IS DISTINCT FROM v_product_id THEN
        RAISE EXCEPTION 'Alias delete_request payload product_id does not match target row';
      END IF;

      v_alias_id := v_target_record_id;
      DELETE FROM public.product_aliases WHERE id = v_target_record_id;
    ELSE
      RAISE EXCEPTION 'Unsupported alias draft operation: %', v_operation;
    END IF;

    EXECUTE format(
      'UPDATE public.%I
         SET status = ''approved'',
             target_record_id = $2,
             reviewed_by = auth.uid(),
             reviewed_at = now(),
             review_notes = ''Approved and mapped to public.product_aliases'',
             updated_at = now()
       WHERE id = $1',
      p_draft_table
    )
    USING p_draft_id, v_alias_id;

    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1', p_draft_table)
      USING p_draft_id
      INTO v_after;

    INSERT INTO public.catalogue_approval_audit (
      draft_table,
      draft_id,
      action,
      performed_by,
      payload_snapshot,
      before_snapshot,
      after_snapshot,
      notes
    )
    VALUES (
      p_draft_table,
      p_draft_id,
      'approved',
      auth.uid(),
      v_payload,
      v_before,
      v_after,
      'Alias draft approved and mapped to public.product_aliases'
    );

    RETURN jsonb_build_object(
      'ok', true,
      'action', 'approved',
      'draft_table', p_draft_table,
      'draft_id', p_draft_id,
      'target_record_id', v_alias_id
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Unmapped draft types (BOM, MOQ, pricing, media) — unchanged soft block
  -- -------------------------------------------------------------------------
  INSERT INTO public.catalogue_approval_audit (
    draft_table,
    draft_id,
    action,
    performed_by,
    payload_snapshot,
    before_snapshot,
    after_snapshot,
    notes
  )
  VALUES (
    p_draft_table,
    p_draft_id,
    'approve_blocked_mapping_not_finalized',
    auth.uid(),
    v_payload,
    v_before,
    NULL,
    'Approval mapping not finalized for this draft type'
  );

  RETURN jsonb_build_object(
    'ok', false,
    'action', 'approve_blocked_mapping_not_finalized',
    'draft_table', p_draft_table,
    'draft_id', p_draft_id,
    'message', 'Approval mapping not finalized for this draft type'
  );
END;
$function$
```

### `reject_catalogue_draft_internal`

- **Signature:** `reject_catalogue_draft_internal(p_draft_table text, p_draft_id uuid, p_reason text) → jsonb`
- **SHA-256 of `pg_get_functiondef` output:** `5a931172b0e7f2d362263858c496712758e68b7edc82bb72eb27a2d06be421b1`
- **Live callers in Studio:** None directly — only reached via the 7 reject wrappers below.
- **Repository source status:** **ABSENT** — not found in any commit on any branch of `oasis-ai-studio` or `oasis-supabase-core`. This is the single largest gap this capture closes.

```sql
CREATE OR REPLACE FUNCTION public.reject_catalogue_draft_internal(p_draft_table text, p_draft_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_before jsonb;
  v_after jsonb;
  v_status text;
  v_allowed text[] := array[
    'catalogue_product_drafts',
    'catalogue_media_submissions',
    'catalogue_alias_drafts',
    'catalogue_bom_drafts',
    'catalogue_moq_drafts',
    'catalogue_pricing_drafts',
    'catalogue_tag_drafts'
  ];
begin
  if not public.is_catalogue_reviewer() then
    raise exception 'Catalogue reviewer permission required';
  end if;

  if not (p_draft_table = any(v_allowed)) then
    raise exception 'Unsupported draft table: %', p_draft_table;
  end if;

  execute format('select to_jsonb(t) from public.%I t where id = $1 for update', p_draft_table)
    using p_draft_id
    into v_before;

  if v_before is null then
    raise exception 'Draft not found: %.%', p_draft_table, p_draft_id;
  end if;

  v_status := v_before ->> 'status';

  if v_status <> 'pending_approval' then
    raise exception 'Only pending_approval drafts can be rejected. Current status: %', v_status;
  end if;

  execute format(
    'update public.%I
       set status = ''rejected'',
           reviewed_by = auth.uid(),
           reviewed_at = now(),
           review_notes = $2,
           updated_at = now()
     where id = $1',
    p_draft_table
  )
  using p_draft_id, p_reason;

  execute format('select to_jsonb(t) from public.%I t where id = $1', p_draft_table)
    using p_draft_id
    into v_after;

  insert into public.catalogue_approval_audit (
    draft_table,
    draft_id,
    action,
    performed_by,
    payload_snapshot,
    before_snapshot,
    after_snapshot,
    notes
  )
  values (
    p_draft_table,
    p_draft_id,
    'rejected',
    auth.uid(),
    v_before -> 'payload',
    v_before,
    v_after,
    p_reason
  );

  return jsonb_build_object(
    'ok', true,
    'action', 'rejected',
    'draft_table', p_draft_table,
    'draft_id', p_draft_id
  );
end;
$function$
```

### `approve_catalogue_product_draft`

- **Signature:** `approve_catalogue_product_draft(draft_id uuid) → jsonb`
- **SHA-256 of `pg_get_functiondef` output:** `2381e8acad6b97cc58f7c43196ca7cbda935195ea4deecd7b02e2578474a1106`
- **Live callers in Studio:** `src/features/approvals/ApprovalInbox.tsx` (`product` row definition) and `src/features/catalogueDrafts/draftTableMap.ts`
- **Repository source status:** **STALE** — `main`'s tracked `scripts/supabase/PR06B_draft_approval_migration.sql` (from commit `a42805b`) defines this as a `RETURNS void` plpgsql stub whose entire body is `RAISE EXCEPTION 'Product approval mapping not finalized'`. Live is `RETURNS jsonb`, `LANGUAGE sql`, and delegates to `approve_catalogue_draft_internal`.

```sql
CREATE OR REPLACE FUNCTION public.approve_catalogue_product_draft(draft_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.approve_catalogue_draft_internal('catalogue_product_drafts', draft_id);
$function$
```

### `reject_catalogue_product_draft`

- **Signature:** `reject_catalogue_product_draft(draft_id uuid, reason text) → jsonb`
- **SHA-256 of `pg_get_functiondef` output:** `1358455a326f5671448d5b0a49853bc320efd84c198fefa156d5cb6ee4befbf5`
- **Live callers in Studio:** `src/features/approvals/ApprovalInbox.tsx` (`product` row definition) and `src/features/catalogueDrafts/draftTableMap.ts`
- **Repository source status:** **STALE** — tracked version delegates to a 3-argument `reject_catalogue_draft(text, uuid, text)` helper (also `PR06B_draft_approval_migration.sql`). Live delegates to `reject_catalogue_draft_internal`, a name that does not exist anywhere in git. The tracked `reject_catalogue_draft` helper itself no longer exists in production (confirmed absent from live introspection) — drift runs in both directions.

```sql
CREATE OR REPLACE FUNCTION public.reject_catalogue_product_draft(draft_id uuid, reason text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.reject_catalogue_draft_internal('catalogue_product_drafts', draft_id, reason);
$function$
```

### `approve_catalogue_media_submission`

- **Signature:** `approve_catalogue_media_submission(draft_id uuid) → jsonb`
- **SHA-256 of `pg_get_functiondef` output:** `b5575533de6fbd9fcd58b4f8293c2e255b9b53c512796e77effc56a52357e91e`
- **Live callers in Studio:** `src/features/approvals/ApprovalInbox.tsx` (`media` row definition) and `src/features/catalogueDrafts/draftTableMap.ts`
- **Repository source status:** **STALE** — same stub-vs-delegate pattern as `approve_catalogue_product_draft`.

```sql
CREATE OR REPLACE FUNCTION public.approve_catalogue_media_submission(draft_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.approve_catalogue_draft_internal('catalogue_media_submissions', draft_id);
$function$
```

### `reject_catalogue_media_submission`

- **Signature:** `reject_catalogue_media_submission(draft_id uuid, reason text) → jsonb`
- **SHA-256 of `pg_get_functiondef` output:** `b4a3e4fddbc95e1cd00a4a32100fadddbdfbf0985073ec49bd42cf48a9bd2cca`
- **Live callers in Studio:** `src/features/approvals/ApprovalInbox.tsx` (`media` row definition) and `src/features/catalogueDrafts/draftTableMap.ts`
- **Repository source status:** **STALE** — same pattern as `reject_catalogue_product_draft`.

```sql
CREATE OR REPLACE FUNCTION public.reject_catalogue_media_submission(draft_id uuid, reason text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.reject_catalogue_draft_internal('catalogue_media_submissions', draft_id, reason);
$function$
```

### `approve_catalogue_alias_draft`

- **Signature:** `approve_catalogue_alias_draft(draft_id uuid) → jsonb`
- **SHA-256 of `pg_get_functiondef` output:** `cd5bd665297aa54a0aabac03102624ba32724d368592b08883ca75f10d456812`
- **Live callers in Studio:** `src/features/approvals/ApprovalInbox.tsx` (`alias` row definition) and `src/features/catalogueDrafts/draftTableMap.ts`
- **Repository source status:** **STALE** — same stub-vs-delegate pattern.

```sql
CREATE OR REPLACE FUNCTION public.approve_catalogue_alias_draft(draft_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.approve_catalogue_draft_internal('catalogue_alias_drafts', draft_id);
$function$
```

### `reject_catalogue_alias_draft`

- **Signature:** `reject_catalogue_alias_draft(draft_id uuid, reason text) → jsonb`
- **SHA-256 of `pg_get_functiondef` output:** `e8d84371cd771791340273742ba196bdb3d4ac19cf5657609c2355b5512ba38c`
- **Live callers in Studio:** `src/features/approvals/ApprovalInbox.tsx` (`alias` row definition) and `src/features/catalogueDrafts/draftTableMap.ts`
- **Repository source status:** **STALE** — same pattern.

```sql
CREATE OR REPLACE FUNCTION public.reject_catalogue_alias_draft(draft_id uuid, reason text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.reject_catalogue_draft_internal('catalogue_alias_drafts', draft_id, reason);
$function$
```

### `approve_catalogue_bom_draft`

- **Signature:** `approve_catalogue_bom_draft(draft_id uuid) → jsonb`
- **SHA-256 of `pg_get_functiondef` output:** `c3ec19a378c0f3c51ca641bb70238cf4f7479da617eefd6f26c92ed1a7b72b69`
- **Live callers in Studio:** `src/features/approvals/ApprovalInbox.tsx` (`bom` row definition) and `src/features/catalogueDrafts/draftTableMap.ts`
- **Repository source status:** **STALE** — same stub-vs-delegate pattern. Live delegate reaches `approve_catalogue_draft_internal`'s fallback branch (BOM is not one of the three mapped types), returning `{ok:false, action:'approve_blocked_mapping_not_finalized'}` rather than raising — a materially different (safer) failure mode than the tracked stub's hard exception.

```sql
CREATE OR REPLACE FUNCTION public.approve_catalogue_bom_draft(draft_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.approve_catalogue_draft_internal('catalogue_bom_drafts', draft_id);
$function$
```

### `reject_catalogue_bom_draft`

- **Signature:** `reject_catalogue_bom_draft(draft_id uuid, reason text) → jsonb`
- **SHA-256 of `pg_get_functiondef` output:** `c46fbb80d7a956d7217e14473388557522d78700dc2d5c586edc5f1614f88cf3`
- **Live callers in Studio:** `src/features/approvals/ApprovalInbox.tsx` (`bom` row definition) and `src/features/catalogueDrafts/draftTableMap.ts`
- **Repository source status:** **STALE** — same pattern; reject path is fully implemented for all 7 types (unlike approve), so this one actually completes successfully live.

```sql
CREATE OR REPLACE FUNCTION public.reject_catalogue_bom_draft(draft_id uuid, reason text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.reject_catalogue_draft_internal('catalogue_bom_drafts', draft_id, reason);
$function$
```

### `approve_catalogue_moq_draft`

- **Signature:** `approve_catalogue_moq_draft(draft_id uuid) → jsonb`
- **SHA-256 of `pg_get_functiondef` output:** `28a747a4ff2a53d2dd653314d5298fda975f683ff7f283d2410bd4c664c3e202`
- **Live callers in Studio:** `src/features/approvals/ApprovalInbox.tsx` (`moq` row definition) and `src/features/catalogueDrafts/draftTableMap.ts`
- **Repository source status:** **STALE** — same as `approve_catalogue_bom_draft` (soft-blocked live).

```sql
CREATE OR REPLACE FUNCTION public.approve_catalogue_moq_draft(draft_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.approve_catalogue_draft_internal('catalogue_moq_drafts', draft_id);
$function$
```

### `reject_catalogue_moq_draft`

- **Signature:** `reject_catalogue_moq_draft(draft_id uuid, reason text) → jsonb`
- **SHA-256 of `pg_get_functiondef` output:** `139849b83385793af832ec9a8a44ba1c01dc74c3e2b22ac730ae6217d6ba6e25`
- **Live callers in Studio:** `src/features/approvals/ApprovalInbox.tsx` (`moq` row definition) and `src/features/catalogueDrafts/draftTableMap.ts`
- **Repository source status:** **STALE** — same pattern as `reject_catalogue_bom_draft` (completes successfully live).

```sql
CREATE OR REPLACE FUNCTION public.reject_catalogue_moq_draft(draft_id uuid, reason text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.reject_catalogue_draft_internal('catalogue_moq_drafts', draft_id, reason);
$function$
```

### `approve_catalogue_pricing_draft`

- **Signature:** `approve_catalogue_pricing_draft(draft_id uuid) → jsonb`
- **SHA-256 of `pg_get_functiondef` output:** `96ded88d759fa6de73179e718b7ad9dcbf7d7e807b1e7491be1abb033e0efb10`
- **Live callers in Studio:** `src/features/approvals/ApprovalInbox.tsx` (`pricing` row definition) and `src/features/catalogueDrafts/draftTableMap.ts`
- **Repository source status:** **STALE** — same as `approve_catalogue_bom_draft` (soft-blocked live).

```sql
CREATE OR REPLACE FUNCTION public.approve_catalogue_pricing_draft(draft_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.approve_catalogue_draft_internal('catalogue_pricing_drafts', draft_id);
$function$
```

### `reject_catalogue_pricing_draft`

- **Signature:** `reject_catalogue_pricing_draft(draft_id uuid, reason text) → jsonb`
- **SHA-256 of `pg_get_functiondef` output:** `0c817f2044995b50f1907d33584d19f6441c98a15ed15e95c6048ba2fc51d236`
- **Live callers in Studio:** `src/features/approvals/ApprovalInbox.tsx` (`pricing` row definition) and `src/features/catalogueDrafts/draftTableMap.ts`
- **Repository source status:** **STALE** — same pattern (completes successfully live).

```sql
CREATE OR REPLACE FUNCTION public.reject_catalogue_pricing_draft(draft_id uuid, reason text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.reject_catalogue_draft_internal('catalogue_pricing_drafts', draft_id, reason);
$function$
```

### `approve_catalogue_tag_draft`

- **Signature:** `approve_catalogue_tag_draft(draft_id uuid) → jsonb`
- **SHA-256 of `pg_get_functiondef` output:** `a0214465a4fecd136433d9022d0003563dcda0cf8a1f22b1b4f709324f83b670`
- **Live callers in Studio:** `src/features/approvals/ApprovalInbox.tsx` (`tag` row definition) and `src/features/catalogueDrafts/draftTableMap.ts`
- **Repository source status:** **STALE** — unlike bom/moq/pricing/media, `catalogue_tag_drafts` IS one of the three mapped types in `approve_catalogue_draft_internal`, so this one fully succeeds live once called; only the wrapper source is stale, not the outcome.

```sql
CREATE OR REPLACE FUNCTION public.approve_catalogue_tag_draft(draft_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.approve_catalogue_draft_internal('catalogue_tag_drafts', draft_id);
$function$
```

### `reject_catalogue_tag_draft`

- **Signature:** `reject_catalogue_tag_draft(draft_id uuid, reason text) → jsonb`
- **SHA-256 of `pg_get_functiondef` output:** `f7a620aa8d30763074b2fce0b1766b841b05117bcddf2c1903f8f190b86efb9d`
- **Live callers in Studio:** `src/features/approvals/ApprovalInbox.tsx` (`tag` row definition) and `src/features/catalogueDrafts/draftTableMap.ts`
- **Repository source status:** **STALE** — same wrapper-source drift; reject path already worked either way.

```sql
CREATE OR REPLACE FUNCTION public.reject_catalogue_tag_draft(draft_id uuid, reason text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.reject_catalogue_draft_internal('catalogue_tag_drafts', draft_id, reason);
$function$
```

---

## Capture method (for reproducibility)

```sql
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args,
  pg_get_function_result(p.oid) as returns,
  p.prosecdef as security_definer,
  pg_get_userbyid(p.proowner) as owner,
  p.proconfig as config,
  pg_get_functiondef(p.oid) as fn_def,
  encode(digest(pg_get_functiondef(p.oid), 'sha256'), 'hex') as sha256_of_fndef,
  (select array_agg(grantee.rolname) from aclexplode(p.proacl) a
     join pg_roles grantee on grantee.oid = a.grantee) as grantees
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (/* the 16 names above */);
```

Row-count census: `select status, count(*) from public.<table> group by status` for each of the
nine tables listed above, executed in the same session immediately after the function capture.

