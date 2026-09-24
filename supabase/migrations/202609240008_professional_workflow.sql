create extension if not exists pgcrypto;

create type public.relationship_status as enum ('pending', 'active', 'revoked');
create type public.invite_kind as enum ('code', 'link');
create type public.assignment_status as enum ('active', 'revoked');
create type public.execution_status as enum ('in_progress', 'completed', 'abandoned');

create table public.professional_student_relationships (
  id uuid primary key default gen_random_uuid(),
  professional_user_id uuid not null references auth.users(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  status public.relationship_status not null default 'active',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  constraint professional_student_relationships_pair_key unique (professional_user_id, student_user_id),
  constraint professional_student_relationships_not_self check (professional_user_id <> student_user_id)
);

create index professional_student_relationships_professional_idx on public.professional_student_relationships(professional_user_id, status);
create index professional_student_relationships_student_idx on public.professional_student_relationships(student_user_id, status);

create table public.professional_invites (
  id uuid primary key default gen_random_uuid(),
  professional_user_id uuid not null references auth.users(id) on delete cascade,
  kind public.invite_kind not null,
  code text not null unique,
  token_hash text not null unique,
  status public.relationship_status not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null
);
create index professional_invites_owner_idx on public.professional_invites(professional_user_id, status);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  professional_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint programs_title_check check (char_length(btrim(title)) between 1 and 160),
  constraint programs_description_check check (description is null or char_length(description) <= 4000)
);

create table public.program_versions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  version_number integer not null,
  weekly_plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint program_versions_number_check check (version_number > 0),
  constraint program_versions_program_number_key unique (program_id, version_number)
);

create table public.program_assignments (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  version_id uuid not null references public.program_versions(id) on delete restrict,
  professional_user_id uuid not null references auth.users(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  status public.assignment_status not null default 'active',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint program_assignments_not_self check (professional_user_id <> student_user_id)
);
create index program_assignments_student_idx on public.program_assignments(student_user_id, status);
create index program_assignments_professional_idx on public.program_assignments(professional_user_id, status);

create table public.workout_executions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.program_assignments(id) on delete restrict,
  version_id uuid not null references public.program_versions(id) on delete restrict,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  day_key text not null,
  status public.execution_status not null default 'in_progress',
  payload jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint workout_executions_day_key_check check (char_length(btrim(day_key)) between 1 and 80)
);
create index workout_executions_student_idx on public.workout_executions(student_user_id, started_at desc);
create index workout_executions_assignment_idx on public.workout_executions(assignment_id);

revoke all on table public.professional_student_relationships from public, anon, authenticated;
revoke all on table public.professional_invites from public, anon, authenticated;
revoke all on table public.programs from public, anon, authenticated;
revoke all on table public.program_versions from public, anon, authenticated;
revoke all on table public.program_assignments from public, anon, authenticated;
revoke all on table public.workout_executions from public, anon, authenticated;
grant select on public.professional_student_relationships to authenticated;
grant select on public.professional_invites to authenticated;
grant select, insert, update on public.programs to authenticated;
grant select, insert on public.program_versions to authenticated;
grant select, insert, update on public.program_assignments to authenticated;
grant select, insert, update on public.workout_executions to authenticated;

alter table public.professional_student_relationships enable row level security;
alter table public.professional_invites enable row level security;
alter table public.programs enable row level security;
alter table public.program_versions enable row level security;
alter table public.program_assignments enable row level security;
alter table public.workout_executions enable row level security;

create policy relationships_read_participant on public.professional_student_relationships for select to authenticated
  using (professional_user_id = auth.uid() or student_user_id = auth.uid());
create policy invites_read_owner on public.professional_invites for select to authenticated
  using (professional_user_id = auth.uid());
create policy programs_owner_all on public.programs for all to authenticated
  using (professional_user_id = auth.uid()) with check (professional_user_id = auth.uid());
create policy versions_owner_read_insert on public.program_versions for select to authenticated
  using (exists (select 1 from public.programs p where p.id = program_id and p.professional_user_id = auth.uid()));
create policy versions_owner_insert on public.program_versions for insert to authenticated
  with check (exists (select 1 from public.programs p where p.id = program_id and p.professional_user_id = auth.uid()));
create policy assignments_participant_read on public.program_assignments for select to authenticated
  using (professional_user_id = auth.uid() or student_user_id = auth.uid());
