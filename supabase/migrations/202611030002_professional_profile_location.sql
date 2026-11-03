create or replace function public.valid_professional_specialties(value text[])
returns boolean
language plpgsql
immutable
strict
set search_path = public, pg_temp
as $$
declare
  item text;
  normalized text;
  seen text[] := '{}';
begin
  if cardinality(value) > 16 then return false; end if;
  foreach item in array value loop
    normalized := btrim(item);
    if normalized = '' or char_length(normalized) > 48 or normalized <> lower(normalized) then return false; end if;
    if normalized = any(seen) then return false; end if;
    seen := array_append(seen, normalized);
  end loop;
  return true;
end;
$$;

alter table public.professional_profiles
  add column if not exists state_uf text,
  add column if not exists city_name text,
  add column if not exists neighborhood text;

alter table public.professional_profiles drop constraint if exists professional_profiles_city_check;
alter table public.professional_profiles drop constraint if exists professional_profiles_state_uf_check;
alter table public.professional_profiles drop constraint if exists professional_profiles_city_name_check;
alter table public.professional_profiles drop constraint if exists professional_profiles_neighborhood_check;

alter table public.professional_profiles
  add constraint professional_profiles_city_check check (city_region is null or char_length(city_region) <= 200),
  add constraint professional_profiles_state_uf_check check (state_uf is null or state_uf ~ '^[A-Z]{2}$'),
  add constraint professional_profiles_city_name_check check (city_name is null or char_length(btrim(city_name)) between 1 and 80),
  add constraint professional_profiles_neighborhood_check check (neighborhood is null or char_length(btrim(neighborhood)) between 1 and 80);

drop function if exists public.provision_professional_profile(text, text, text[], text, text, text);
create function public.provision_professional_profile(
  p_professional_name text,
  p_bio text default null,
  p_specialties text[] default '{}',
  p_city_region text default null,
  p_registration_type text default null,
  p_registration_number text default null,
  p_state_uf text default null,
  p_city_name text default null,
  p_neighborhood text default null
)
returns public.professional_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  result public.professional_profiles;
  normalized_name text := btrim(coalesce(p_professional_name, ''));
  normalized_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  normalized_city text := nullif(btrim(coalesce(p_city_region, '')), '');
  normalized_type text := nullif(btrim(coalesce(p_registration_type, '')), '');
  normalized_number text := nullif(btrim(coalesce(p_registration_number, '')), '');
  normalized_state text := upper(nullif(btrim(coalesce(p_state_uf, '')), ''));
  normalized_city_name text := nullif(btrim(coalesce(p_city_name, '')), '');
  normalized_neighborhood text := nullif(btrim(coalesce(p_neighborhood, '')), '');
begin
  if caller is null then
    raise exception 'authenticated identity required' using errcode = '42501';
  end if;
  if normalized_name = '' or char_length(normalized_name) > 120 then
    raise exception 'professional name is required' using errcode = '22023';
  end if;
  if normalized_bio is not null and char_length(normalized_bio) > 2000 then
    raise exception 'professional bio is too long' using errcode = '22023';
  end if;
  if normalized_city is null then
    normalized_city := nullif(concat_ws(', ', normalized_neighborhood, nullif(concat_ws(' - ', normalized_city_name, normalized_state), '')), '');
  end if;
  if normalized_city is not null and char_length(normalized_city) > 200 then
    raise exception 'professional city is too long' using errcode = '22023';
  end if;
  if normalized_state is not null and normalized_state !~ '^[A-Z]{2}$' then
    raise exception 'invalid professional state' using errcode = '22023';
  end if;
  if normalized_city_name is not null and char_length(normalized_city_name) > 80 then
    raise exception 'professional city name is too long' using errcode = '22023';
  end if;
  if normalized_neighborhood is not null and char_length(normalized_neighborhood) > 80 then
    raise exception 'professional neighborhood is too long' using errcode = '22023';
  end if;
  if normalized_type is not null and char_length(normalized_type) > 40 then
    raise exception 'professional registration type is too long' using errcode = '22023';
  end if;
  if normalized_number is not null and char_length(normalized_number) > 80 then
    raise exception 'professional registration number is too long' using errcode = '22023';
  end if;
  if not public.valid_professional_specialties(coalesce(p_specialties, '{}')) then
    raise exception 'invalid professional specialties' using errcode = '22023';
  end if;

  insert into public.user_roles (user_id, role)
  values (caller, 'professional'::public.user_role)
  on conflict (user_id, role) do nothing;

  insert into public.professional_profiles (
    user_id, professional_name, bio, specialties, city_region,
    registration_type, registration_number, verification_status,
    state_uf, city_name, neighborhood
  ) values (
    caller, normalized_name, normalized_bio, coalesce(p_specialties, '{}'), normalized_city,
    normalized_type, normalized_number, 'unverified',
    normalized_state, normalized_city_name, normalized_neighborhood
  )
  on conflict (user_id) do update set
    professional_name = excluded.professional_name,
    bio = excluded.bio,
    specialties = excluded.specialties,
    city_region = excluded.city_region,
    registration_type = excluded.registration_type,
    registration_number = excluded.registration_number,
    state_uf = excluded.state_uf,
    city_name = excluded.city_name,
    neighborhood = excluded.neighborhood
  returning * into result;

  return result;
end;
$$;

revoke all on function public.provision_professional_profile(text, text, text[], text, text, text, text, text, text) from public, anon;
grant execute on function public.provision_professional_profile(text, text, text[], text, text, text, text, text, text) to authenticated;

