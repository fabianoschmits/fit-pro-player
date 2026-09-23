create type public.professional_verification_status as enum ('unverified', 'pending', 'verified', 'rejected');

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
  if cardinality(value) > 8 then return false; end if;
  foreach item in array value loop
    normalized := btrim(item);
    if normalized = '' or char_length(normalized) > 40 or normalized <> lower(normalized) then return false; end if;
    if normalized = any(seen) then return false; end if;
    seen := array_append(seen, normalized);
  end loop;
  return true;
end;
$$;

create table public.professional_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  professional_name text not null,
  bio text,
  specialties text[] not null default '{}',
  city_region text,
  registration_type text,
  registration_number text,
  verification_status public.professional_verification_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_profiles_name_check check (char_length(btrim(professional_name)) between 1 and 120),
  constraint professional_profiles_bio_check check (bio is null or char_length(bio) <= 2000),
  constraint professional_profiles_specialties_check check (public.valid_professional_specialties(specialties)),
  constraint professional_profiles_city_check check (city_region is null or char_length(city_region) <= 120),
  constraint professional_profiles_registration_type_check check (registration_type is null or char_length(registration_type) <= 40),
  constraint professional_profiles_registration_number_check check (registration_number is null or char_length(registration_number) <= 80)
);

revoke all on function public.valid_professional_specialties(text[]) from public, anon, authenticated;
revoke all on table public.professional_profiles from public, anon, authenticated;
grant select, insert, update on table public.professional_profiles to authenticated;
grant select, insert, update, delete on table public.professional_profiles to service_role;

alter table public.professional_profiles enable row level security;

create policy professional_profiles_select_own
on public.professional_profiles
for select
to authenticated
using (user_id = auth.uid());

create policy professional_profiles_insert_professional
on public.professional_profiles
for insert
to authenticated
with check (
  user_id = auth.uid()
  and verification_status = 'unverified'
  and exists (
    select 1 from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role = 'professional'
  )
);

create policy professional_profiles_update_professional
on public.professional_profiles
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role = 'professional'
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role = 'professional'
  )
);

create or replace function public.protect_professional_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_user <> 'service_role' and tg_op = 'UPDATE' and (
    new.user_id is distinct from old.user_id
    or new.created_at is distinct from old.created_at
    or new.verification_status is distinct from old.verification_status
  ) then
    raise exception 'professional profile server-managed fields cannot be changed' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and new.verification_status is distinct from 'unverified'::public.professional_verification_status
    and current_user <> 'service_role' then
    raise exception 'professional profile verification is server-controlled' using errcode = '42501';
  end if;
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

revoke all on function public.protect_professional_profile_fields() from public, anon, authenticated;

create trigger professional_profiles_protect_server_fields
before insert or update on public.professional_profiles
for each row execute function public.protect_professional_profile_fields();
