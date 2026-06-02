-- PR-06C1a: Central-aware tag + alias approval mapping
-- Extends public.approve_catalogue_draft_internal only (no parallel engine).
-- Prerequisites: PR06B draft tables + Central product_tags / product_aliases / approve wrappers.
-- Staging only until verified. Do not run on production without sign-off.

BEGIN;

-- Optional slug helper for tag_key derivation (internal)
CREATE OR REPLACE FUNCTION public.catalogue_slugify_tag_part(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' FROM lower(regexp_replace(coalesce(nullif(btrim(p_text), ''), 'general'), '[^a-zA-Z0-9]+', '-', 'g')));
$$;

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
$function$;

COMMIT;
