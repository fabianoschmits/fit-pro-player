-- Mutations cross authenticated RPCs only. Composite keys also protect internal writes.
revoke insert, update, delete on public.programs, public.program_versions,
  public.program_assignments, public.workout_executions from public, anon, authenticated;
drop policy programs_owner_all on public.programs;
create policy programs_owner_read on public.programs for select to authenticated using (professional_user_id = auth.uid());
drop policy versions_owner_insert on public.program_versions;
drop policy assignments_owner_insert on public.program_assignments;
drop policy assignments_owner_update on public.program_assignments;
drop policy executions_student_insert on public.workout_executions;
drop policy executions_student_update on public.workout_executions;

alter table public.programs add constraint programs_id_owner_key unique(id, professional_user_id);
alter table public.program_versions add constraint versions_id_program_key unique(id, program_id);
alter table public.program_assignments
  add constraint assignments_program_owner_fkey foreign key(program_id, professional_user_id) references public.programs(id, professional_user_id),
  add constraint assignments_version_program_fkey foreign key(version_id, program_id) references public.program_versions(id, program_id),
  add constraint assignments_relationship_fkey foreign key(professional_user_id, student_user_id) references public.professional_student_relationships(professional_user_id, student_user_id) on delete cascade,
  add constraint assignments_id_version_student_key unique(id, version_id, student_user_id);
alter table public.workout_executions add constraint executions_assignment_version_student_fkey
  foreign key(assignment_id, version_id, student_user_id) references public.program_assignments(id, version_id, student_user_id);
alter table public.workout_executions
  alter column assignment_id drop not null,
  alter column version_id drop not null,
  add column prescription_snapshot jsonb not null default '{}'::jsonb,
  add constraint executions_prescription_snapshot_check check(jsonb_typeof(prescription_snapshot)='object' and octet_length(prescription_snapshot::text)<=528384),
  add constraint executions_detached_history_check check (
    (assignment_id is not null and version_id is not null)
    or (assignment_id is null and version_id is null and prescription_snapshot<>'{}'::jsonb)
  );
-- Preserve history while ending duplicate active prescriptions created by the old contract.
with ranked as (
  select id, row_number() over(partition by student_user_id order by created_at desc,id desc) as position
  from public.program_assignments where status='active'
)
update public.program_assignments set status='revoked',revoked_at=now()
where id in (select id from ranked where position>1);
update public.program_assignments a set status='revoked',revoked_at=now()
where a.status='active' and not exists (
  select 1 from public.professional_student_relationships r
  where r.professional_user_id=a.professional_user_id and r.student_user_id=a.student_user_id and r.status='active'
);
create unique index program_assignments_one_active_student_idx on public.program_assignments(student_user_id) where status='active';

create or replace function public.check_active_assignment_prescription() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.status='active' then
    perform pg_advisory_xact_lock(hashtextextended('fitpp.student:'||new.student_user_id::text,0));
    perform 1 from public.professional_student_relationships
    where professional_user_id=new.professional_user_id and student_user_id=new.student_user_id and status='active' for share;
    if not found or not exists(select 1 from public.programs p join public.program_versions v on v.program_id=p.id
      where p.id=new.program_id and p.professional_user_id=new.professional_user_id and not p.archived and v.id=new.version_id and v.published_at is not null) then
      raise exception 'active assignment requires active relationship and published owned program' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.check_active_assignment_prescription() from public,anon,authenticated;
create trigger assignments_check_active_prescription before insert or update on public.program_assignments
for each row execute function public.check_active_assignment_prescription();

drop policy executions_participant_read on public.workout_executions;
create policy executions_participant_read on public.workout_executions for select to authenticated using (
  student_user_id=auth.uid() or exists (
    select 1 from public.program_assignments a join public.professional_student_relationships r
      on r.professional_user_id=a.professional_user_id and r.student_user_id=a.student_user_id
    where a.id=assignment_id and a.professional_user_id=auth.uid() and r.status='active'
  )
);

