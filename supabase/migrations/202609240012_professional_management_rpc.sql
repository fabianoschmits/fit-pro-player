create or replace function public.professional_client_summaries()
returns table (
  student_user_id uuid,
  display_name text,
  avatar_ref text,
  relationship_created_at timestamptz,
  active_assignment_id uuid,
  program_id uuid,
  program_title text,
  version_id uuid,
  version_number integer,
  last_execution_at timestamptz,
  last_execution_status public.execution_status
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    r.student_user_id,
    coalesce(p.display_name, '') as display_name,
    p.avatar_ref,
    r.created_at,
    a.id,
    a.program_id,
    pr.title,
    a.version_id,
    pv.version_number,
    e.started_at,
    e.status
  from public.professional_student_relationships r
  left join public.profiles p on p.id = r.student_user_id
  left join lateral (
    select pa.*
    from public.program_assignments pa
    where pa.professional_user_id = auth.uid()
      and pa.student_user_id = r.student_user_id
      and pa.status = 'active'
    order by pa.created_at desc
    limit 1
  ) a on true
  left join public.programs pr on pr.id = a.program_id
  left join public.program_versions pv on pv.id = a.version_id
  left join lateral (
    select we.started_at, we.status
    from public.workout_executions we
    where we.assignment_id = a.id
    order by we.started_at desc
    limit 1
  ) e on true
  where r.professional_user_id = auth.uid()
    and r.status = 'active'
  order by r.created_at desc;
$$;

create or replace function public.professional_client_detail(p_student_user_id uuid)
returns table (
  student_user_id uuid,
  display_name text,
  avatar_ref text,
  relationship_created_at timestamptz,
  assignments jsonb,
  executions jsonb
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    r.student_user_id,
    coalesce(p.display_name, '') as display_name,
    p.avatar_ref,
    r.created_at,
    coalesce((
      select jsonb_agg(to_jsonb(a_row) order by a_row.created_at desc)
      from (
        select a.*, pr.title as program_title, pv.version_number
        from public.program_assignments a
        join public.programs pr on pr.id = a.program_id
        join public.program_versions pv on pv.id = a.version_id
        where a.professional_user_id = auth.uid()
          and a.student_user_id = r.student_user_id
      ) a_row
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(to_jsonb(e_row) order by e_row.started_at desc)
      from (
        select e.*, pr.title as program_title, pv.version_number
        from public.workout_executions e
        join public.program_assignments a on a.id = e.assignment_id
        join public.programs pr on pr.id = a.program_id
        join public.program_versions pv on pv.id = e.version_id
        where a.professional_user_id = auth.uid()
          and e.student_user_id = r.student_user_id
      ) e_row
    ), '[]'::jsonb)
  from public.professional_student_relationships r
  left join public.profiles p on p.id = r.student_user_id
  where r.professional_user_id = auth.uid()
    and r.student_user_id = p_student_user_id
    and r.status = 'active';
$$;

create or replace function public.publish_program_version(p_program_id uuid, p_weekly_plan jsonb)
returns public.program_versions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  next_version integer;
  result public.program_versions;
  day_entry record;
  exercise jsonb;
begin
  if caller is null or not exists (
    select 1 from public.user_roles where user_id = caller and role = 'professional'
  ) then
    raise exception 'professional capability required' using errcode = '42501';
  end if;
  if p_weekly_plan is null or jsonb_typeof(p_weekly_plan) <> 'object' then
    raise exception 'weekly plan must be an object' using errcode = '22023';
  end if;
  if not exists (select 1 from jsonb_each(p_weekly_plan)) then
    raise exception 'weekly plan cannot be empty' using errcode = '22023';
  end if;
  if not exists (select 1 from public.programs where id = p_program_id and professional_user_id = caller) then
    raise exception 'program ownership required' using errcode = '42501';
  end if;
  perform 1 from public.programs where id = p_program_id for update;

  for day_entry in select key, value from jsonb_each(p_weekly_plan) loop
    if day_entry.key not in ('sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday')
      or jsonb_typeof(day_entry.value) <> 'array'
      or jsonb_array_length(day_entry.value) = 0
      or jsonb_array_length(day_entry.value) > 50 then
      raise exception 'invalid weekly plan day' using errcode = '22023';
    end if;
    for exercise in select value from jsonb_array_elements(day_entry.value) loop
      if nullif(btrim(coalesce(exercise->>'exerciseId', exercise->>'id', '')), '') is null
        or coalesce(exercise->>'sets', '') !~ '^[0-9]+$'
        or coalesce(exercise->>'reps', '') !~ '^[0-9]+$'
        or (exercise->>'sets')::integer not between 1 and 50
        or (exercise->>'reps')::integer not between 1 and 500 then
        raise exception 'invalid weekly plan exercise' using errcode = '22023';
      end if;
    end loop;
  end loop;

  select coalesce(max(version_number), 0) + 1 into next_version
  from public.program_versions where program_id = p_program_id;
  insert into public.program_versions(program_id, version_number, weekly_plan, published_at)
  values (p_program_id, next_version, p_weekly_plan, now())
  returning * into result;
  return result;
end;
$$;

create or replace function public.assign_program_version(p_program_id uuid, p_version_id uuid, p_student_user_id uuid)
returns public.program_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  result public.program_assignments;
begin
  if caller is null or not exists (
    select 1 from public.user_roles where user_id = caller and role = 'professional'
  ) then
    raise exception 'professional capability required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.programs where id = p_program_id and professional_user_id = caller
  ) or not exists (
    select 1 from public.program_versions where id = p_version_id and program_id = p_program_id
  ) then
    raise exception 'program version ownership mismatch' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.professional_student_relationships
    where professional_user_id = caller and student_user_id = p_student_user_id and status = 'active'
  ) then
    raise exception 'active student relationship required' using errcode = '42501';
  end if;
  update public.program_assignments
  set status = 'revoked', revoked_at = now()
  where professional_user_id = caller
    and student_user_id = p_student_user_id
    and program_id = p_program_id
    and status = 'active';
  insert into public.program_assignments(program_id, version_id, professional_user_id, student_user_id, status)
  values (p_program_id, p_version_id, caller, p_student_user_id, 'active')
  returning * into result;
  return result;
