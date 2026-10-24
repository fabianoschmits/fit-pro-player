-- Older clients still save snapshots. Their stale profile must not overwrite
-- the public identity derived from the current account preferences.
create or replace function public.save_own_account_snapshot(
  p_expected_revision bigint,
  p_state_schema_version integer,
  p_payload jsonb
)
returns table(status text, revision bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_row public.account_snapshots;
  caller uuid := auth.uid();
  gym_name text;
begin
  if caller is null then
    raise exception 'authenticated identity required' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0
    or p_state_schema_version is null
    or p_state_schema_version not between 1 and 1000 then
    raise exception 'invalid snapshot revision/schema' using errcode = '22023';
  end if;
  perform public.validate_professional_json(p_payload, 2097152);
  perform pg_advisory_xact_lock(hashtextextended('fitpp.snapshot:' || caller::text, 0));
  select * into current_row from public.account_snapshots where user_id = caller for update;
  if not found then
    if p_expected_revision <> 0 then
      return query select 'CONFLICT'::text, null::bigint, null::timestamptz;
      return;
    end if;
    insert into public.account_snapshots(user_id, revision, state_schema_version, payload)
    values (caller, 1, p_state_schema_version, p_payload)
    returning * into current_row;
  elsif current_row.revision <> p_expected_revision then
    return query select 'CONFLICT'::text, current_row.revision, current_row.updated_at;
    return;
  else
    update public.account_snapshots s
    set revision = s.revision + 1,
        state_schema_version = p_state_schema_version,
        payload = p_payload,
        updated_at = now()
    where user_id = caller
    returning * into current_row;
  end if;

  gym_name := left(btrim(coalesce(p_payload #>> '{profile,name}', '')), 120);
  if gym_name is not null and gym_name <> ''
    and not exists (
      select 1 from public.account_preferences p
      where p.user_id = caller
        and nullif(btrim(p.preferences #>> '{profile,name}'), '') is not null
    ) then
    update public.profiles
    set display_name = gym_name
    where id = caller
      and display_name is distinct from gym_name;
  end if;

  return query select 'APPLIED'::text, current_row.revision, current_row.updated_at;
end;
$$;

revoke all on function public.save_own_account_snapshot(bigint, integer, jsonb) from public, anon;
grant execute on function public.save_own_account_snapshot(bigint, integer, jsonb) to authenticated;