create or replace function public.end_revoked_relationship_assignments() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.status='revoked' then
    update public.program_assignments set status='revoked',revoked_at=coalesce(new.revoked_at,now())
    where professional_user_id=new.professional_user_id and student_user_id=new.student_user_id and status='active';
  end if;
  return new;
end $$;
revoke all on function public.end_revoked_relationship_assignments() from public,anon,authenticated;
create trigger relationships_end_assignments after update of status on public.professional_student_relationships
for each row execute function public.end_revoked_relationship_assignments();

create or replace function public.revoke_professional_relationship(p_relationship_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare relation public.professional_student_relationships;
begin
  select * into relation from public.professional_student_relationships
  where id=p_relationship_id and (professional_user_id=auth.uid() or student_user_id=auth.uid());
  if not found then raise exception 'relationship not found' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('fitpp.student:'||relation.student_user_id::text,0));
  update public.professional_student_relationships set status='revoked',revoked_at=coalesce(revoked_at,now()) where id=relation.id;
end $$;

create or replace function public.validate_professional_json(p_payload jsonb,p_max_bytes integer) returns void
language plpgsql immutable set search_path=public,pg_temp as $$
begin
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>p_max_bytes then
    raise exception 'invalid or oversized JSON object' using errcode='22023';
  end if;
end $$;
revoke all on function public.validate_professional_json(jsonb,integer) from public,anon,authenticated;

create or replace function public.create_program(p_title text,p_description text default null) returns public.programs
language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.programs;
begin
  if auth.uid() is null or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then
    raise exception 'professional capability required' using errcode='42501';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 160 or char_length(p_description)>4000 then
    raise exception 'invalid program metadata' using errcode='22023';
  end if;
  insert into public.programs(professional_user_id,title,description) values(auth.uid(),btrim(p_title),p_description) returning * into result;
  return result;
end $$;

create or replace function public.update_program(p_program_id uuid,p_title text,p_description text default null,p_archived boolean default false) returns public.programs
language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.programs;
begin
  if auth.uid() is null or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then
    raise exception 'professional capability required' using errcode='42501';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 160 or char_length(p_description)>4000 or p_archived is null then
    raise exception 'invalid program metadata' using errcode='22023';
  end if;
  update public.programs set title=btrim(p_title),description=p_description,archived=p_archived,updated_at=now()
  where id=p_program_id and professional_user_id=auth.uid() returning * into result;
  if not found then raise exception 'program ownership required' using errcode='42501'; end if;
  if p_archived then update public.program_assignments set status='revoked',revoked_at=now() where program_id=p_program_id and status='active'; end if;
  return result;
end $$;

