-- PR-06C1: Catalogue draft approval mapping (tag + alias only)
-- Prerequisites: PR06B applied (draft tables, reject_catalogue_draft, is_catalogue_reviewer).
-- Do not run against production until staging verification passes.
-- Does not modify BOM/MOQ/Pricing/Media/Product approve stubs.

BEGIN;

-- ---------------------------------------------------------------------------
-- Shared finalizer (internal; not granted to authenticated)
-- ---------------------------------------------------------------------------
create or replace function public.finalize_catalogue_draft_approval(
  p_draft_table text,
  p_draft_id uuid,
  p_draft_before jsonb,
  p_master_before jsonb default null,
  p_master_after jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_draft_after jsonb;
  v_before_snapshot jsonb;
  v_after_snapshot jsonb;
  v_allowed_tables constant text[] := array[
    'catalogue_tag_drafts',
    'catalogue_alias_drafts',
    'catalogue_product_drafts',
    'catalogue_media_submissions',
    'catalogue_bom_drafts',
    'catalogue_moq_drafts',
    'catalogue_pricing_drafts'
  ];
begin
  if not (p_draft_table = any (v_allowed_tables)) then
    raise exception 'Unsupported draft table for approval finalize: %', p_draft_table;
  end if;

  if p_draft_before is null then
    raise exception 'Draft before snapshot is required';
  end if;

  execute format(
    $sql$
      update %I
      set
        status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        updated_at = now()
      where id = $1
      returning to_jsonb(%I.*)
    $sql$,
    p_draft_table,
    p_draft_table
  )
  into v_draft_after
  using p_draft_id;

  if v_draft_after is null then
    raise exception 'Draft % not found in % during finalize', p_draft_id, p_draft_table;
  end if;

  v_before_snapshot := jsonb_build_object(
    'draft', p_draft_before,
    'master', coalesce(p_master_before, 'null'::jsonb)
  );

  v_after_snapshot := jsonb_build_object(
    'draft', v_draft_after,
    'master', coalesce(p_master_after, 'null'::jsonb)
  );

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
    'approved',
    auth.uid(),
    p_draft_before -> 'payload',
    v_before_snapshot,
    v_after_snapshot,
    'Approved via catalogue draft approval RPC'
  );
end;
$$;

revoke all on function public.finalize_catalogue_draft_approval(text, uuid, jsonb, jsonb, jsonb) from public;
revoke all on function public.finalize_catalogue_draft_approval(text, uuid, jsonb, jsonb, jsonb) from authenticated;