create policy assignments_owner_insert on public.program_assignments for insert to authenticated
  with check (professional_user_id = auth.uid() and exists (select 1 from public.professional_student_relationships r where r.professional_user_id = auth.uid() and r.student_user_id = program_assignments.student_user_id and r.status = 'active'));
create policy assignments_owner_update on public.program_assignments for update to authenticated
  using (professional_user_id = auth.uid()) with check (professional_user_id = auth.uid());
create policy executions_student_insert on public.workout_executions for insert to authenticated
  with check (student_user_id = auth.uid() and exists (select 1 from public.program_assignments a where a.id = assignment_id and a.student_user_id = auth.uid() and a.status = 'active' and a.version_id = workout_executions.version_id));
create policy executions_participant_read on public.workout_executions for select to authenticated
  using (student_user_id = auth.uid() or exists (select 1 from public.program_assignments a where a.id = assignment_id and a.professional_user_id = auth.uid()));
create policy executions_student_update on public.workout_executions for update to authenticated
  using (student_user_id = auth.uid()) with check (student_user_id = auth.uid());

create or replace function public.create_professional_invite(p_kind public.invite_kind default 'code')
returns public.professional_invites
language plpgsql security definer set search_path = public, pg_temp
as $$
declare result public.professional_invites; caller uuid := auth.uid(); raw_token text := md5(gen_random_uuid()::text || clock_timestamp()::text); invite_code text := upper(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 10));
begin
  if caller is null or not exists (select 1 from public.user_roles where user_id = caller and role = 'professional') then raise exception 'professional capability required' using errcode = '42501'; end if;
  insert into public.professional_invites(professional_user_id, kind, code, token_hash)
  values (caller, p_kind, invite_code, encode(digest(raw_token, 'sha256'), 'hex')) returning * into result;
  result.token_hash := raw_token;
  return result;
end;
$$;

create or replace function public.preview_professional_invite(p_code text)
returns table(invite_id uuid, professional_user_id uuid, professional_name text, bio text, specialties text[], verification_status public.professional_verification_status)
language sql security definer set search_path = public, pg_temp
as $$
  select i.id, i.professional_user_id, p.professional_name, p.bio, p.specialties, p.verification_status
  from public.professional_invites i join public.professional_profiles p on p.user_id = i.professional_user_id
  where i.code = upper(btrim(p_code)) and i.status = 'pending' and (i.expires_at is null or i.expires_at > now());
$$;

create or replace function public.accept_professional_invite(p_code text)
returns public.professional_student_relationships
language plpgsql security definer set search_path = public, pg_temp
as $$
declare caller uuid := auth.uid(); invite public.professional_invites; result public.professional_student_relationships;
begin
  if caller is null then raise exception 'authenticated identity required' using errcode = '42501'; end if;
  select * into invite from public.professional_invites where code = upper(btrim(p_code)) and status = 'pending' and (expires_at is null or expires_at > now()) for update;
  if not found or invite.professional_user_id = caller then raise exception 'invalid or expired invite' using errcode = '22023'; end if;
  insert into public.professional_student_relationships(professional_user_id, student_user_id, status, accepted_at)
  values (invite.professional_user_id, caller, 'active', now())
  on conflict (professional_user_id, student_user_id) do update set status = 'active', revoked_at = null, accepted_at = now()
  returning * into result;
  update public.professional_invites set status = 'active', accepted_at = now(), accepted_by = caller where id = invite.id;
  return result;
end;
$$;

create or replace function public.revoke_professional_relationship(p_relationship_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.professional_student_relationships set status = 'revoked', revoked_at = now()
  where id = p_relationship_id and (professional_user_id = auth.uid() or student_user_id = auth.uid());
  if not found then raise exception 'relationship not found' using errcode = '42501'; end if;
end; $$;

revoke all on function public.create_professional_invite(public.invite_kind) from public, anon;
revoke all on function public.preview_professional_invite(text) from public, anon;
revoke all on function public.accept_professional_invite(text) from public, anon;
revoke all on function public.revoke_professional_relationship(uuid) from public, anon;
grant execute on function public.create_professional_invite(public.invite_kind) to authenticated;
grant execute on function public.preview_professional_invite(text) to authenticated;
grant execute on function public.accept_professional_invite(text) to authenticated;
grant execute on function public.revoke_professional_relationship(uuid) to authenticated;
