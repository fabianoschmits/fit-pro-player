-- Server-owned athlete data. Client roles read their own rows through RLS and mutate through RPCs.
create table public.account_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  display_unit text not null default 'kg' check (display_unit in ('kg','lb')),
  mass_unit text not null default 'kg' check (mass_unit = 'kg'),
  state_schema_version integer not null default 2 check (state_schema_version = 2),
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  updated_at timestamptz not null default now()
);

create table public.athlete_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  position integer not null default 0,
  prescription jsonb not null default '{}'::jsonb check (jsonb_typeof(prescription) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.athlete_schedules (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  mode text not null default 'weekly' check (mode in ('weekly','daily')),
  schedule jsonb not null default '{}'::jsonb check (jsonb_typeof(schedule) = 'object'),
  updated_at timestamptz not null default now()
);

create table public.bodyweight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(8,3) not null check (weight_kg > 0 and weight_kg <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.body_measurement_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null,
  measurements_cm jsonb not null default '{}'::jsonb check (jsonb_typeof(measurements_cm) = 'object'),
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.workout_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid,
  assignment_id uuid references public.program_assignments(id) on delete set null,
  status text not null default 'active' check (status in ('active','completed','abandoned')),
  revision bigint not null default 1 check (revision > 0),
  writer_token uuid not null default gen_random_uuid(),
  mass_unit text not null default 'kg' check (mass_unit = 'kg'),
  prescription_snapshot jsonb not null check (jsonb_typeof(prescription_snapshot) = 'object'),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index workout_sessions_one_active_user_idx on public.workout_sessions(user_id) where status = 'active';
create index workout_sessions_user_started_idx on public.workout_sessions(user_id, started_at desc, id desc);

create table public.workout_session_operations (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  session_revision bigint not null check (session_revision > 0),
  kind text not null check (kind in ('set_upserted','set_removed','exercise_added','exercise_removed','session_completed','session_abandoned')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  unique (session_id, operation_id),
  foreign key (session_id, user_id) references public.workout_sessions(id, user_id) on delete cascade
);

create index workout_session_operations_session_idx on public.workout_session_operations(session_id, id);

revoke all on table public.account_preferences, public.athlete_routines, public.athlete_schedules,
  public.bodyweight_entries, public.body_measurement_checkins, public.workout_sessions,
  public.workout_session_operations from public, anon, authenticated;
grant select on table public.account_preferences, public.athlete_routines, public.athlete_schedules,
  public.bodyweight_entries, public.body_measurement_checkins, public.workout_sessions,
  public.workout_session_operations to authenticated;
grant select, insert, update, delete on table public.account_preferences, public.athlete_routines, public.athlete_schedules,
  public.bodyweight_entries, public.body_measurement_checkins, public.workout_sessions,
  public.workout_session_operations to service_role;

alter table public.account_preferences enable row level security;
alter table public.athlete_routines enable row level security;
alter table public.athlete_schedules enable row level security;
alter table public.bodyweight_entries enable row level security;
alter table public.body_measurement_checkins enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_session_operations enable row level security;

create policy account_preferences_owner_read on public.account_preferences for select to authenticated using (user_id = auth.uid());
create policy athlete_routines_owner_read on public.athlete_routines for select to authenticated using (user_id = auth.uid());
create policy athlete_schedules_owner_read on public.athlete_schedules for select to authenticated using (user_id = auth.uid());
create policy bodyweight_entries_owner_read on public.bodyweight_entries for select to authenticated using (user_id = auth.uid());
create policy body_measurement_checkins_owner_read on public.body_measurement_checkins for select to authenticated using (user_id = auth.uid());
create policy workout_sessions_owner_read on public.workout_sessions for select to authenticated using (user_id = auth.uid());
create policy workout_session_operations_owner_read on public.workout_session_operations for select to authenticated using (user_id = auth.uid());

create or replace function public.save_account_preferences(
  p_expected_revision bigint,
  p_display_unit text,
  p_preferences jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare caller uuid := auth.uid(); result public.account_preferences;
begin
  if caller is null then raise exception 'authenticated identity required' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision < 0
    or p_display_unit not in ('kg','lb')
    or p_preferences is null or jsonb_typeof(p_preferences) <> 'object'
    or octet_length(p_preferences::text) > 262144 then
    raise exception 'invalid account preferences' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('fitpp.preferences:' || caller::text, 0));
  select * into result from public.account_preferences where user_id = caller for update;
  if not found then
    if p_expected_revision <> 0 then raise exception 'preference revision conflict' using errcode = '40001'; end if;
    insert into public.account_preferences(user_id,display_unit,preferences)
    values(caller,p_display_unit,p_preferences) returning * into result;
    return to_jsonb(result);
  end if;
  if result.revision <> p_expected_revision then raise exception 'preference revision conflict' using errcode = '40001'; end if;
  update public.account_preferences
    set revision = revision + 1, display_unit = p_display_unit, preferences = p_preferences, updated_at = now()
    where user_id = caller returning * into result;
  return to_jsonb(result);
end;
$$;

create or replace function public.start_workout_session(
  p_session_id uuid,
  p_prescription_snapshot jsonb,
  p_routine_id uuid default null,
  p_assignment_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare caller uuid := auth.uid(); result public.workout_sessions;
begin
  if caller is null then raise exception 'authenticated identity required' using errcode = '42501'; end if;
  if p_session_id is null or p_prescription_snapshot is null or jsonb_typeof(p_prescription_snapshot) <> 'object'
    or octet_length(p_prescription_snapshot::text) > 528384 then
    raise exception 'invalid workout prescription' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('fitpp.workout:' || caller::text, 0));
  select * into result from public.workout_sessions where id = p_session_id and user_id = caller for update;
  if found then return to_jsonb(result); end if;
  if exists(select 1 from public.workout_sessions where user_id = caller and status = 'active') then
    raise exception 'active workout already exists' using errcode = '23505';
  end if;
  if p_assignment_id is not null and not exists (
    select 1 from public.program_assignments where id = p_assignment_id and student_user_id = caller and status = 'active'
  ) then raise exception 'active assignment required' using errcode = '42501'; end if;
  insert into public.workout_sessions(id,user_id,routine_id,assignment_id,prescription_snapshot)
  values(p_session_id,caller,p_routine_id,p_assignment_id,p_prescription_snapshot) returning * into result;
  return to_jsonb(result);
end;
$$;

create or replace function public.append_workout_operation(
  p_session_id uuid,
  p_writer_token uuid,
  p_expected_revision bigint,
  p_operation_id uuid,
  p_kind text,
  p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare caller uuid := auth.uid(); result public.workout_sessions; existing public.workout_session_operations;
begin
  if caller is null then raise exception 'authenticated identity required' using errcode = '42501'; end if;
  if p_session_id is null or p_writer_token is null or p_operation_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_kind not in ('set_upserted','set_removed','exercise_added','exercise_removed')
    or p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 65536 then
    raise exception 'invalid workout operation' using errcode = '22023';
  end if;
  select * into result from public.workout_sessions where id = p_session_id and user_id = caller for update;
  if not found then raise exception 'workout session not found' using errcode = '42501'; end if;
  select * into existing from public.workout_session_operations where session_id = result.id and operation_id = p_operation_id;
  if found then
    if existing.kind <> p_kind or existing.payload <> p_payload then raise exception 'operation id payload mismatch' using errcode = '22023'; end if;
    return to_jsonb(result);
  end if;
  if result.status <> 'active' then raise exception 'workout session already finalized' using errcode = '55000'; end if;
  if result.writer_token <> p_writer_token then raise exception 'stale workout writer' using errcode = '40001'; end if;
  if result.revision <> p_expected_revision then raise exception 'workout revision conflict' using errcode = '40001'; end if;
  insert into public.workout_session_operations(session_id,user_id,operation_id,session_revision,kind,payload)
  values(result.id,caller,p_operation_id,result.revision + 1,p_kind,p_payload);
  update public.workout_sessions set revision = revision + 1, updated_at = now() where id = result.id returning * into result;
  return to_jsonb(result);
end;
$$;

create or replace function public.take_over_workout_session(
  p_session_id uuid,
  p_expected_revision bigint
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare caller uuid := auth.uid(); result public.workout_sessions;
begin
  if caller is null then raise exception 'authenticated identity required' using errcode = '42501'; end if;
  if p_session_id is null or p_expected_revision is null or p_expected_revision < 1 then raise exception 'invalid workout takeover' using errcode = '22023'; end if;
  select * into result from public.workout_sessions where id = p_session_id and user_id = caller for update;
  if not found then raise exception 'workout session not found' using errcode = '42501'; end if;
  if result.status <> 'active' then raise exception 'workout session already finalized' using errcode = '55000'; end if;
  if result.revision <> p_expected_revision then raise exception 'workout revision conflict' using errcode = '40001'; end if;
  update public.workout_sessions set writer_token = gen_random_uuid(), revision = revision + 1, updated_at = now()
  where id = result.id returning * into result;
  return to_jsonb(result);
end;
$$;

create or replace function public.complete_workout_session(
  p_session_id uuid,
  p_writer_token uuid,
  p_expected_revision bigint,
  p_operation_id uuid,
  p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare caller uuid := auth.uid(); result public.workout_sessions; existing public.workout_session_operations;
begin
  if caller is null then raise exception 'authenticated identity required' using errcode = '42501'; end if;
  if p_session_id is null or p_writer_token is null or p_operation_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 262144 then
    raise exception 'invalid workout completion' using errcode = '22023';
  end if;
  select * into result from public.workout_sessions where id = p_session_id and user_id = caller for update;
  if not found then raise exception 'workout session not found' using errcode = '42501'; end if;
  select * into existing from public.workout_session_operations where session_id = result.id and operation_id = p_operation_id;
  if found then
    if existing.kind <> 'session_completed' or existing.payload <> p_payload then raise exception 'operation id payload mismatch' using errcode = '22023'; end if;
    return to_jsonb(result);
  end if;
  if result.status <> 'active' then raise exception 'workout session already finalized' using errcode = '55000'; end if;
  if result.writer_token <> p_writer_token then raise exception 'stale workout writer' using errcode = '40001'; end if;
  if result.revision <> p_expected_revision then raise exception 'workout revision conflict' using errcode = '40001'; end if;
  insert into public.workout_session_operations(session_id,user_id,operation_id,session_revision,kind,payload)
  values(result.id,caller,p_operation_id,result.revision + 1,'session_completed',p_payload);
  update public.workout_sessions set status = 'completed', revision = revision + 1, completed_at = now(), updated_at = now()
  where id = result.id returning * into result;
  return to_jsonb(result);
end;
$$;

create or replace function public.abandon_workout_session(
  p_session_id uuid,
  p_writer_token uuid,
  p_expected_revision bigint,
  p_operation_id uuid,
  p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare caller uuid := auth.uid(); result public.workout_sessions; existing public.workout_session_operations;
begin
  if caller is null then raise exception 'authenticated identity required' using errcode = '42501'; end if;
  if p_session_id is null or p_writer_token is null or p_operation_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 65536 then
    raise exception 'invalid workout abandonment' using errcode = '22023';
  end if;
  select * into result from public.workout_sessions where id = p_session_id and user_id = caller for update;
  if not found then raise exception 'workout session not found' using errcode = '42501'; end if;
  select * into existing from public.workout_session_operations where session_id = result.id and operation_id = p_operation_id;
  if found then
    if existing.kind <> 'session_abandoned' or existing.payload <> p_payload then raise exception 'operation id payload mismatch' using errcode = '22023'; end if;
    return to_jsonb(result);
  end if;
  if result.status <> 'active' then raise exception 'workout session already finalized' using errcode = '55000'; end if;
  if result.writer_token <> p_writer_token then raise exception 'stale workout writer' using errcode = '40001'; end if;
  if result.revision <> p_expected_revision then raise exception 'workout revision conflict' using errcode = '40001'; end if;
  insert into public.workout_session_operations(session_id,user_id,operation_id,session_revision,kind,payload)
  values(result.id,caller,p_operation_id,result.revision + 1,'session_abandoned',p_payload);
  update public.workout_sessions set status = 'abandoned', revision = revision + 1, completed_at = now(), updated_at = now()
  where id = result.id returning * into result;
  return to_jsonb(result);
end;
$$;

revoke all on function public.save_account_preferences(bigint,text,jsonb) from public, anon, authenticated;
revoke all on function public.start_workout_session(uuid,jsonb,uuid,uuid) from public, anon, authenticated;
revoke all on function public.append_workout_operation(uuid,uuid,bigint,uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.take_over_workout_session(uuid,bigint) from public, anon, authenticated;
revoke all on function public.complete_workout_session(uuid,uuid,bigint,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.abandon_workout_session(uuid,uuid,bigint,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.save_account_preferences(bigint,text,jsonb) to authenticated;
grant execute on function public.start_workout_session(uuid,jsonb,uuid,uuid) to authenticated;
grant execute on function public.append_workout_operation(uuid,uuid,bigint,uuid,text,jsonb) to authenticated;
grant execute on function public.take_over_workout_session(uuid,bigint) to authenticated;
grant execute on function public.complete_workout_session(uuid,uuid,bigint,uuid,jsonb) to authenticated;
grant execute on function public.abandon_workout_session(uuid,uuid,bigint,uuid,jsonb) to authenticated;