create or replace function public.publish_program_version(p_program_id uuid,p_weekly_plan jsonb) returns public.program_versions
language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.program_versions; program public.programs; day_entry record; exercise jsonb; numeric_field text; max_value numeric; numeric_value numeric;
begin
  if auth.uid() is null or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then
    raise exception 'professional capability required' using errcode='42501';
  end if;
  select * into program from public.programs where id=p_program_id and professional_user_id=auth.uid() for update;
  if not found then raise exception 'program ownership required' using errcode='42501'; end if;
  if program.archived then raise exception 'archived program cannot be published' using errcode='22023'; end if;
  perform public.validate_professional_json(p_weekly_plan,524288);
  if p_weekly_plan='{}'::jsonb then raise exception 'weekly plan cannot be empty' using errcode='22023'; end if;
  for day_entry in select key,value from jsonb_each(p_weekly_plan) loop
    if day_entry.key not in ('sunday','monday','tuesday','wednesday','thursday','friday','saturday') or jsonb_typeof(day_entry.value)<>'array' then
      raise exception 'invalid weekly plan day' using errcode='22023';
    end if;
    if jsonb_array_length(day_entry.value) not between 1 and 50 then raise exception 'invalid exercise count' using errcode='22023'; end if;
    for exercise in select e.value from jsonb_array_elements(day_entry.value) e loop
      if jsonb_typeof(exercise)<>'object' or char_length(btrim(coalesce(exercise->>'exerciseId',exercise->>'id',''))) not between 1 and 120 then
        raise exception 'invalid exercise identity' using errcode='22023';
      end if;
      foreach numeric_field in array array['sets','reps','load','weight','rest','sec','min','speed','rir','rpe'] loop
        if not exercise ? numeric_field and numeric_field not in ('sets','reps') then continue; end if;
        if coalesce(exercise->>numeric_field,'') !~ '^[0-9]+(\.[0-9]+)?$' then raise exception 'invalid exercise number' using errcode='22023'; end if;
        numeric_value := (exercise->>numeric_field)::numeric;
        max_value := case numeric_field when 'sets' then 50 when 'reps' then 500 when 'load' then 10000 when 'weight' then 10000 when 'rest' then 3600 when 'sec' then 86400 when 'min' then 1440 when 'speed' then 100 else 10 end;
        if numeric_value>max_value or (numeric_field in ('sets','reps') and (numeric_value<1 or numeric_value<>trunc(numeric_value))) then
          raise exception 'exercise number outside bounds' using errcode='22023';
        end if;
      end loop;
      if (exercise ? 'mode' and exercise->>'mode' not in ('reps','time','cardio'))
        or (exercise ? 'unit' and exercise->>'unit' not in ('kg','lb'))
        or char_length(exercise->>'notes')>500 or char_length(exercise->>'sg')>80 or char_length(exercise->>'effort')>10 then
        raise exception 'invalid exercise prescription' using errcode='22023';
      end if;
    end loop;
  end loop;
  insert into public.program_versions(program_id,version_number,weekly_plan,published_at)
  select p_program_id,coalesce(max(version_number),0)+1,p_weekly_plan,now() from public.program_versions where program_id=p_program_id returning * into result;
  return result;
end $$;

create or replace function public.assign_program_version(p_program_id uuid,p_version_id uuid,p_student_user_id uuid) returns public.program_assignments
language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.program_assignments; program public.programs;
begin
  if auth.uid() is null or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then raise exception 'professional capability required' using errcode='42501'; end if;
  select * into program from public.programs where id=p_program_id and professional_user_id=auth.uid() for share;
  if not found or not exists(select 1 from public.program_versions where id=p_version_id and program_id=p_program_id and published_at is not null) then raise exception 'program version ownership mismatch' using errcode='42501'; end if;
  if program.archived then raise exception 'archived program cannot be assigned' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('fitpp.student:'||p_student_user_id::text,0));
  perform 1 from public.professional_student_relationships where professional_user_id=auth.uid() and student_user_id=p_student_user_id and status='active' for share;
  if not found then raise exception 'active student relationship required' using errcode='42501'; end if;
  select * into result from public.program_assignments where student_user_id=p_student_user_id and status='active' and version_id=p_version_id and professional_user_id=auth.uid();
  if found then return result; end if;
  update public.program_assignments set status='revoked',revoked_at=now() where student_user_id=p_student_user_id and status='active';
  insert into public.program_assignments(program_id,version_id,professional_user_id,student_user_id) values(p_program_id,p_version_id,auth.uid(),p_student_user_id) returning * into result;
  return result;
end $$;

create or replace function public.revoke_program_assignment(p_assignment_id uuid) returns public.program_assignments
language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.program_assignments;
begin
  select * into result from public.program_assignments where id=p_assignment_id and (professional_user_id=auth.uid() or student_user_id=auth.uid());
  if not found then raise exception 'assignment ownership required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('fitpp.student:'||result.student_user_id::text,0));
  update public.program_assignments set status='revoked',revoked_at=coalesce(revoked_at,now()) where id=p_assignment_id returning * into result;
  return result;
