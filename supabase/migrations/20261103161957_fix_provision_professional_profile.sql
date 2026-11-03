-- Fix provision_professional_profile to preserve existing edited fields when called on login
create or replace function public.provision_professional_profile(
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
    professional_name = coalesce(nullif(professional_profiles.professional_name, ''), excluded.professional_name),
    bio = coalesce(professional_profiles.bio, excluded.bio),
    specialties = case
      when cardinality(professional_profiles.specialties) > 0 then professional_profiles.specialties
      else excluded.specialties
    end,
    city_region = coalesce(professional_profiles.city_region, excluded.city_region),
    registration_type = coalesce(professional_profiles.registration_type, excluded.registration_type),
    registration_number = coalesce(professional_profiles.registration_number, excluded.registration_number),
    state_uf = coalesce(professional_profiles.state_uf, excluded.state_uf),
    city_name = coalesce(professional_profiles.city_name, excluded.city_name),
    neighborhood = coalesce(professional_profiles.neighborhood, excluded.neighborhood)
  returning * into result;

  return result;
end;
$$;
