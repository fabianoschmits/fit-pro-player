-- Distinguish registered accounts from local (anonymous) users in the ops console.

drop function if exists public.ops_overview();

create or replace function public.ops_overview()
returns table (
  user_count bigint,
  professional_count bigint,
  pending_verification_count bigint,
  suspended_count bigint,
  new_users_7d bigint,
  account_user_count bigint,
  local_user_count bigint
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  perform public.ops_require_admin();
  return query
  select
    (select count(*)::bigint from public.profiles),
    (select count(*)::bigint from public.user_roles where role = 'professional'),
    (select count(*)::bigint from public.professional_profiles where verification_status = 'pending'),
    (select count(*)::bigint from public.profiles where suspended_at is not null),
    (select count(*)::bigint from public.profiles where created_at >= now() - interval '7 days'),
    (select count(*)::bigint from auth.users where coalesce(is_anonymous, false) = false),
    (select count(*)::bigint from auth.users where coalesce(is_anonymous, false) = true);
end;
$$;

revoke all on function public.ops_overview() from public, anon, authenticated;
grant execute on function public.ops_overview() to authenticated;

drop function if exists public.ops_list_users(text, integer, integer);

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
    ), 0),
    coalesce(u.is_anonymous, false),
    case when coalesce(u.is_anonymous, false) then 'local' else 'account' end
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.professional_profiles pp on pp.user_id = p.id
  where (kind is null
    or (kind = 'local' and coalesce(u.is_anonymous, false) = true)
    or (kind = 'account' and coalesce(u.is_anonymous, false) = false))
    and (
      needle is null
      or lower(coalesce(u.email::text, '')) like '%' || needle || '%'
      or lower(coalesce(p.display_name, '')) like '%' || needle || '%'
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
    ), 0),
    coalesce(u.is_anonymous, false),
    case when coalesce(u.is_anonymous, false) then 'local' else 'account' end
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.professional_profiles pp on pp.user_id = p.id
  where p.id = p_user_id;
end;
$$;

revoke all on function public.ops_user_detail(uuid) from public, anon, authenticated;
grant execute on function public.ops_user_detail(uuid) to authenticated;;