end;
$$;

create or replace function public.student_program_overview()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select jsonb_build_object(
      'assignment', to_jsonb(a),
      'program', jsonb_build_object('id', p.id, 'title', p.title, 'description', p.description),
      'version', jsonb_build_object('id', v.id, 'versionNumber', v.version_number, 'weeklyPlan', v.weekly_plan, 'publishedAt', v.published_at),
      'professional', jsonb_build_object('id', pp.user_id, 'name', pp.professional_name, 'bio', pp.bio, 'specialties', pp.specialties),
      'executions', coalesce((select jsonb_agg(to_jsonb(e) order by e.started_at desc) from public.workout_executions e where e.assignment_id = a.id), '[]'::jsonb)
    )
    from public.program_assignments a
    join public.programs p on p.id = a.program_id
    join public.program_versions v on v.id = a.version_id
    left join public.professional_profiles pp on pp.user_id = a.professional_user_id
    where a.student_user_id = auth.uid() and a.status = 'active'
    order by a.created_at desc
    limit 1
  ), '{}'::jsonb);
$$;

revoke all on function public.professional_client_summaries() from public, anon;
revoke all on function public.professional_client_detail(uuid) from public, anon;
revoke all on function public.publish_program_version(uuid, jsonb) from public, anon;
revoke all on function public.assign_program_version(uuid, uuid, uuid) from public, anon;
revoke all on function public.student_program_overview() from public, anon;
grant execute on function public.professional_client_summaries() to authenticated;
grant execute on function public.professional_client_detail(uuid) to authenticated;
grant execute on function public.publish_program_version(uuid, jsonb) to authenticated;
grant execute on function public.assign_program_version(uuid, uuid, uuid) to authenticated;
grant execute on function public.student_program_overview() to authenticated;
