-- Fix ops list/detail RPCs: auth.users.email is varchar, RETURNS TABLE expects text.

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
grant execute on function public.ops_list_professionals(text, public.professional_verification_status, integer, integer) to authenticated;;
