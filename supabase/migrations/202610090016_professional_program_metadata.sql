-- Additive metadata. Existing prescriptions and historical execution snapshots stay intact.
alter table public.programs add column objective text,
  add constraint programs_objective_length_check check (char_length(objective) <= 160);
alter table public.program_versions add column workout_titles jsonb not null default '{}'::jsonb,
  add constraint versions_workout_titles_object_check check (jsonb_typeof(workout_titles) = 'object' and octet_length(workout_titles::text) <= 4096);

create table public.professional_student_notes (
  professional_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '',
  updated_at timestamptz not null default now(),
  primary key (professional_id, student_id),
  foreign key (professional_id, student_id) references public.professional_student_relationships(professional_user_id, student_user_id) on delete cascade,
  constraint professional_student_notes_body_length_check check (char_length(body) <= 2000)
);
alter table public.professional_student_notes enable row level security;
-- No client table privileges or RLS policies: caller/role/link checks live in the RPCs.
revoke all on table public.professional_student_notes from public, anon, authenticated;

create or replace function public.update_program_metadata(p_program_id uuid, p_title text, p_description text, p_objective text)
returns public.programs
language plpgsql security definer set search_path = public, pg_temp as $$
declare result public.programs;
begin
  if auth.uid() is null or not exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'professional') then
    raise exception 'professional capability required' using errcode = '42501';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 160 or char_length(p_description) > 4000 or char_length(p_objective) > 160 then
    raise exception 'invalid program metadata' using errcode = '22023';
  end if;
  update public.programs set title = btrim(p_title), description = p_description, objective = nullif(btrim(p_objective), ''), updated_at = now()
  where id = p_program_id and professional_user_id = auth.uid() returning * into result;
  if not found then raise exception 'program ownership required' using errcode = '42501'; end if;
  return result;
end $$;