end $$;

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
  select v.weekly_plan,jsonb_build_object('programTitle',p.title,'versionNumber',v.version_number,'dayKey',p_day_key,'exercises',coalesce(v.weekly_plan->p_day_key,'[]'::jsonb))
  into plan,prescription from public.program_versions v join public.programs p on p.id=v.program_id where v.id=assignment.version_id;
  if p_day_key is null or not plan ? p_day_key then raise exception 'day is not prescribed' using errcode='22023'; end if;
  insert into public.workout_executions(id,assignment_id,version_id,student_user_id,day_key,payload,started_at,prescription_snapshot)
  values(p_execution_id,assignment.id,assignment.version_id,auth.uid(),p_day_key,p_payload,p_started_at,prescription) returning * into result;
  return result;
end $$;

create or replace function public.finish_workout_execution(p_execution_id uuid,p_status public.execution_status,p_payload jsonb,p_completed_at timestamptz) returns public.workout_executions
language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.workout_executions;
begin
  if auth.uid() is null then raise exception 'authenticated identity required' using errcode='42501'; end if;
  perform public.validate_professional_json(p_payload,262144);
  if p_status is null or p_status not in ('completed','abandoned') or p_completed_at is null or not isfinite(p_completed_at) or p_completed_at>now()+interval '5 minutes' then raise exception 'invalid execution completion' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('fitpp.student:'||auth.uid()::text,0));
  select * into result from public.workout_executions where id=p_execution_id and student_user_id=auth.uid() for update;
  if not found then raise exception 'execution ownership required' using errcode='42501'; end if;
  if result.status=p_status then return result; end if;
  if result.status<>'in_progress' then raise exception 'execution already finalized' using errcode='22023'; end if;
  if p_completed_at<result.started_at then raise exception 'completion precedes start' using errcode='22023'; end if;
  if not exists(select 1 from public.program_assignments a join public.professional_student_relationships r on r.professional_user_id=a.professional_user_id and r.student_user_id=a.student_user_id where a.id=result.assignment_id and r.status='active') then raise exception 'active student relationship required' using errcode='42501'; end if;
  update public.workout_executions set status=p_status,payload=p_payload,completed_at=p_completed_at where id=p_execution_id returning * into result;
  return result;
end $$;
revoke all on function public.finish_workout_execution(uuid,public.execution_status,jsonb,timestamptz) from public,anon,authenticated;

create or replace function public.complete_workout_execution(p_execution_id uuid,p_payload jsonb default '{}'::jsonb,p_completed_at timestamptz default now()) returns public.workout_executions
language sql security definer set search_path=public,pg_temp as $$select public.finish_workout_execution(p_execution_id,'completed',p_payload,p_completed_at)$$;
create or replace function public.abandon_workout_execution(p_execution_id uuid,p_payload jsonb default '{}'::jsonb,p_completed_at timestamptz default now()) returns public.workout_executions
language sql security definer set search_path=public,pg_temp as $$select public.finish_workout_execution(p_execution_id,'abandoned',p_payload,p_completed_at)$$;