-- ---------------------------------------------------------------------------
-- Tag approval
-- ---------------------------------------------------------------------------
create or replace function public.approve_catalogue_tag_draft(draft_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d public.catalogue_tag_drafts%rowtype;
  v_draft_before jsonb;
  v_name text;
  v_group_name text;
  v_master_before jsonb;
  v_master_after jsonb;
  v_tag_id uuid;
begin
  if not public.is_catalogue_reviewer() then
    raise exception 'Not authorized to review catalogue drafts';
  end if;

  select *
  into d
  from public.catalogue_tag_drafts
  where id = draft_id
  for update;

  if not found then
    raise exception 'Draft not found in catalogue_tag_drafts';
  end if;

  if d.status <> 'pending_approval' then
    raise exception 'Only pending drafts can be approved';
  end if;

  if coalesce(d.payload ->> 'scope', '') <> 'tag_vocabulary' then
    raise exception 'Unexpected payload scope "%", expected "tag_vocabulary"', coalesce(d.payload ->> 'scope', '');
  end if;

  v_draft_before := to_jsonb(d);

  v_name := nullif(btrim(d.payload ->> 'name'), '');
  if v_name is null then
    raise exception 'Tag draft payload requires non-empty name';
  end if;

  v_group_name := nullif(btrim(d.payload ->> 'group_name'), '');
  if v_group_name is null then
    raise exception 'Tag draft payload requires group_name (tags.group_name is NOT NULL)';
  end if;

  if d.operation = 'update' then
    raise exception 'Tag vocabulary update is not supported yet; reject this draft or submit a new create/delete_request';
  elsif d.operation not in ('create', 'delete_request') then
    raise exception 'Unsupported tag draft operation: %', d.operation;
  end if;

  if d.operation = 'create' then
    begin
      insert into public.tags (name, group_name)
      values (v_name, v_group_name)
      returning id, to_jsonb(tags.*)
      into v_tag_id, v_master_after;
    exception
      when unique_violation then
        select t.id, to_jsonb(t.*)
        into v_tag_id, v_master_after
        from public.tags t
        where t.name = v_name
          and t.group_name = v_group_name;

        if v_master_after is null then
          raise exception 'Tag already exists but could not load existing row for name=% group=%', v_name, v_group_name;
        end if;
    end;

    perform public.finalize_catalogue_draft_approval(
      'catalogue_tag_drafts',
      d.id,
      v_draft_before,
      null,
      v_master_after
    );
    return;
  end if;

  -- delete_request
  if d.target_record_id is null then
    raise exception 'Tag delete_request requires target_record_id';
  end if;

  select to_jsonb(t.*)
  into v_master_before
  from public.tags t
  where t.id = d.target_record_id;

  if v_master_before is null then
    raise exception 'Tag not found for delete_request: %', d.target_record_id;
  end if;

  if nullif(btrim(v_master_before ->> 'name'), '') is distinct from v_name
     or nullif(btrim(v_master_before ->> 'group_name'), '') is distinct from v_group_name then
    raise exception 'Tag delete_request payload does not match target tag row';
  end if;

  delete from public.tags
  where id = d.target_record_id;

  perform public.finalize_catalogue_draft_approval(
    'catalogue_tag_drafts',
    d.id,
    v_draft_before,
    v_master_before,
    'null'::jsonb
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Alias approval
-- ---------------------------------------------------------------------------
create or replace function public.approve_catalogue_alias_draft(draft_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d public.catalogue_alias_drafts%rowtype;
  v_draft_before jsonb;
  v_product_id uuid;
  v_alias text;
  v_language text;
  v_script text;
  v_alias_type text;
  v_source text;
  v_is_active boolean;
  v_master_before jsonb;
  v_master_after jsonb;
  v_alias_id uuid;
begin
  if not public.is_catalogue_reviewer() then
    raise exception 'Not authorized to review catalogue drafts';
  end if;

  select *
  into d
  from public.catalogue_alias_drafts
  where id = draft_id
  for update;

  if not found then
    raise exception 'Draft not found in catalogue_alias_drafts';
  end if;

  if d.status <> 'pending_approval' then
    raise exception 'Only pending drafts can be approved';
  end if;

  if coalesce(d.payload ->> 'scope', '') <> 'product_alias' then
    raise exception 'Unexpected payload scope "%", expected "product_alias"', coalesce(d.payload ->> 'scope', '');
  end if;

  v_draft_before := to_jsonb(d);

  begin
    v_product_id := (d.payload ->> 'product_id')::uuid;
  exception
    when invalid_text_representation then
      raise exception 'Alias draft payload requires valid product_id uuid';
  end;

  if v_product_id is null then
    raise exception 'Alias draft payload requires product_id';
  end if;

  if not exists (select 1 from public.products p where p.id = v_product_id) then
    raise exception 'Product not found for alias draft: %', v_product_id;
  end if;

  v_alias := nullif(btrim(d.payload ->> 'alias'), '');
  if v_alias is null then
    raise exception 'Alias draft payload requires non-empty alias';
  end if;

  v_language := nullif(btrim(d.payload ->> 'language'), '');
  v_script := nullif(btrim(d.payload ->> 'script'), '');
  v_alias_type := coalesce(nullif(btrim(d.payload ->> 'alias_type'), ''), 'common_name');
  v_source := coalesce(nullif(btrim(d.payload ->> 'source'), ''), 'manual');

  if d.operation = 'create' then
    v_is_active := coalesce((d.payload ->> 'is_active')::boolean, true);

    insert into public.product_aliases (
      product_id,
      alias,
      language,
      script,
      alias_type,
      source,
      is_active
    )
    values (
      v_product_id,
      v_alias,
      v_language,
      v_script,
      v_alias_type,
      v_source,
      v_is_active
    )
    on conflict (product_id, normalized_alias) do nothing
    returning id, to_jsonb(product_aliases.*)
    into v_alias_id, v_master_after;

    if v_master_after is null then
      select pa.id, to_jsonb(pa.*)
      into v_alias_id, v_master_after
      from public.product_aliases pa
      where pa.product_id = v_product_id
        and pa.normalized_alias = public.normalize_alias(v_alias);
    end if;

    if v_master_after is null then
      raise exception 'Alias insert did not create or resolve an existing row';
    end if;

    perform public.finalize_catalogue_draft_approval(
      'catalogue_alias_drafts',
      d.id,
      v_draft_before,
      null,
      v_master_after
    );
    return;
  end if;

  if d.operation = 'update' then
    if d.target_record_id is null then
      raise exception 'Alias update requires target_record_id';
    end if;

    select to_jsonb(pa.*)
    into v_master_before
    from public.product_aliases pa
    where pa.id = d.target_record_id
    for update;

    if v_master_before is null then
      raise exception 'Alias not found for update: %', d.target_record_id;
    end if;

    if (v_master_before ->> 'product_id')::uuid is distinct from v_product_id then
      raise exception 'Alias update payload product_id does not match target row';
    end if;

    v_is_active := coalesce((d.payload ->> 'is_active')::boolean, (v_master_before ->> 'is_active')::boolean, true);

    update public.product_aliases pa
    set
      is_active = v_is_active,
      language = coalesce(v_language, pa.language),
      script = coalesce(v_script, pa.script),
      alias_type = v_alias_type,
      source = v_source
    where pa.id = d.target_record_id
    returning to_jsonb(pa.*)
    into v_master_after;

    perform public.finalize_catalogue_draft_approval(
      'catalogue_alias_drafts',
      d.id,
      v_draft_before,
      v_master_before,
      v_master_after
    );
    return;
  end if;

  if d.operation = 'delete_request' then
    if d.target_record_id is null then
      raise exception 'Alias delete_request requires target_record_id';
    end if;

    select to_jsonb(pa.*)
    into v_master_before
    from public.product_aliases pa
    where pa.id = d.target_record_id;

    if v_master_before is null then
      raise exception 'Alias not found for delete_request: %', d.target_record_id;
    end if;

    if (v_master_before ->> 'product_id')::uuid is distinct from v_product_id then
      raise exception 'Alias delete_request payload product_id does not match target row';
    end if;

    delete from public.product_aliases
    where id = d.target_record_id;

    perform public.finalize_catalogue_draft_approval(
      'catalogue_alias_drafts',
      d.id,
      v_draft_before,
      v_master_before,
      'null'::jsonb
    );
    return;
  end if;

  raise exception 'Unsupported alias draft operation: %', d.operation;
end;
$$;

-- Preserve existing grants on approve wrappers (PR06B)
grant execute on function public.approve_catalogue_tag_draft(uuid) to authenticated;
grant execute on function public.approve_catalogue_alias_draft(uuid) to authenticated;

COMMIT;
