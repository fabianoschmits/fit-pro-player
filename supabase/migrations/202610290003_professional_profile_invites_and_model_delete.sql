create or replace function public.save_professional_profile(
  p_user_id uuid,
  p_professional_name text,
  p_bio text,
  p_specialties text[],
  p_city_region text,
  p_registration_type text,
  p_registration_number text
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
  if city_value is not null and char_length(city_value) > 120 then
    raise exception 'professional city is too long' using errcode = '22023';
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
      registration_number = registration_number_value
  where user_id = caller
  returning * into result;
  if not found then
    raise exception 'professional profile not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

revoke all on function public.save_professional_profile(uuid, text, text, text[], text, text, text) from public, anon;
grant execute on function public.save_professional_profile(uuid, text, text, text[], text, text, text) to authenticated;
revoke insert, update on table public.professional_profiles from authenticated;
grant select on table public.professional_profiles to authenticated;
