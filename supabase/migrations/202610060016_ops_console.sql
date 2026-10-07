-- Ops console (discreet "Central"): admin-gated RPCs for platform operators.
-- Seed grants admin to the designated operator account when it exists.

alter table public.profiles
  add column if not exists suspended_at timestamptz;

create or replace function public.protect_profile_server_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id is distinct from old.id
    or new.created_at is distinct from old.created_at then
    raise exception 'profile server-managed fields cannot be changed'
      using errcode = '42501';
  end if;

  if new.suspended_at is distinct from old.suspended_at
    and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'profile suspension is server-controlled'
      using errcode = '42501';
  end if;

  new.updated_at = clock_timestamp();
  return new;
end;
$$;

create or replace function public.protect_professional_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('postgres', 'supabase_admin', 'service_role') and tg_op = 'UPDATE' and (
    new.user_id is distinct from old.user_id
    or new.created_at is distinct from old.created_at
    or new.verification_status is distinct from old.verification_status
  ) then
    raise exception 'professional profile server-managed fields cannot be changed' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and new.verification_status is distinct from 'unverified'::public.professional_verification_status
    and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'professional profile verification is server-controlled' using errcode = '42501';
  end if;
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

create or replace function public.ops_require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null
    or not exists (
      select 1 from public.user_roles
      where user_id = caller and role = 'admin'::public.user_role
    ) then
    raise exception 'ops capability required' using errcode = '42501';
  end if;
  return caller;
end;
$$;

revoke all on function public.ops_require_admin() from public, anon, authenticated;
grant execute on function public.ops_require_admin() to authenticated;

insert into public.user_roles (user_id, role)
select '4871d9b4-09ba-4768-806c-c608ebbfe42f'::uuid, 'admin'::public.user_role
where exists (
  select 1 from auth.users where id = '4871d9b4-09ba-4768-806c-c608ebbfe42f'::uuid
)
on conflict on constraint user_roles_user_id_role_key do nothing;

create or replace function public.ops_overview()
returns table (
  user_count bigint,
  professional_count bigint,
  pending_verification_count bigint,
  suspended_count bigint,
  new_users_7d bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.ops_require_admin();
  return query
  select
    (select count(*)::bigint from public.profiles),
    (select count(*)::bigint from public.user_roles where role = 'professional'),
    (select count(*)::bigint from public.professional_profiles where verification_status = 'pending'),
    (select count(*)::bigint from public.profiles where suspended_at is not null),
    (select count(*)::bigint from public.profiles where created_at >= now() - interval '7 days');
end;
$$;

revoke all on function public.ops_overview() from public, anon, authenticated;
grant execute on function public.ops_overview() to authenticated;

create or replace function public.ops_list_users(
  p_query text default null,
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
  professional_links integer
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  needle text := nullif(lower(btrim(coalesce(p_query, ''))), '');
  lim integer := greatest(1, least(coalesce(p_limit, 50), 100));
  off integer := greatest(0, coalesce(p_offset, 0));
begin
  perform public.ops_require_admin();
  return query
  select
    p.id,
    coalesce(u.email::text, ''),
    coalesce(p.display_name, ''),
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
    ), 0)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.professional_profiles pp on pp.user_id = p.id
  where needle is null
    or lower(coalesce(u.email::text, '')) like '%' || needle || '%'
    or lower(coalesce(p.display_name, '')) like '%' || needle || '%'
    or p.id::text like '%' || needle || '%'
  order by p.created_at desc
  limit lim offset off;
end;
$$;

revoke all on function public.ops_list_users(text, integer, integer) from public, anon, authenticated;
grant execute on function public.ops_list_users(text, integer, integer) to authenticated;

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
  professional_links integer
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
    coalesce(p.display_name, ''),
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
    ), 0)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.professional_profiles pp on pp.user_id = p.id
  where p.id = p_user_id;
end;
$$;

revoke all on function public.ops_user_detail(uuid) from public, anon, authenticated;
grant execute on function public.ops_user_detail(uuid) to authenticated;

