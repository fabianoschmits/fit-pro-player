-- Professional photos are public presentation assets; profile rows remain owner-only.
alter table public.professional_profiles add column if not exists photo_path text;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.professional_profiles'::regclass and conname='professional_profiles_photo_path_check') then
    alter table public.professional_profiles add constraint professional_profiles_photo_path_check
      check (photo_path is null or photo_path ~ ('^' || user_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'));
  end if;
end $$;

-- Minimal local DB harnesses have no Storage service. Production Supabase has both tables.
-- Official bucket/access-control references:
-- https://supabase.com/docs/guides/storage/buckets/creating-buckets
-- https://supabase.com/docs/guides/storage/security/access-control
do $$
declare own_photo text := $policy$
  bucket_id = 'professional-photos'
  and name ~ ('^' || auth.uid()::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$')
  and exists (select 1 from public.user_roles where user_id=auth.uid() and role='professional')
$policy$;
begin
  if to_regclass('storage.buckets') is not null then
    execute $bucket$
      insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
      values ('professional-photos','professional-photos',true,5242880,array['image/jpeg','image/png','image/webp'])
      on conflict (id) do update set public=excluded.public, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types
    $bucket$;
  end if;
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists professional_photos_select_own on storage.objects';
    execute 'drop policy if exists professional_photos_insert_own on storage.objects';
    execute 'drop policy if exists professional_photos_update_own on storage.objects';
    execute 'drop policy if exists professional_photos_delete_own on storage.objects';
    execute 'create policy professional_photos_select_own on storage.objects for select to authenticated using (' || own_photo || ')';
    execute 'create policy professional_photos_insert_own on storage.objects for insert to authenticated with check (' || own_photo || ')';
    execute 'create policy professional_photos_update_own on storage.objects for update to authenticated using (' || own_photo || ') with check (' || own_photo || ')';
    execute 'create policy professional_photos_delete_own on storage.objects for delete to authenticated using (' || own_photo || ')';
  end if;
end $$;

create or replace function public.set_professional_photo(p_path text)
returns public.professional_profiles
language plpgsql security definer set search_path = public, pg_temp
as $$
declare caller uuid := auth.uid(); object_exists boolean; result public.professional_profiles;
begin
  if caller is null or not exists(select 1 from public.user_roles where user_id=caller and role='professional') then
    raise exception 'professional capability required' using errcode='42501';
  end if;
  if p_path is not null then
    if p_path !~ ('^' || caller::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$') then
      raise exception 'invalid professional photo path' using errcode='22023';
    end if;
    if to_regclass('storage.objects') is null then
      raise exception 'professional photo object not found' using errcode='22023';
    end if;
    execute 'select exists(select 1 from storage.objects where bucket_id=$1 and name=$2)'
      into object_exists using 'professional-photos', p_path;
    if not object_exists then
      raise exception 'professional photo object not found' using errcode='22023';
    end if;
  end if;
  update public.professional_profiles set photo_path=p_path where user_id=caller returning * into result;
  if not found then
    raise exception 'professional profile required' using errcode='42501';
  end if;
  return result;
end $$;
revoke all on function public.set_professional_photo(text) from public, anon, authenticated;
grant execute on function public.set_professional_photo(text) to authenticated;

-- RETURN TABLE shapes require recreation. No CASCADE: preserve existing dependents.
drop function public.preview_professional_invite(text);
create function public.preview_professional_invite(p_code text)
returns table(invite_id uuid, professional_user_id uuid, professional_name text, bio text, specialties text[], verification_status public.professional_verification_status, photo_path text)
language sql security definer set search_path = public, pg_temp
as $$
  select i.id, i.professional_user_id, p.professional_name, p.bio, p.specialties, p.verification_status, p.photo_path
  from public.professional_invites i join public.professional_profiles p on p.user_id = i.professional_user_id
  where auth.uid() is not null and i.code = upper(btrim(p_code)) and i.status = 'pending' and (i.expires_at is null or i.expires_at > now());
$$;
revoke all on function public.preview_professional_invite(text) from public, anon, authenticated;
grant execute on function public.preview_professional_invite(text) to authenticated;

drop function public.student_professional_summaries();
create function public.student_professional_summaries()
returns table (
  professional_user_id uuid,
  relationship_id uuid,
  professional_name text,
  bio text,
  specialties text[],
  city_region text,
  registration_type text,
  registration_number text,
  verification_status public.professional_verification_status,
  linked_at timestamptz,
  active_program_title text,
  photo_path text
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  return query
  select r.professional_user_id, r.id, pp.professional_name, pp.bio,
    coalesce(pp.specialties, '{}'::text[]), pp.city_region, pp.registration_type,
    pp.registration_number, coalesce(pp.verification_status, 'unverified'::public.professional_verification_status),
    coalesce(r.accepted_at, r.created_at), active_program.title, pp.photo_path
  from public.professional_student_relationships r
  left join public.professional_profiles pp on pp.user_id = r.professional_user_id
  left join lateral (
    select p.title
    from public.program_assignments a
    join public.programs p on p.id = a.program_id and p.professional_user_id = a.professional_user_id
    join public.program_versions v on v.id = a.version_id and v.program_id = p.id
    where a.professional_user_id = r.professional_user_id
      and a.student_user_id = r.student_user_id and a.status = 'active'
      and v.published_at is not null
    order by a.created_at desc, a.id desc limit 1
  ) active_program on true
  where r.student_user_id = auth.uid() and r.status = 'active'
  order by coalesce(r.accepted_at, r.created_at) desc, r.id desc;
end
$$;
revoke all on function public.student_professional_summaries() from public, anon, authenticated;
grant execute on function public.student_professional_summaries() to authenticated;