drop function if exists public.save_professional_profile(uuid, text, text, text[], text, text, text);
create function public.save_professional_profile(
  p_user_id uuid,
  p_professional_name text,
  p_bio text,
  p_specialties text[],
  p_city_region text,
  p_registration_type text,
  p_registration_number text,
  p_state_uf text default null,
  p_city_name text default null,
  p_neighborhood text default null
)
returns public.professional_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  name_value text := btrim(coalesce(p_professional_name, ''));
  bio_value text := nullif(btrim(coalesce(p_bio, '')), '');
  city_value text := nullif(btrim(coalesce(p_city_region, '')), '');
  registration_type_value text := nullif(btrim(coalesce(p_registration_type, '')), '');
  registration_number_value text := nullif(btrim(coalesce(p_registration_number, '')), '');
  specialties_value text[] := coalesce(p_specialties, '{}');
  state_value text := upper(nullif(btrim(coalesce(p_state_uf, '')), ''));
  city_name_value text := nullif(btrim(coalesce(p_city_name, '')), '');
  neighborhood_value text := nullif(btrim(coalesce(p_neighborhood, '')), '');
  result public.professional_profiles;
begin
  if caller is null or p_user_id is distinct from caller then
    raise exception 'professional profile owner required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.user_roles where user_id = caller and role = 'professional') then
    raise exception 'professional capability required' using errcode = '42501';
  end if;
  if char_length(name_value) < 1 or char_length(name_value) > 120 then
    raise exception 'invalid professional name' using errcode = '22023';
  end if;
  if bio_value is not null and char_length(bio_value) > 2000 then
    raise exception 'professional bio is too long' using errcode = '22023';
  end if;
  if city_value is null then
    city_value := nullif(concat_ws(', ', neighborhood_value, nullif(concat_ws(' - ', city_name_value, state_value), '')), '');
  end if;
  if city_value is not null and char_length(city_value) > 200 then
    raise exception 'professional city is too long' using errcode = '22023';
  end if;
  if state_value is not null and state_value !~ '^[A-Z]{2}$' then
    raise exception 'invalid professional state' using errcode = '22023';
  end if;
  if city_name_value is not null and char_length(city_name_value) > 80 then
    raise exception 'professional city name is too long' using errcode = '22023';
  end if;
  if neighborhood_value is not null and char_length(neighborhood_value) > 80 then
    raise exception 'professional neighborhood is too long' using errcode = '22023';
  end if;
  if registration_type_value is not null and char_length(registration_type_value) > 40 then
    raise exception 'professional registration type is too long' using errcode = '22023';
  end if;
  if registration_number_value is not null and char_length(registration_number_value) > 80 then
    raise exception 'professional registration number is too long' using errcode = '22023';
  end if;
  if not public.valid_professional_specialties(specialties_value) then
    raise exception 'invalid professional specialties' using errcode = '22023';
  end if;

  update public.professional_profiles
  set professional_name = name_value,
      bio = bio_value,
      specialties = specialties_value,
      city_region = city_value,
      registration_type = registration_type_value,
      registration_number = registration_number_value,
      state_uf = state_value,
      city_name = city_name_value,
      neighborhood = neighborhood_value
  where user_id = caller
  returning * into result;
  if not found then
    raise exception 'professional profile not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

revoke all on function public.save_professional_profile(uuid, text, text, text[], text, text, text, text, text, text) from public, anon;
grant execute on function public.save_professional_profile(uuid, text, text, text[], text, text, text, text, text, text) to authenticated;

drop function if exists public.ops_update_professional_profile(uuid, text, text, text[], text, text, text);
create function public.ops_update_professional_profile(
  p_user_id uuid,
  p_professional_name text,
  p_bio text default null,
  p_specialties text[] default '{}',
  p_city_region text default null,
  p_registration_type text default null,
  p_registration_number text default null,
  p_state_uf text default null,
  p_city_name text default null,
  p_neighborhood text default null
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
  state_value text := upper(nullif(btrim(coalesce(p_state_uf, '')), ''));
  city_name_value text := nullif(btrim(coalesce(p_city_name, '')), '');
  neighborhood_value text := nullif(btrim(coalesce(p_neighborhood, '')), '');
begin
  perform public.ops_require_admin();
  if p_user_id is null or char_length(name_value) < 1 or char_length(name_value) > 120 then
    raise exception 'invalid professional profile input' using errcode = '22023';
  end if;
  if not public.valid_professional_specialties(specs) then
    raise exception 'invalid specialties' using errcode = '22023';
  end if;
  if city_value is null then
    city_value := nullif(concat_ws(', ', neighborhood_value, nullif(concat_ws(' - ', city_name_value, state_value), '')), '');
  end if;
  update public.professional_profiles
  set
    professional_name = name_value,
    bio = bio_value,
    specialties = specs,
    city_region = city_value,
    registration_type = reg_type,
    registration_number = reg_number,
    state_uf = case when p_state_uf is null then professional_profiles.state_uf else state_value end,
    city_name = case when p_city_name is null then professional_profiles.city_name else city_name_value end,
    neighborhood = case when p_neighborhood is null then professional_profiles.neighborhood else neighborhood_value end
  where user_id = p_user_id;
  if not found then
    raise exception 'professional profile not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.ops_update_professional_profile(uuid, text, text, text[], text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ops_update_professional_profile(uuid, text, text, text[], text, text, text, text, text, text) to authenticated;
