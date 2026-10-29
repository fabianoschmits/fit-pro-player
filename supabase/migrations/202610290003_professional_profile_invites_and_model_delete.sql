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

alter table public.professional_invites
  add column is_personal boolean not null default false,
  add column is_custom boolean not null default false;
create unique index professional_invites_one_personal_per_owner_idx
  on public.professional_invites(professional_user_id) where is_personal;

create or replace function public.normalize_professional_invite_code(p_value text)
returns text
language sql immutable
set search_path = public, pg_temp
as $$
  select regexp_replace(
    translate(upper(coalesce(p_value, '')), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'AAAAAEEEEIIIIOOOOOUUUUCN'),
    '[^A-Z0-9]', '', 'g'
  );
$$;

create or replace function public.allocate_professional_personal_invite_code(p_professional_id uuid, p_name text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  parts text[] := regexp_split_to_array(btrim(coalesce(p_name, '')), '\s+');
  base text;
  candidate text;
  suffix integer := 2;
begin
  perform pg_advisory_xact_lock(hashtext('professional_invites_code_allocator'));
  if cardinality(parts) <= 1 then
    base := public.normalize_professional_invite_code(parts[1]);
  else
    base := public.normalize_professional_invite_code(parts[1]) || public.normalize_professional_invite_code(parts[cardinality(parts)]);
  end if;
  if base = '' then base := 'PROF' || upper(substr(replace(p_professional_id::text, '-', ''), 1, 8)); end if;

  candidate := base;
  while exists (
    select 1 from public.professional_invites i
    where i.code = candidate
      and not (i.professional_user_id = p_professional_id and i.is_personal)
  ) loop
    candidate := base || suffix::text;
    suffix := suffix + 1;
    if suffix > 100000 then raise exception 'personal invite code allocation exhausted' using errcode = '54000'; end if;
  end loop;
  return candidate;
end;
$$;

create or replace function public.ensure_professional_personal_invite(p_professional_id uuid, p_name text)
returns public.professional_invites
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.professional_invites;
  next_code text;
begin
  perform pg_advisory_xact_lock(hashtext('professional_invites_code_allocator'));
  select * into result from public.professional_invites
    where professional_user_id = p_professional_id and is_personal for update;
  if found then
    if result.is_custom then return result; end if;
    next_code := public.allocate_professional_personal_invite_code(p_professional_id, p_name);
    if result.code <> next_code then
      update public.professional_invites set code = next_code, status = 'pending', accepted_at = null,
        accepted_by = null, expires_at = null
      where id = result.id returning * into result;
    end if;
    return result;
  end if;

  next_code := public.allocate_professional_personal_invite_code(p_professional_id, p_name);
  insert into public.professional_invites(professional_user_id, kind, code, token_hash, status, expires_at, is_personal, is_custom)
  values (p_professional_id, 'code', next_code,
    md5('personal-invite:' || p_professional_id::text), 'pending', null, true, false)
  returning * into result;
  return result;
end;
$$;

create or replace function public.sync_professional_personal_invite()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and old.professional_name is not distinct from new.professional_name then
    return new;
  end if;
  perform public.ensure_professional_personal_invite(new.user_id, new.professional_name);
  return new;
end;
$$;
create trigger professional_profile_personal_invite_sync
  after insert or update of professional_name on public.professional_profiles
  for each row execute function public.sync_professional_personal_invite();

do $$
declare item record;
begin
  for item in select user_id, professional_name from public.professional_profiles order by user_id loop
    perform public.ensure_professional_personal_invite(item.user_id, item.professional_name);
  end loop;
end;
$$;

create or replace function public.save_professional_personal_invite(p_code text)
returns public.professional_invites
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  normalized text := public.normalize_professional_invite_code(p_code);
  result public.professional_invites;
begin
  if caller is null or not exists (select 1 from public.user_roles where user_id = caller and role = 'professional') then
    raise exception 'professional capability required' using errcode = '42501';
  end if;
  if normalized = '' or char_length(normalized) > 40 then
    raise exception 'invalid personal invite code' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('professional_invites_code_allocator'));
  select * into result from public.professional_invites
    where professional_user_id = caller and is_personal for update;
  if not found then raise exception 'professional personal invite not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.professional_invites where code = normalized and id <> result.id) then
    raise exception 'code_taken' using errcode = 'P0001';
  end if;
  update public.professional_invites
    set code = normalized, is_custom = true, status = 'pending', accepted_at = null,
      accepted_by = null, expires_at = null
    where id = result.id returning * into result;
  return result;