-- A caller lock exists before the first row does. Concurrent first saves return CONFLICT.
create or replace function public.save_own_account_snapshot(p_expected_revision bigint,p_state_schema_version integer,p_payload jsonb)
returns table(status text,revision bigint,updated_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$
declare current_row public.account_snapshots; caller uuid:=auth.uid();
begin
  if caller is null then raise exception 'authenticated identity required' using errcode='42501'; end if;
  if p_expected_revision is null or p_expected_revision<0 or p_state_schema_version is null or p_state_schema_version not between 1 and 1000 then raise exception 'invalid snapshot revision/schema' using errcode='22023'; end if;
  perform public.validate_professional_json(p_payload,2097152);
  perform pg_advisory_xact_lock(hashtextextended('fitpp.snapshot:'||caller::text,0));
  select * into current_row from public.account_snapshots where user_id=caller for update;
  if not found then
    if p_expected_revision<>0 then return query select 'CONFLICT'::text,null::bigint,null::timestamptz; return; end if;
    insert into public.account_snapshots(user_id,revision,state_schema_version,payload) values(caller,1,p_state_schema_version,p_payload) returning * into current_row;
  elsif current_row.revision<>p_expected_revision then
    return query select 'CONFLICT'::text,current_row.revision,current_row.updated_at; return;
  else
    update public.account_snapshots s set revision=s.revision+1,state_schema_version=p_state_schema_version,payload=p_payload,updated_at=now() where user_id=caller returning * into current_row;
  end if;
  return query select 'APPLIED'::text,current_row.revision,current_row.updated_at;
end $$;

revoke all on function public.create_program(text,text),public.update_program(uuid,text,text,boolean),
  public.start_workout_execution(uuid,uuid,text,jsonb,timestamptz),public.complete_workout_execution(uuid,jsonb,timestamptz),
  public.abandon_workout_execution(uuid,jsonb,timestamptz),public.revoke_program_assignment(uuid) from public,anon;
grant execute on function public.create_program(text,text),public.update_program(uuid,text,text,boolean),
  public.start_workout_execution(uuid,uuid,text,jsonb,timestamptz),public.complete_workout_execution(uuid,jsonb,timestamptz),
  public.abandon_workout_execution(uuid,jsonb,timestamptz),public.revoke_program_assignment(uuid) to authenticated;

-- Permanent deletion removes the caller-owned graph while retaining students' personal history.
-- Explicit graph order avoids the old RESTRICT foreign keys blocking auth deletion.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare caller uuid:=auth.uid(); student_id uuid;
begin
  if caller is null then raise exception 'authenticated identity required' using errcode='42501'; end if;
  -- Publication/assignment takes a program lock before the student lock as well.
  perform 1 from public.programs where professional_user_id=caller order by id for update;
  for student_id in
    select student_user_id from public.program_assignments where professional_user_id=caller
    union select caller order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended('fitpp.student:'||student_id::text,0));
  end loop;
  delete from public.workout_executions where student_user_id=caller;
  update public.workout_executions e
  set prescription_snapshot=case when e.prescription_snapshot='{}'::jsonb then
      jsonb_build_object('programTitle',p.title,'versionNumber',v.version_number,'dayKey',e.day_key,'exercises',coalesce(v.weekly_plan->e.day_key,'[]'::jsonb))
      else e.prescription_snapshot end,
      assignment_id=null,version_id=null,
      status=case when e.status='in_progress' then 'abandoned'::public.execution_status else e.status end,
      completed_at=case when e.status='in_progress' then now() else e.completed_at end,
      payload=case when e.status='in_progress' then e.payload||'{"abandonReason":"professional-account-deleted"}'::jsonb else e.payload end
  from public.program_assignments a join public.program_versions v on v.id=a.version_id join public.programs p on p.id=a.program_id
  where e.assignment_id=a.id and a.professional_user_id=caller;
  delete from public.program_assignments where professional_user_id=caller or student_user_id=caller;
  delete from public.program_versions where program_id in(select id from public.programs where professional_user_id=caller);
  delete from public.programs where professional_user_id=caller;
  delete from auth.users where id=caller;
end $$;
revoke all on function public.delete_my_account() from public,anon;
grant execute on function public.delete_my_account() to authenticated;

-- Bounded projections retain recent history without unbounded JSON aggregation.
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
  order by r.created_at desc limit 200;
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
        order by a.created_at desc, a.id desc limit 100
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
        order by e.started_at desc, e.id desc limit 100
      ) e_row
    ), '[]'::jsonb)
  from public.professional_student_relationships r
  left join public.profiles p on p.id = r.student_user_id
  where r.professional_user_id = auth.uid()
    and r.student_user_id = p_student_user_id
    and r.status = 'active';
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
