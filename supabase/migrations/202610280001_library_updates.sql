-- Keep immutable deliveries for execution history, but list only the latest per program.
create table public.athlete_library_workout_reads (
 user_id uuid not null references auth.users(id) on delete cascade,
 program_id uuid not null references public.programs(id) on delete cascade,
 day_key text not null check(day_key in ('sunday','monday','tuesday','wednesday','thursday','friday','saturday')),
 change_version_id uuid not null references public.program_versions(id),
 primary key(user_id,program_id,day_key)
);
alter table public.athlete_library_workout_reads enable row level security;
revoke all on public.athlete_library_workout_reads from public,anon,authenticated;

create function public.library_workout_updates(p_plan_id uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 with target as (
  select a.program_id,v.version_number,v.weekly_plan
  from public.athlete_plan_library l join public.program_assignments a on a.id=l.assignment_id
  join public.program_versions v on v.id=a.version_id
  where l.id=p_plan_id and l.user_id=auth.uid()
 ), deliveries as (
  select distinct v.id,v.version_number,v.weekly_plan,v.workout_titles
  from public.program_assignments a join public.program_versions v on v.id=a.version_id
  join target t on t.program_id=a.program_id and v.version_number<=t.version_number
  where a.student_user_id=auth.uid()
 ), history as (
  select *,lag(id) over w previous_id,lag(weekly_plan) over w previous_plan,
   lag(workout_titles) over w previous_titles from deliveries window w as (order by version_number)
 ), changes as (
  select distinct on (day.key) day.key, h.id,h.version_number,t.program_id
  from target t cross join lateral jsonb_each(t.weekly_plan) day cross join history h
  where jsonb_array_length(day.value)>0 and h.previous_id is not null
   and (h.weekly_plan->day.key is distinct from h.previous_plan->day.key
    or h.workout_titles->day.key is distinct from h.previous_titles->day.key)
  order by day.key,h.version_number desc
 )
 select coalesce(jsonb_object_agg(c.key,c.id),'{}'::jsonb) from changes c
 left join public.athlete_library_workout_reads r on r.user_id=auth.uid() and r.program_id=c.program_id and r.day_key=c.key
 where r.change_version_id is distinct from c.id;
$$;
revoke all on function public.library_workout_updates(uuid) from public,anon,authenticated;

create function public.mark_library_workout_seen(p_plan_id uuid,p_day text,p_change_version_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare program uuid;
begin
 select a.program_id into program from public.athlete_plan_library l join public.program_assignments a on a.id=l.assignment_id
 where l.id=p_plan_id and l.user_id=auth.uid();
 if program is null then raise exception 'plan ownership required' using errcode='42501'; end if;
 if public.library_workout_updates(p_plan_id)->>p_day is distinct from p_change_version_id::text then return; end if;
 insert into public.athlete_library_workout_reads(user_id,program_id,day_key,change_version_id)
 values(auth.uid(),program,p_day,p_change_version_id)
 on conflict(user_id,program_id,day_key) do update set change_version_id=excluded.change_version_id
 where (select version_number from public.program_versions where id=excluded.change_version_id)
 >= (select version_number from public.program_versions where id=athlete_library_workout_reads.change_version_id);
end $$;
revoke all on function public.mark_library_workout_seen(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.mark_library_workout_seen(uuid,text,uuid) to authenticated;

create or replace function public.athlete_plan_library_page(p_offset integer default 0,p_limit integer default 30) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 with ranked as (
  select l.*,a.professional_user_id,a.program_id,a.status,v.version_number,to_jsonb(v) version,
   pp.professional_name,
   row_number() over(partition by coalesce(a.program_id,l.id) order by v.version_number desc nulls last,l.created_at desc,l.id) rank
  from public.athlete_plan_library l left join public.program_assignments a on a.id=l.assignment_id
  left join public.program_versions v on v.id=a.version_id
  left join public.professional_profiles pp on pp.user_id=a.professional_user_id
  where l.user_id=auth.uid()
 ), latest as (select * from ranked where rank=1), page as (
  select * from latest order by created_at desc,id offset greatest(0,p_offset) limit least(50,greatest(1,p_limit))
 )
 select jsonb_build_object('selectedId',(select plan_id from public.athlete_plan_selection where user_id=auth.uid()),
 'total',(select count(*) from latest),'items',coalesce((select jsonb_agg(
 (to_jsonb(p)-'rank'-'status'-'professional_user_id'-'version_number')||jsonb_build_object(
 'professional_id',p.professional_user_id,'workout_updates',public.library_workout_updates(p.id),
 'available',p.assignment_id is null or (p.status='active' and exists(select 1 from public.professional_student_relationships r where r.professional_user_id=p.professional_user_id and r.student_user_id=auth.uid() and r.status='active')))
 order by p.created_at desc,p.id) from page p),'[]'::jsonb)) into result;
 return result;
end $$;

-- Permit personal additions/edits, while preserving every received prescription verbatim.
create or replace function public.save_athlete_plan(p_expected_revision bigint,p_mode text,p_schedule jsonb,p_routines jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare selected public.athlete_plan_library; result jsonb;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fitpp.library:'||auth.uid()::text,0));
 select l.* into selected from public.athlete_plan_selection s join public.athlete_plan_library l on l.id=s.plan_id where s.user_id=auth.uid();
 if selected.id is not null and (p_schedule->>'libraryId') is distinct from selected.id::text then raise exception 'plan selection changed' using errcode='42501'; end if;
 if selected.source_type='professional' then
  if jsonb_typeof(p_routines) is distinct from 'array' then raise exception 'invalid routines' using errcode='22023'; end if;
  if exists(select 1 from public.athlete_routines r where r.user_id=auth.uid() and r.prescription->>'assigned'='true'
   and not exists(select 1 from jsonb_array_elements(p_routines) x where x->>'id'=r.id::text and x->>'title'=r.title and x->'prescription'=r.prescription))
   or exists(select 1 from jsonb_array_elements(p_routines) x where x->'prescription'->>'assigned'='true'
    and not exists(select 1 from public.athlete_routines r where r.user_id=auth.uid() and r.id::text=x->>'id' and r.prescription->>'assigned'='true'))
   or (p_schedule->'assignedProgram') is distinct from (select schedule->'assignedProgram' from public.athlete_schedules where user_id=auth.uid())
  then raise exception 'professional prescription is read only' using errcode='42501'; end if;
 end if;
 result:=public.library_write_execution_plan(p_expected_revision,p_mode,p_schedule,p_routines);
 if selected.source_type='self' then
  update public.athlete_plan_library set personal_plan=jsonb_build_object('mode',p_mode,'schedule',p_schedule,'routines',p_routines),updated_at=now() where id=selected.id;
 end if;
 return result;
end $$;
create or replace function public.apply_library_plan(p_plan_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare selected public.athlete_plan_library; old_id uuid; a public.program_assignments; v public.program_versions;
 snapshot jsonb; routines jsonb:='[]'; week jsonb:='{}'; entry record; rid uuid; rev bigint; result jsonb; number_day integer;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fitpp.library:'||auth.uid()::text,0));
 select * into selected from public.athlete_plan_library where id=p_plan_id and user_id=auth.uid();
 if not found then raise exception 'plan ownership required' using errcode='42501'; end if;
 select plan_id into old_id from public.athlete_plan_selection where user_id=auth.uid();
 -- Before the first selection preserve the user's existing workspace once.
 if old_id is null then perform public.library_capture_personal(); end if;
 if selected.source_type='professional' then
 select * into a from public.program_assignments where id=selected.assignment_id and student_user_id=auth.uid() and status='active' for share;
 if not found then raise exception 'delivery unavailable' using errcode='42501'; end if;
 perform 1 from public.professional_student_relationships where professional_user_id=a.professional_user_id and student_user_id=auth.uid() and status='active' for share;
 if not found then raise exception 'relationship unavailable' using errcode='42501'; end if;
 select * into v from public.program_versions where id=a.version_id;
 for entry in select key,value from jsonb_each(v.weekly_plan) loop
 number_day:=array_position(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],entry.key)-1;
 if number_day is null or jsonb_array_length(entry.value)=0 then continue; end if;
 rid:=gen_random_uuid(); week:=week||jsonb_build_object(number_day::text,rid);
 routines:=routines||jsonb_build_array(jsonb_build_object('id',rid,'title',coalesce(v.workout_titles->>entry.key,'Treino'),'prescription',jsonb_build_object('assigned',true,'assignedDayKey',entry.key,'assignmentId',a.id,'programVersionId',v.id,'ex',
 (select jsonb_agg((x-'exerciseId'-'load')||jsonb_build_object('id',x->>'exerciseId','weight',coalesce(x->'load','0'::jsonb))) from jsonb_array_elements(entry.value) x))));
 end loop;
 routines:=routines||coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'prescription',prescription) order by position) from public.athlete_routines where user_id=auth.uid() and prescription->>'assigned' is distinct from 'true'),'[]'::jsonb);
 snapshot:=jsonb_build_object('mode','weekly','routines',routines,'schedule',jsonb_build_object('week',week,'dayPlan','{}'::jsonb,'assignedProgram',jsonb_build_object('assignmentId',a.id,'programId',a.program_id,'versionId',v.id,'versionNumber',v.version_number)));
 else snapshot:=selected.personal_plan; end if;
 select revision into rev from public.athlete_schedules where user_id=auth.uid() for update;
 result:=public.library_write_execution_plan(coalesce(rev,0),snapshot->>'mode',(snapshot->'schedule')||jsonb_build_object('libraryId',selected.id,'libraryTitle',selected.title),snapshot->'routines');
 insert into public.athlete_plan_selection(user_id,plan_id) values(auth.uid(),selected.id) on conflict(user_id) do update set plan_id=excluded.plan_id;
 return result;
end $$;