create or replace function public.ops_list_professionals(
  p_query text default null,
  p_status public.professional_verification_status default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  email text,
  display_name text,
  professional_name text,
  city_region text,
  verification_status public.professional_verification_status,
  specialties text[],
  registration_type text,
  registration_number text,
  created_at timestamptz,
  student_links integer,
  suspended_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  needle text := nullif(lower(btrim(coalesce(p_query, ''))), '');
  lim integer := greatest(1, least(coalesce(p_limit, 50), 100));
  off integer := greatest(0, coalesce(p_offset, 0));
begin
  perform public.ops_require_admin();
  return query
  select
    pp.user_id,
    coalesce(u.email::text, ''),
    coalesce(p.display_name, ''),
    pp.professional_name,
    pp.city_region,
    pp.verification_status,
    coalesce(pp.specialties, '{}'::text[]),
    pp.registration_type,
    pp.registration_number,
    pp.created_at,
    coalesce((
      select count(*)::integer from public.professional_student_relationships rel
      where rel.professional_user_id = pp.user_id and rel.status = 'active'
    ), 0),
    p.suspended_at
  from public.professional_profiles pp
  join public.profiles p on p.id = pp.user_id
  join auth.users u on u.id = pp.user_id
  where (p_status is null or pp.verification_status = p_status)
    and (
      needle is null
      or lower(coalesce(u.email::text, '')) like '%' || needle || '%'
      or lower(coalesce(p.display_name, '')) like '%' || needle || '%'
      or lower(coalesce(pp.professional_name, '')) like '%' || needle || '%'
      or pp.user_id::text like '%' || needle || '%'
    )
  order by
    case pp.verification_status
      when 'pending' then 0
      when 'unverified' then 1
      when 'rejected' then 2
      else 3
    end,
    pp.created_at desc
  limit lim offset off;
end;
$$;

revoke all on function public.ops_list_professionals(text, public.professional_verification_status, integer, integer) from public, anon, authenticated;
grant execute on function public.ops_list_professionals(text, public.professional_verification_status, integer, integer) to authenticated;

create or replace function public.ops_set_display_name(p_user_id uuid, p_display_name text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  bounded text := left(coalesce(btrim(p_display_name), ''), 120);
begin
  perform public.ops_require_admin();
  if p_user_id is null then
    raise exception 'user id required' using errcode = '22023';
  end if;
  update public.profiles
  set display_name = bounded
  where id = p_user_id;
  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.ops_set_display_name(uuid, text) from public, anon, authenticated;
grant execute on function public.ops_set_display_name(uuid, text) to authenticated;

create or replace function public.ops_set_suspended(p_user_id uuid, p_suspended boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid;
begin
  caller := public.ops_require_admin();
  if p_user_id is null or p_suspended is null then
    raise exception 'invalid suspension input' using errcode = '22023';
  end if;
  if p_user_id = caller then
    raise exception 'cannot suspend own account' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.user_roles
    where user_id = p_user_id and role = 'admin'::public.user_role
  ) then
    raise exception 'cannot suspend admin account' using errcode = '42501';
  end if;
  update public.profiles
  set suspended_at = case when p_suspended then coalesce(suspended_at, now()) else null end
  where id = p_user_id;
  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.ops_set_suspended(uuid, boolean) from public, anon, authenticated;
grant execute on function public.ops_set_suspended(uuid, boolean) to authenticated;

create or replace function public.ops_set_professional_role(p_user_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  display text;
begin
  perform public.ops_require_admin();
  if p_user_id is null or p_enabled is null then
    raise exception 'invalid role input' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  if p_enabled then
    insert into public.user_roles (user_id, role)
    values (p_user_id, 'professional'::public.user_role)
    on conflict on constraint user_roles_user_id_role_key do nothing;
    if not exists (select 1 from public.professional_profiles where user_id = p_user_id) then
      select nullif(btrim(display_name), '') into display from public.profiles where id = p_user_id;
      insert into public.professional_profiles (user_id, professional_name, verification_status)
      values (
        p_user_id,
        coalesce(display, 'Profissional'),
        'unverified'::public.professional_verification_status
      );
    end if;
  else
    delete from public.user_roles
    where user_id = p_user_id and role = 'professional'::public.user_role;
  end if;
end;
$$;

revoke all on function public.ops_set_professional_role(uuid, boolean) from public, anon, authenticated;
grant execute on function public.ops_set_professional_role(uuid, boolean) to authenticated;

create or replace function public.ops_set_verification(
  p_user_id uuid,
  p_status public.professional_verification_status
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.ops_require_admin();
  if p_user_id is null or p_status is null then
    raise exception 'invalid verification input' using errcode = '22023';
  end if;
  update public.professional_profiles
  set verification_status = p_status
  where user_id = p_user_id;
  if not found then
    raise exception 'professional profile not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.ops_set_verification(uuid, public.professional_verification_status) from public, anon, authenticated;
grant execute on function public.ops_set_verification(uuid, public.professional_verification_status) to authenticated;

create or replace function public.ops_update_professional_profile(
  p_user_id uuid,
  p_professional_name text,
  p_bio text default null,
  p_specialties text[] default '{}',
  p_city_region text default null,
  p_registration_type text default null,
  p_registration_number text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  name_value text := btrim(coalesce(p_professional_name, ''));
  bio_value text := nullif(btrim(coalesce(p_bio, '')), '');
  city_value text := nullif(btrim(coalesce(p_city_region, '')), '');
  reg_type text := nullif(btrim(coalesce(p_registration_type, '')), '');
  reg_number text := nullif(btrim(coalesce(p_registration_number, '')), '');
  specs text[] := coalesce(p_specialties, '{}'::text[]);
begin
  perform public.ops_require_admin();
  if p_user_id is null or char_length(name_value) < 1 or char_length(name_value) > 120 then
    raise exception 'invalid professional profile input' using errcode = '22023';
  end if;
  if not public.valid_professional_specialties(specs) then
    raise exception 'invalid specialties' using errcode = '22023';
  end if;
  update public.professional_profiles
  set
    professional_name = name_value,
    bio = bio_value,
    specialties = specs,
    city_region = city_value,
    registration_type = reg_type,
    registration_number = reg_number
  where user_id = p_user_id;
  if not found then
    raise exception 'professional profile not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.ops_update_professional_profile(uuid, text, text, text[], text, text, text) from public, anon, authenticated;
grant execute on function public.ops_update_professional_profile(uuid, text, text, text[], text, text, text) to authenticated;

create or replace function public.ops_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  caller uuid;
  student_id uuid;
begin
  caller := public.ops_require_admin();
  if p_user_id is null then
    raise exception 'user id required' using errcode = '22023';
  end if;
  if p_user_id = caller then
    raise exception 'cannot delete own account via ops' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.user_roles
    where user_id = p_user_id and role = 'admin'::public.user_role
  ) then
    raise exception 'cannot delete admin account' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  perform 1 from public.programs where professional_user_id = p_user_id order by id for update;
  for student_id in
    select student_user_id from public.program_assignments where professional_user_id = p_user_id
    union select p_user_id
    order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended('fitpp.student:' || student_id::text, 0));
  end loop;

  delete from public.workout_executions where student_user_id = p_user_id;
  update public.workout_executions e
  set prescription_snapshot = case when e.prescription_snapshot = '{}'::jsonb then
      jsonb_build_object(
        'programTitle', p.title,
        'versionNumber', v.version_number,
        'dayKey', e.day_key,
        'exercises', coalesce(v.weekly_plan -> e.day_key, '[]'::jsonb)
      )
      else e.prescription_snapshot end,
      assignment_id = null,
      version_id = null,
      status = case when e.status = 'in_progress' then 'abandoned'::public.execution_status else e.status end,
      completed_at = case when e.status = 'in_progress' then now() else e.completed_at end,
      payload = case when e.status = 'in_progress' then e.payload || '{"abandonReason":"professional-account-deleted"}'::jsonb else e.payload end
  from public.program_assignments a
  join public.program_versions v on v.id = a.version_id
  join public.programs p on p.id = a.program_id
  where e.assignment_id = a.id and a.professional_user_id = p_user_id;

  delete from public.program_assignments where professional_user_id = p_user_id or student_user_id = p_user_id;
  delete from public.program_versions where program_id in (select id from public.programs where professional_user_id = p_user_id);
  delete from public.programs where professional_user_id = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.ops_delete_user(uuid) from public, anon, authenticated;
grant execute on function public.ops_delete_user(uuid) to authenticated;