create or replace function public.publish_program_version_with_titles(p_program_id uuid, p_weekly_plan jsonb, p_workout_titles jsonb)
returns public.program_versions
language plpgsql security definer set search_path = public, pg_temp as $$
declare result public.program_versions; title_entry record;
begin
  if auth.uid() is null or not exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'professional') then
    raise exception 'professional capability required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.programs where id = p_program_id and professional_user_id = auth.uid()) then
    raise exception 'program ownership required' using errcode = '42501';
  end if;
  perform public.validate_professional_json(p_workout_titles, 4096);
  for title_entry in select key, value from jsonb_each(p_workout_titles) loop
    if title_entry.key not in ('sunday','monday','tuesday','wednesday','thursday','friday','saturday')
      or jsonb_typeof(title_entry.value) <> 'string' or char_length(title_entry.value #>> '{}') > 80 then
      raise exception 'invalid workout title' using errcode = '22023';
    end if;
  end loop;
  -- Delegate all prescription validation and version serialization to the existing boundary.
  result := public.publish_program_version(p_program_id, p_weekly_plan);
  -- This row was created in this same transaction; no published historical row is touched.
  update public.program_versions set workout_titles = p_workout_titles where id = result.id returning * into result;
  return result;
end $$;

create or replace function public.duplicate_professional_program(p_program_id uuid, p_version_id uuid, p_title text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare source public.programs; source_version public.program_versions; copied public.programs; copied_version public.program_versions;
begin
  if auth.uid() is null or not exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'professional') then
    raise exception 'professional capability required' using errcode = '42501';
  end if;
  select * into source from public.programs where id = p_program_id and professional_user_id = auth.uid() for share;
  if not found then raise exception 'program ownership required' using errcode = '42501'; end if;
  if p_version_id is not null then
    select * into source_version from public.program_versions where id = p_version_id and program_id = source.id and published_at is not null;
    if not found then raise exception 'program version ownership mismatch' using errcode = '42501'; end if;
  else
    select * into source_version from public.program_versions where program_id = source.id and published_at is not null order by version_number desc limit 1;
  end if;
  copied := public.create_program(p_title, source.description);
  copied := public.update_program_metadata(copied.id, copied.title, copied.description, source.objective);
  if source_version.id is not null then
    copied_version := public.publish_program_version_with_titles(copied.id, source_version.weekly_plan, source_version.workout_titles);
  end if;
  return jsonb_build_object('program', to_jsonb(copied), 'version', case when copied_version.id is null then 'null'::jsonb else to_jsonb(copied_version) end);
end $$;

create or replace function public.professional_student_note(p_student_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare result public.professional_student_notes;
begin
  if auth.uid() is null or not exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'professional') then
    raise exception 'professional capability required' using errcode = '42501';
  end if;
  -- A shared relationship lock serializes access with revocation until transaction end.
  perform 1 from public.professional_student_relationships where professional_user_id = auth.uid() and student_user_id = p_student_id and status = 'active' for share;
  if not found then raise exception 'active student relationship required' using errcode = '42501'; end if;
  select * into result from public.professional_student_notes where professional_id = auth.uid() and student_id = p_student_id;
  return jsonb_build_object('body', coalesce(result.body, ''), 'updated_at', result.updated_at);
end $$;

create or replace function public.save_professional_student_note(p_student_id uuid, p_body text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare result public.professional_student_notes;
begin
  if auth.uid() is null or not exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'professional') then
    raise exception 'professional capability required' using errcode = '42501';
  end if;
  perform 1 from public.professional_student_relationships where professional_user_id = auth.uid() and student_user_id = p_student_id and status = 'active' for share;
  if not found then raise exception 'active student relationship required' using errcode = '42501'; end if;
  if p_body is null or char_length(p_body) > 2000 then raise exception 'invalid private note' using errcode = '22023'; end if;
  insert into public.professional_student_notes(professional_id, student_id, body, updated_at)
  values (auth.uid(), p_student_id, p_body, clock_timestamp())
  on conflict (professional_id, student_id) do update set body = excluded.body, updated_at = excluded.updated_at returning * into result;
  return jsonb_build_object('body', result.body, 'updated_at', result.updated_at);
end $$;

revoke all on function public.update_program_metadata(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.publish_program_version_with_titles(uuid,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.duplicate_professional_program(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.professional_student_note(uuid) from public, anon, authenticated;
revoke all on function public.save_professional_student_note(uuid,text) from public, anon, authenticated;
grant execute on function public.update_program_metadata(uuid,text,text,text) to authenticated;
grant execute on function public.publish_program_version_with_titles(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.duplicate_professional_program(uuid,uuid,text) to authenticated;
grant execute on function public.professional_student_note(uuid) to authenticated;
grant execute on function public.save_professional_student_note(uuid,text) to authenticated;

-- Existing caller-scoped read/execution contracts gain only additive title metadata.
create or replace function public.start_workout_execution(p_execution_id uuid,p_assignment_id uuid,p_day_key text,p_payload jsonb default '{}'::jsonb,p_started_at timestamptz default now()) returns public.workout_executions
language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.workout_executions; assignment public.program_assignments; plan jsonb; prescription jsonb;
begin
  if auth.uid() is null then raise exception 'authenticated identity required' using errcode='42501'; end if;
  perform public.validate_professional_json(p_payload,262144);
  if p_execution_id is null or p_assignment_id is null or p_day_key is null or p_started_at is null or not isfinite(p_started_at) or p_started_at>now()+interval '5 minutes' then raise exception 'invalid execution start' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('fitpp.student:'||auth.uid()::text,0));
  select * into result from public.workout_executions where id=p_execution_id;
  if found then
    if result.student_user_id<>auth.uid() then raise exception 'execution ownership required' using errcode='42501'; end if;
    if result.assignment_id is distinct from p_assignment_id or result.day_key is distinct from p_day_key then raise exception 'execution id reused with different prescription' using errcode='22023'; end if;
    return result;
  end if;
  select * into assignment from public.program_assignments where id=p_assignment_id and student_user_id=auth.uid() and status='active' for share;
  if not found or not exists(select 1 from public.professional_student_relationships where professional_user_id=assignment.professional_user_id and student_user_id=auth.uid() and status='active') then raise exception 'active student assignment required' using errcode='42501'; end if;
  select v.weekly_plan,jsonb_build_object('programTitle',p.title,'versionNumber',v.version_number,'dayKey',p_day_key,'workoutTitle',coalesce(nullif(btrim(v.workout_titles->>p_day_key),''),p_day_key),'exercises',coalesce(v.weekly_plan->p_day_key,'[]'::jsonb))
  into plan,prescription from public.program_versions v join public.programs p on p.id=v.program_id where v.id=assignment.version_id;
  if p_day_key is null or not plan ? p_day_key then raise exception 'day is not prescribed' using errcode='22023'; end if;
  insert into public.workout_executions(id,assignment_id,version_id,student_user_id,day_key,payload,started_at,prescription_snapshot)
  values(p_execution_id,assignment.id,assignment.version_id,auth.uid(),p_day_key,p_payload,p_started_at,prescription) returning * into result;
  return result;
end $$;

create or replace function public.student_program_overview()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select jsonb_build_object(
      'assignment', to_jsonb(a),
      'program', jsonb_build_object('id', p.id, 'title', p.title, 'description', p.description, 'objective', p.objective),
      'version', jsonb_build_object('id', v.id, 'versionNumber', v.version_number, 'weeklyPlan', v.weekly_plan, 'workout_titles', v.workout_titles, 'publishedAt', v.published_at),
      'professional', jsonb_build_object('id', pp.user_id, 'name', pp.professional_name, 'bio', pp.bio, 'specialties', pp.specialties),
      'executions', coalesce((select jsonb_agg(to_jsonb(e) order by e.started_at desc) from (select we.* from public.workout_executions we where we.assignment_id = a.id order by we.started_at desc,we.id desc limit 100) e), '[]'::jsonb)
    )
    from public.program_assignments a
    join public.programs p on p.id = a.program_id
    join public.program_versions v on v.id = a.version_id
    left join public.professional_profiles pp on pp.user_id = a.professional_user_id
    where a.student_user_id = auth.uid() and a.status = 'active'
      and exists(select 1 from public.professional_student_relationships r where r.professional_user_id=a.professional_user_id and r.student_user_id=a.student_user_id and r.status='active')
    order by a.created_at desc
    limit 1
  ), '{}'::jsonb);
$$;

create or replace function public.student_professional_detail(p_professional_user_id uuid)
returns table (professional jsonb, relationship jsonb, materials jsonb, executions jsonb)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  return query
  select
    (select to_jsonb(s) from public.student_professional_summaries() s where s.professional_user_id = r.professional_user_id),
    jsonb_build_object('id', r.id, 'status', r.status, 'linked_at', coalesce(r.accepted_at, r.created_at)),
    coalesce((
      select jsonb_agg(m.item order by m.assigned_at desc, m.assignment_id desc)
      from (
        select a.id as assignment_id, a.created_at as assigned_at,
          jsonb_build_object(
            'assignment_id', a.id, 'program_id', a.program_id, 'version_id', a.version_id,
            'title', p.title, 'description', p.description, 'objective', p.objective, 'status', a.status,
            'version_number', v.version_number, 'published_at', v.published_at,
            'assigned_at', a.created_at, 'weekly_plan', v.weekly_plan, 'workout_titles', v.workout_titles
          ) as item
        from public.program_assignments a
        join public.programs p on p.id = a.program_id and p.professional_user_id = a.professional_user_id
        join public.program_versions v on v.id = a.version_id and v.program_id = p.id
        where a.professional_user_id = r.professional_user_id
          and a.student_user_id = r.student_user_id and v.published_at is not null
        order by a.created_at desc, a.id desc limit 100
      ) m
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(to_jsonb(e_row) order by e_row.started_at desc, e_row.id desc)
      from (
        select e.*, p.title as program_title, v.version_number
        from public.workout_executions e
        join public.program_assignments a on a.id = e.assignment_id
          and a.version_id = e.version_id and a.student_user_id = e.student_user_id
        join public.programs p on p.id = a.program_id and p.professional_user_id = a.professional_user_id
        join public.program_versions v on v.id = a.version_id and v.program_id = p.id
        where a.professional_user_id = r.professional_user_id
          and a.student_user_id = r.student_user_id and e.student_user_id = r.student_user_id
          and v.published_at is not null
        order by e.started_at desc, e.id desc limit 100
      ) e_row
    ), '[]'::jsonb)
  from public.professional_student_relationships r
  where r.student_user_id = auth.uid() and r.status = 'active'
    and r.professional_user_id = p_professional_user_id;
end
$$;
