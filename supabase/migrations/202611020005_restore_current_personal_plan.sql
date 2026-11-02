-- Restore personal configuration without rolling live routines back to an old snapshot.
begin;
create or replace function public.save_personal_library_plan(p_title text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; snapshot jsonb;
begin
 perform public.assert_account_active();
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fitpp.library:'||auth.uid()::text,0));
 if exists(select 1 from public.athlete_plan_selection s join public.athlete_plan_library l on l.id=s.plan_id where s.user_id=auth.uid() and l.source_type='professional') then
  -- The most recently used personal workspace is preferred over older saved copies.
  select id into result from public.athlete_plan_library where user_id=auth.uid() and source_type='self' order by updated_at desc,created_at desc,id limit 1;
  if result is not null then return result; end if;
  -- Legacy accounts may have no personal snapshot: never copy the professional calendar.
  select jsonb_build_object('mode','weekly','schedule',jsonb_build_object('week','{}'::jsonb,'dayPlan','{}'::jsonb),
   'routines',coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'prescription',prescription) order by position),'[]'::jsonb))
  into snapshot from public.athlete_routines where user_id=auth.uid() and prescription->>'assigned' is distinct from 'true';
  insert into public.athlete_plan_library(user_id,source_type,title,personal_plan) values(auth.uid(),'self',p_title,snapshot) returning id into result;
  return result;
 end if;
 return public.library_capture_personal(p_title);
end $$;

create or replace function public.apply_library_plan(p_plan_id uuid,p_expected_revision bigint) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare selected public.athlete_plan_library; old_id uuid; a public.program_assignments; v public.program_versions;
 snapshot jsonb; routines jsonb:='[]'; week jsonb:='{}'; entry record; rid uuid; rev bigint; result jsonb; number_day integer;
begin
 perform public.assert_account_active();
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fitpp.library:'||auth.uid()::text,0));
 select revision into rev from public.athlete_schedules where user_id=auth.uid() for update;
 if p_expected_revision is not null and p_expected_revision is distinct from coalesce(rev,0) then raise exception 'plan revision conflict' using errcode='40001'; end if;
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
 else
 -- Personal routines are live data. A saved snapshot owns only the personal schedule/mode.
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'prescription',prescription) order by position),'[]'::jsonb)
 into routines from public.athlete_routines where user_id=auth.uid() and prescription->>'assigned' is distinct from 'true';
 snapshot:=jsonb_build_object('mode',coalesce(selected.personal_plan->>'mode','weekly'),'routines',routines,
 'schedule',jsonb_build_object(
 'week',coalesce((select jsonb_object_agg(e.key,e.value) from jsonb_each(coalesce(selected.personal_plan->'schedule'->'week','{}'::jsonb)) e
 where exists(select 1 from jsonb_array_elements(routines) r where r->>'id'=(e.value#>>'{}'))),'{}'::jsonb),
 'dayPlan',coalesce((select jsonb_object_agg(e.key,e.value) from jsonb_each(coalesce(selected.personal_plan->'schedule'->'dayPlan','{}'::jsonb)) e
 where e.value='null'::jsonb or exists(select 1 from jsonb_array_elements(routines) r where r->>'id'=(e.value#>>'{}'))),'{}'::jsonb)));
 end if;
 select revision into rev from public.athlete_schedules where user_id=auth.uid() for update;
 result:=public.library_write_execution_plan(coalesce(rev,0),snapshot->>'mode',(snapshot->'schedule')||jsonb_build_object('libraryId',selected.id,'libraryTitle',selected.title),snapshot->'routines');
 if selected.source_type='self' then
 update public.athlete_plan_library set personal_plan=snapshot,updated_at=now() where id=selected.id;
 end if;
 insert into public.athlete_plan_selection(user_id,plan_id) values(auth.uid(),selected.id) on conflict(user_id) do update set plan_id=excluded.plan_id;
 return result;
end $$;

-- Keep the existing API for older clients; new clients supply their synchronized revision.
create or replace function public.apply_library_plan(p_plan_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.assert_account_active();
 return public.apply_library_plan(p_plan_id,null);
end $$;
revoke all on function public.apply_library_plan(uuid,bigint) from public,anon,authenticated;
grant execute on function public.apply_library_plan(uuid,bigint) to authenticated;
-- Include the active version even when a newer delivery is available.
create or replace function public.athlete_plan_library_page(p_offset integer default 0,p_limit integer default 30) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 perform public.assert_account_active();
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 with ranked as (
  select l.*,a.professional_user_id,a.program_id,a.status,v.version_number,to_jsonb(v) version,pp.professional_name,row_number() over(partition by coalesce(a.program_id,l.id) order by v.version_number desc nulls last,l.created_at desc,l.id) rank
  from public.athlete_plan_library l left join public.program_assignments a on a.id=l.assignment_id left join public.program_versions v on v.id=a.version_id left join public.professional_profiles pp on pp.user_id=a.professional_user_id where l.user_id=auth.uid()
 ), latest as (select * from ranked where rank=1 or id=(select plan_id from public.athlete_plan_selection where user_id=auth.uid())), page as (select * from latest order by created_at desc,id offset greatest(0,p_offset) limit least(50,greatest(1,p_limit)))
 select jsonb_build_object('selectedId',(select plan_id from public.athlete_plan_selection where user_id=auth.uid()),'total',(select count(*) from latest),'items',coalesce((select jsonb_agg(
 (to_jsonb(p)-'rank'-'status'-'professional_user_id'-'version_number') || jsonb_build_object('professional_id',p.professional_user_id,'available',p.assignment_id is null or (p.status='active' and exists(select 1 from public.professional_student_relationships r where r.professional_user_id=p.professional_user_id and r.student_user_id=auth.uid() and r.status='active')),'workout_updates',coalesce(changes.pending,'{}'::jsonb),'workout_update_bases',coalesce(changes.bases,'{}'::jsonb),'plan_update',case when changes.changed is null then null else jsonb_build_object('is_first',global_base.id is null,'previous_version',global_base.version,'next_version',p.version,'affected_days',changes.changed) end)
 order by p.created_at desc,p.id) from page p
 left join public.professional_plan_update_views seen on seen.student_user_id=auth.uid() and seen.program_id=p.program_id
 left join public.program_versions global_base_row on global_base_row.id=seen.seen_version_id
 left join lateral (select global_base_row.id,to_jsonb(global_base_row) version) global_base on true
 left join lateral (
  select jsonb_object_agg(day,p.version->>'id') filter(where changed) pending,
   jsonb_object_agg(day,jsonb_build_object('version',coalesce(to_jsonb(day_base),global_base.version))) filter(where changed) bases,
   jsonb_agg(day) filter(where changed) changed
  from unnest(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday']) as days(day)
  left join public.professional_plan_update_day_views read on read.student_user_id=auth.uid() and read.program_id=p.program_id and read.day_key=day
  left join public.program_versions day_base on day_base.id=coalesce(read.seen_version_id,global_base_row.id)
  cross join lateral (select coalesce(p.version->'weekly_plan'->day,'[]'::jsonb) is distinct from coalesce(to_jsonb(day_base)->'weekly_plan'->day,'[]'::jsonb) or coalesce(p.version->'workout_titles'->day,'null'::jsonb) is distinct from coalesce(to_jsonb(day_base)->'workout_titles'->day,'null'::jsonb) changed) comparison
 ) changes on true),'[]'::jsonb)) into result;
 return result;
end $$;


notify pgrst,'reload schema';
commit;