exception when unique_violation then
  raise exception 'code_taken' using errcode = 'P0001';
end;
$$;

create or replace function public.create_professional_invite(p_kind public.invite_kind default 'code')
returns public.professional_invites
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.professional_invites;
  caller uuid := auth.uid();
  raw_token text;
  invite_code text;
  attempts integer := 0;
begin
  if caller is null or not exists (select 1 from public.user_roles where user_id = caller and role = 'professional') then
    raise exception 'professional capability required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('professional_invites_code_allocator'));
  loop
    raw_token := md5(gen_random_uuid()::text || clock_timestamp()::text);
    invite_code := upper(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 10));
    begin
      insert into public.professional_invites(professional_user_id, kind, code, token_hash)
      values (caller, p_kind, invite_code, raw_token) returning * into result;
      exit;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts >= 10 then raise exception 'unable to allocate invite code' using errcode = '54000'; end if;
    end;
  end loop;
  result.token_hash := raw_token;
  return result;
end;
$$;

create or replace function public.accept_professional_invite(p_code text)
returns public.professional_student_relationships
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare caller uuid := auth.uid(); invite public.professional_invites; result public.professional_student_relationships;
begin
  if caller is null then raise exception 'authenticated identity required' using errcode = '42501'; end if;
  select * into invite from public.professional_invites
  where code = upper(btrim(p_code)) and status = 'pending' and (expires_at is null or expires_at > now()) for update;
  if not found or invite.professional_user_id = caller then raise exception 'invalid or expired invite' using errcode = '22023'; end if;
  insert into public.professional_student_relationships(professional_user_id, student_user_id, status, accepted_at)
  values (invite.professional_user_id, caller, 'active', now())
  on conflict (professional_user_id, student_user_id) do update set status = 'active', revoked_at = null, accepted_at = now()
  returning * into result;
  if not invite.is_personal then
    update public.professional_invites set status = 'active', accepted_at = now(), accepted_by = caller where id = invite.id;
  end if;
  return result;
end;
$$;

create or replace function public.revoke_professional_invite(p_invite_id uuid)
returns public.professional_invites
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result public.professional_invites;
begin
  update public.professional_invites
  set status = 'revoked', accepted_at = null
  where id = p_invite_id and professional_user_id = auth.uid() and status = 'pending' and not is_personal
  returning * into result;
  if not found then raise exception 'pending invite not found' using errcode = '42501'; end if;
  return result;
end;
$$;

revoke all on function public.normalize_professional_invite_code(text) from public, anon, authenticated;
revoke all on function public.allocate_professional_personal_invite_code(uuid, text) from public, anon, authenticated;
revoke all on function public.ensure_professional_personal_invite(uuid, text) from public, anon, authenticated;
revoke all on function public.sync_professional_personal_invite() from public, anon, authenticated;
revoke all on function public.save_professional_personal_invite(text) from public, anon;
revoke all on function public.create_professional_invite(public.invite_kind) from public, anon;
revoke all on function public.accept_professional_invite(text) from public, anon;
revoke all on function public.revoke_professional_invite(uuid) from public, anon;
grant execute on function public.save_professional_personal_invite(text) to authenticated;
grant execute on function public.create_professional_invite(public.invite_kind) to authenticated;
grant execute on function public.accept_professional_invite(text) to authenticated;
grant execute on function public.revoke_professional_invite(uuid) to authenticated;

create or replace function public.delete_professional_program(p_program_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare owned_program public.programs;
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_roles where user_id=auth.uid() and role='professional'
  ) then
    raise exception 'professional capability required' using errcode='42501';
  end if;

  select * into owned_program from public.programs
  where id=p_program_id and professional_user_id=auth.uid()
  for update;
  if not found then raise exception 'program ownership required' using errcode='42501'; end if;

  if exists(select 1 from public.program_assignments where program_id=owned_program.id) then
    raise exception 'program_in_use' using errcode='P0001';
  end if;

  begin
    delete from public.programs where id=owned_program.id;
  exception when foreign_key_violation then
    raise exception 'program_in_use' using errcode='P0001';
  end;
end;
$$;

revoke all on function public.delete_professional_program(uuid) from public, anon;
grant execute on function public.delete_professional_program(uuid) to authenticated;

