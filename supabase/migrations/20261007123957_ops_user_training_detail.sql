-- Ops user training detail from account_snapshots; sync gym profile.name → profiles.display_name.

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
  if gym_name is not null and gym_name <> '' then
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

-- Backfill names already present in snapshots (local + registered).
update public.profiles p
set display_name = left(btrim(s.payload #>> '{profile,name}'), 120)
from public.account_snapshots s
where s.user_id = p.id
  and nullif(btrim(s.payload #>> '{profile,name}'), '') is not null
  and (
    nullif(btrim(p.display_name), '') is null
    or p.display_name = 'Utilizador local'
  );

drop function if exists public.ops_list_users(text, text, integer, integer);

create or replace function public.ops_list_users(
  p_query text default null,
  p_account_kind text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  email text,
  display_name text,
  avatar_ref text,
  created_at timestamptz,
  suspended_at timestamptz,
  roles text[],
  has_professional_profile boolean,
  verification_status public.professional_verification_status,
  student_links integer,
  professional_links integer,
  is_anonymous boolean,
  account_kind text
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  needle text := nullif(lower(btrim(coalesce(p_query, ''))), '');
  kind text := nullif(lower(btrim(coalesce(p_account_kind, ''))), '');
  lim integer := greatest(1, least(coalesce(p_limit, 50), 100));
  off integer := greatest(0, coalesce(p_offset, 0));
begin
  perform public.ops_require_admin();
  if kind is not null and kind not in ('account', 'local') then
    raise exception 'invalid account kind' using errcode = '22023';
  end if;
  return query
  select
    p.id,
    coalesce(u.email::text, ''),
    coalesce(
      nullif(btrim(s.payload #>> '{profile,name}'), ''),
      nullif(btrim(p.display_name), ''),
      ''
    ),
    p.avatar_ref,
    p.created_at,
    p.suspended_at,
    coalesce((
      select array_agg(r.role::text order by r.role::text)
      from public.user_roles r
      where r.user_id = p.id
    ), '{}'::text[]),
    exists (select 1 from public.professional_profiles pp where pp.user_id = p.id),
    pp.verification_status,
    coalesce((
      select count(*)::integer from public.professional_student_relationships rel
      where rel.student_user_id = p.id and rel.status = 'active'
    ), 0),
    coalesce((
      select count(*)::integer from public.professional_student_relationships rel
      where rel.professional_user_id = p.id and rel.status = 'active'
    ), 0),
    coalesce(u.is_anonymous, false),
    case when coalesce(u.is_anonymous, false) then 'local' else 'account' end
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.professional_profiles pp on pp.user_id = p.id
  left join public.account_snapshots s on s.user_id = p.id
  where (kind is null
    or (kind = 'local' and coalesce(u.is_anonymous, false) = true)
    or (kind = 'account' and coalesce(u.is_anonymous, false) = false))
    and (
      needle is null
      or lower(coalesce(u.email::text, '')) like '%' || needle || '%'
      or lower(coalesce(nullif(btrim(s.payload #>> '{profile,name}'), ''), p.display_name, '')) like '%' || needle || '%'
      or p.id::text like '%' || needle || '%'
    )
  order by p.created_at desc
  limit lim offset off;
end;
$$;

revoke all on function public.ops_list_users(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.ops_list_users(text, text, integer, integer) to authenticated;

drop function if exists public.ops_user_detail(uuid);

create or replace function public.ops_user_detail(p_user_id uuid)
returns table (
  user_id uuid,
  email text,
  display_name text,
  avatar_ref text,
  created_at timestamptz,
  updated_at timestamptz,
  suspended_at timestamptz,
  roles text[],
  professional_name text,
  bio text,
  specialties text[],
  city_region text,
  registration_type text,
  registration_number text,
  verification_status public.professional_verification_status,
  student_links integer,
  professional_links integer,
  is_anonymous boolean,
  account_kind text
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  perform public.ops_require_admin();
  if p_user_id is null then
    raise exception 'user id required' using errcode = '22023';
  end if;
  return query
  select
    p.id,
    coalesce(u.email::text, ''),
    coalesce(
      nullif(btrim(s.payload #>> '{profile,name}'), ''),
      nullif(btrim(p.display_name), ''),
      ''
    ),
    p.avatar_ref,
    p.created_at,
    p.updated_at,
    p.suspended_at,
    coalesce((
      select array_agg(r.role::text order by r.role::text)
      from public.user_roles r
      where r.user_id = p.id
    ), '{}'::text[]),
    pp.professional_name,
    pp.bio,
    coalesce(pp.specialties, '{}'::text[]),
    pp.city_region,
    pp.registration_type,
    pp.registration_number,
    pp.verification_status,
    coalesce((
      select count(*)::integer from public.professional_student_relationships rel
      where rel.student_user_id = p.id and rel.status = 'active'
    ), 0),
    coalesce((
      select count(*)::integer from public.professional_student_relationships rel
      where rel.professional_user_id = p.id and rel.status = 'active'
    ), 0),
    coalesce(u.is_anonymous, false),
    case when coalesce(u.is_anonymous, false) then 'local' else 'account' end
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.professional_profiles pp on pp.user_id = p.id
  left join public.account_snapshots s on s.user_id = p.id
  where p.id = p_user_id;
end;
$$;

revoke all on function public.ops_user_detail(uuid) from public, anon, authenticated;
grant execute on function public.ops_user_detail(uuid) to authenticated;

create or replace function public.ops_user_training(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  payload jsonb;
  updated timestamptz;
  result jsonb;
begin
  perform public.ops_require_admin();
  if p_user_id is null then
    raise exception 'user id required' using errcode = '22023';
  end if;

  select s.payload, s.updated_at into payload, updated
  from public.account_snapshots s
  where s.user_id = p_user_id;

  if payload is null then
    return jsonb_build_object(
      'has_snapshot', false,
      'profile', '{}'::jsonb,
      'plan_mode', null,
      'week_days', '[]'::jsonb,
      'routines', '[]'::jsonb,
      'workout_count', 0,
      'recent_workouts', '[]'::jsonb,
      'bodyweight', '[]'::jsonb,
      'snapshot_updated_at', null
    );
  end if;

  result := jsonb_build_object(
    'has_snapshot', true,
    'profile', coalesce(payload -> 'profile', '{}'::jsonb),
    'plan_mode', payload ->> 'planMode',
    'week', coalesce(payload -> 'week', '{}'::jsonb),
    'day_plan', coalesce(payload -> 'dayPlan', '{}'::jsonb),
    'routines', coalesce(payload -> 'routines', '[]'::jsonb),
    'workout_count', coalesce(jsonb_array_length(payload -> 'workouts'), 0),
    'recent_workouts', coalesce((
      select jsonb_agg(item order by item ->> 'd' desc)
      from (
        select value as item
        from jsonb_array_elements(coalesce(payload -> 'workouts', '[]'::jsonb))
        order by value ->> 'd' desc
        limit 40
      ) recent
    ), '[]'::jsonb),
    'bodyweight', coalesce(payload -> 'bodyweight', '[]'::jsonb),
    'body_measurements', coalesce(payload -> 'bodyMeasurements', '[]'::jsonb),
    'snapshot_updated_at', updated
  );
  return result;
end;
$$;

revoke all on function public.ops_user_training(uuid) from public, anon, authenticated;
grant execute on function public.ops_user_training(uuid) to authenticated;
;
