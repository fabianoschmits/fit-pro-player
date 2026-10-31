-- Deliveries never change the execution workspace. Only apply_library_plan activates them.
create or replace function public.send_student_plan(p_student_id uuid,p_expected_revision bigint) returns public.program_assignments
language plpgsql security definer set search_path=public,pg_temp as $$
declare draft public.professional_plan_drafts; version public.program_versions; previous public.program_versions; result public.program_assignments; weekly jsonb:='{}'; titles jsonb:='{}'; entry record; routine jsonb; day_name text; days jsonb;
begin
 if p_expected_revision is null or p_expected_revision<0 then raise exception 'invalid revision' using errcode='22023'; end if;
 if not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then raise exception 'professional capability required' using errcode='42501'; end if;
 perform 1 from public.professional_student_relationships where professional_user_id=auth.uid() and student_user_id=p_student_id and status='active' for share;
 if not found then raise exception 'active student relationship required' using errcode='42501'; end if;
 select * into draft from public.professional_plan_drafts where professional_id=auth.uid() and student_id=p_student_id for update;
 if not found then raise exception 'draft ownership required' using errcode='42501'; end if;
 if draft.revision<>p_expected_revision then raise exception 'draft revision conflict' using errcode='40001'; end if;
 if draft.sent_revision=draft.revision then select * into result from public.program_assignments where program_id=draft.program_id and student_user_id=p_student_id order by created_at desc limit 1; return result; end if;
 select v.* into previous from public.program_assignments a join public.program_versions v on v.id=a.version_id where a.program_id=draft.program_id and a.student_user_id=p_student_id order by v.version_number desc limit 1;
 for entry in select key,value from jsonb_each_text(draft.workspace->'week') loop
  day_name:=(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])[entry.key::int+1]; select x into routine from jsonb_array_elements(draft.workspace->'routines') x where x->>'id'=entry.value;
  if day_name is null or routine is null or jsonb_array_length(routine->'ex')=0 then continue; end if;
  weekly:=weekly||jsonb_build_object(day_name,(select jsonb_agg((x-'id'-'weight')||jsonb_build_object('exerciseId',x->>'id','sets',coalesce(x->'sets','1'::jsonb),'reps',coalesce(x->'reps','1'::jsonb),'load',coalesce(x->'weight','0'::jsonb))) from jsonb_array_elements(routine->'ex') x)); titles:=titles||jsonb_build_object(day_name,routine->>'name');
 end loop;
 perform public.update_program_metadata(draft.program_id,draft.title,null,null); version:=public.publish_program_version_with_titles(draft.program_id,weekly,titles); result:=public.assign_program_version(draft.program_id,version.id,p_student_id);
 select coalesce(jsonb_agg(key),'[]'::jsonb) into days from (select key from jsonb_each(weekly) where weekly->key is distinct from coalesce(previous.weekly_plan,'{}'::jsonb)->key union select key from jsonb_each(coalesce(previous.weekly_plan,'{}'::jsonb)) where coalesce(previous.weekly_plan,'{}'::jsonb)->key is distinct from weekly->key) changed;
 insert into public.professional_plan_update_events(student_user_id,professional_user_id,program_id,previous_version_id,new_version_id,affected_days) values(p_student_id,auth.uid(),draft.program_id,previous.id,version.id,days) on conflict(student_user_id,program_id,new_version_id) do nothing;
 if previous.id is null then insert into public.professional_plan_update_views(student_user_id,program_id,seen_version_id) values(p_student_id,draft.program_id,version.id) on conflict(student_user_id,program_id) do nothing; end if;
 update public.professional_plan_drafts set sent_revision=revision where professional_id=auth.uid() and student_id=p_student_id;
 return result;
end $$;


drop function public.library_apply_professional_assignment(uuid,uuid,uuid);
