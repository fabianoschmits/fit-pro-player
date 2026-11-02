-- Explicit applications require a valid expected revision.
begin;
create or replace function public.apply_library_plan(p_plan_id uuid,p_expected_revision bigint) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare selected public.athlete_plan_library; old_id uuid; a public.program_assignments; v public.program_versions;
 snapshot jsonb; routines jsonb:='[]'; week jsonb:='{}'; entry record; rid uuid; rev bigint; result jsonb; number_day integer;
begin
 perform public.assert_account_active();
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 if p_expected_revision is null or p_expected_revision<0 then raise exception 'invalid revision' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fitpp.library:'||auth.uid()::text,0));
 select revision into rev from public.athlete_schedules where user_id=auth.uid() for update;
 if p_expected_revision is distinct from coalesce(rev,0) then raise exception 'plan revision conflict' using errcode='40001'; end if;
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
 where e.value in ('null'::jsonb,'"rest"'::jsonb) or exists(select 1 from jsonb_array_elements(routines) r where r->>'id'=(e.value#>>'{}'))),'{}'::jsonb)));
 end if;
 select revision into rev from public.athlete_schedules where user_id=auth.uid() for update;
 result:=public.library_write_execution_plan(coalesce(rev,0),snapshot->>'mode',(snapshot->'schedule')||jsonb_build_object('libraryId',selected.id,'libraryTitle',selected.title),snapshot->'routines');
 if selected.source_type='self' then
 update public.athlete_plan_library set personal_plan=snapshot,updated_at=now() where id=selected.id;
 end if;
 insert into public.athlete_plan_selection(user_id,plan_id) values(auth.uid(),selected.id) on conflict(user_id) do update set plan_id=excluded.plan_id;
 return result;
end $$;

-- Older clients omit the revision. Resolve it under the same transaction lock.
create or replace function public.apply_library_plan(p_plan_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare current_revision bigint;
begin
 perform public.assert_account_active();
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fitpp.library:'||auth.uid()::text,0));
 select revision into current_revision from public.athlete_schedules where user_id=auth.uid() for update;
 return public.apply_library_plan(p_plan_id,coalesce(current_revision,0));
end $$;
notify pgrst,'reload schema';
commit;
