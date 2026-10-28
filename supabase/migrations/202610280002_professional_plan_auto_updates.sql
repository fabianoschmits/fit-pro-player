-- A published professional version becomes active for its recipient while keeping
-- executions immutable.  Events retain the audit trail; views collapse repeated
-- publications into one comparison from the last version the athlete saw.
create table public.professional_plan_update_events (
 id uuid primary key default gen_random_uuid(),
 student_user_id uuid not null references auth.users(id) on delete cascade,
 professional_user_id uuid not null references auth.users(id) on delete cascade,
 program_id uuid not null references public.programs(id) on delete cascade,
 previous_version_id uuid references public.program_versions(id) on delete restrict,
 new_version_id uuid not null references public.program_versions(id) on delete restrict,
 affected_days jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(),
 unique(student_user_id,program_id,new_version_id)
);
create index professional_plan_update_events_student_idx on public.professional_plan_update_events(student_user_id,program_id,created_at desc);
create table public.professional_plan_update_views (
 student_user_id uuid not null references auth.users(id) on delete cascade,
 program_id uuid not null references public.programs(id) on delete cascade,
 seen_version_id uuid not null references public.program_versions(id) on delete restrict,
 seen_at timestamptz not null default now(),
 primary key(student_user_id,program_id)
);
alter table public.professional_plan_update_events enable row level security;
alter table public.professional_plan_update_views enable row level security;
revoke all on public.professional_plan_update_events,public.professional_plan_update_views from public,anon,authenticated;
grant select on public.professional_plan_update_events,public.professional_plan_update_views to authenticated;
create policy professional_plan_update_events_student_read on public.professional_plan_update_events for select to authenticated using(student_user_id=auth.uid());
create policy professional_plan_update_views_student_read on public.professional_plan_update_views for select to authenticated using(student_user_id=auth.uid());

create function public.library_apply_professional_assignment(p_student_id uuid,p_assignment_id uuid,p_plan_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.program_assignments; v public.program_versions; old_id uuid; rev bigint; entry record; rid uuid;
 routines jsonb:='[]'::jsonb; week jsonb:='{}'::jsonb; next_schedule jsonb; result jsonb; number_day integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('fitpp.library:'||p_student_id::text,0));
 select * into a from public.program_assignments where id=p_assignment_id and student_user_id=p_student_id and status='active' for share;
 if not found then raise exception 'delivery unavailable' using errcode='42501'; end if;
 select * into v from public.program_versions where id=a.version_id;
 select plan_id into old_id from public.athlete_plan_selection where user_id=p_student_id;
 if old_id is null then
   insert into public.athlete_plan_library(user_id,source_type,title,personal_plan)
   select p_student_id,'self','Meu plano',jsonb_build_object('mode',coalesce(s.mode,'weekly'),'schedule',coalesce(s.schedule,'{}'::jsonb),'routines',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'prescription',r.prescription) order by r.position) from public.athlete_routines r where r.user_id=p_student_id),'[]'::jsonb))
   from (select 1) seed left join public.athlete_schedules s on s.user_id=p_student_id;
 end if;
 for entry in select key,value from jsonb_each(v.weekly_plan) loop
   number_day:=array_position(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],entry.key)-1;
   if number_day is null or jsonb_array_length(entry.value)=0 then continue; end if;
   rid:=gen_random_uuid(); week:=week||jsonb_build_object(number_day::text,rid);
   routines:=routines||jsonb_build_array(jsonb_build_object('id',rid,'title',coalesce(v.workout_titles->>entry.key,'Treino'),'prescription',jsonb_build_object('assigned',true,'assignedDayKey',entry.key,'assignmentId',a.id,'programVersionId',v.id,'ex',(select jsonb_agg((x-'exerciseId'-'load')||jsonb_build_object('id',x->>'exerciseId','weight',coalesce(x->'load','0'::jsonb))) from jsonb_array_elements(entry.value) x))));
 end loop;
 routines:=routines||coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'prescription',prescription) order by position) from public.athlete_routines where user_id=p_student_id and prescription->>'assigned' is distinct from 'true'),'[]'::jsonb);
 select revision into rev from public.athlete_schedules where user_id=p_student_id for update;
 next_schedule:=jsonb_build_object('week',week,'dayPlan','{}'::jsonb,'assignedProgram',jsonb_build_object('assignmentId',a.id,'programId',a.program_id,'versionId',v.id,'versionNumber',v.version_number),'libraryId',p_plan_id,'libraryTitle',(select title from public.athlete_plan_library where id=p_plan_id));
 if rev is null then insert into public.athlete_schedules(user_id,mode,schedule) values(p_student_id,'weekly',next_schedule) returning revision into rev;
 else update public.athlete_schedules set revision=revision+1,mode='weekly',schedule=next_schedule,updated_at=now() where user_id=p_student_id; end if;
 delete from public.athlete_routines where user_id=p_student_id and prescription->>'assigned'='true';
 insert into public.athlete_routines(id,user_id,title,position,prescription)
 select (item->>'id')::uuid,p_student_id,item->>'title',ordinality-1,item->'prescription' from jsonb_array_elements(routines) with ordinality values(item,ordinality)
 on conflict(id) do update set title=excluded.title,position=excluded.position,prescription=excluded.prescription,revision=public.athlete_routines.revision+1,updated_at=now() where public.athlete_routines.user_id=p_student_id;
 insert into public.athlete_plan_selection(user_id,plan_id) values(p_student_id,p_plan_id) on conflict(user_id) do update set plan_id=excluded.plan_id;
 select jsonb_build_object('routines',coalesce(jsonb_agg(to_jsonb(r) order by r.position),'[]'::jsonb),'schedule',to_jsonb(s)) into result from public.athlete_schedules s left join public.athlete_routines r on r.user_id=s.user_id where s.user_id=p_student_id group by s.*;
 return result;
end $$;
revoke all on function public.library_apply_professional_assignment(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function public.send_student_plan(p_student_id uuid,p_expected_revision bigint) returns public.program_assignments
language plpgsql security definer set search_path=public,pg_temp as $$
declare draft public.professional_plan_drafts; version public.program_versions; previous public.program_versions; result public.program_assignments; weekly jsonb:='{}'; titles jsonb:='{}'; entry record; routine jsonb; day_name text; plan_id uuid; selected_program uuid; days jsonb;
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
 select id into plan_id from public.athlete_plan_library where assignment_id=result.id;
 select (s.schedule->'assignedProgram'->>'programId')::uuid into selected_program from public.athlete_schedules s where s.user_id=p_student_id;
 select coalesce(jsonb_agg(key),'[]'::jsonb) into days from (select key from jsonb_each(weekly) where weekly->key is distinct from coalesce(previous.weekly_plan,'{}'::jsonb)->key union select key from jsonb_each(coalesce(previous.weekly_plan,'{}'::jsonb)) where coalesce(previous.weekly_plan,'{}'::jsonb)->key is distinct from weekly->key) changed;
 insert into public.professional_plan_update_events(student_user_id,professional_user_id,program_id,previous_version_id,new_version_id,affected_days) values(p_student_id,auth.uid(),draft.program_id,previous.id,version.id,days) on conflict(student_user_id,program_id,new_version_id) do nothing;
 if previous.id is null then insert into public.professional_plan_update_views(student_user_id,program_id,seen_version_id) values(p_student_id,draft.program_id,version.id) on conflict(student_user_id,program_id) do nothing; end if;
 if previous.id is null or selected_program=draft.program_id then perform public.library_apply_professional_assignment(p_student_id,result.id,plan_id); end if;
 update public.professional_plan_drafts set sent_revision=revision where professional_id=auth.uid() and student_id=p_student_id;
 return result;
end $$;

create function public.mark_professional_plan_update_seen(p_plan_id uuid,p_version_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.program_assignments;
begin
 select assignment.* into a from public.athlete_plan_library l join public.program_assignments assignment on assignment.id=l.assignment_id where l.id=p_plan_id and l.user_id=auth.uid();
 if not found or a.version_id<>p_version_id then raise exception 'plan ownership required' using errcode='42501'; end if;
 insert into public.professional_plan_update_views(student_user_id,program_id,seen_version_id) values(auth.uid(),a.program_id,p_version_id) on conflict(student_user_id,program_id) do update set seen_version_id=excluded.seen_version_id,seen_at=now();
end $$;
revoke all on function public.mark_professional_plan_update_seen(uuid,uuid) from public,anon;
grant execute on function public.mark_professional_plan_update_seen(uuid,uuid) to authenticated;

create or replace function public.mark_library_workout_seen(p_plan_id uuid,p_day text,p_change_version_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if public.library_workout_updates(p_plan_id)->>p_day is distinct from p_change_version_id::text then return; end if;
 perform public.mark_professional_plan_update_seen(p_plan_id,p_change_version_id);
end $$;

create or replace function public.athlete_plan_library_page(p_offset integer default 0,p_limit integer default 30) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 with ranked as (
  select l.*,a.professional_user_id,a.program_id,a.status,v.version_number,to_jsonb(v) version,pp.professional_name,
   row_number() over(partition by coalesce(a.program_id,l.id) order by v.version_number desc nulls last,l.created_at desc,l.id) rank
  from public.athlete_plan_library l left join public.program_assignments a on a.id=l.assignment_id
  left join public.program_versions v on v.id=a.version_id left join public.professional_profiles pp on pp.user_id=a.professional_user_id where l.user_id=auth.uid()
 ), latest as (select * from ranked where rank=1), page as (select * from latest order by created_at desc,id offset greatest(0,p_offset) limit least(50,greatest(1,p_limit)))
 select jsonb_build_object('selectedId',(select plan_id from public.athlete_plan_selection where user_id=auth.uid()),'total',(select count(*) from latest),'items',coalesce((select jsonb_agg(
  (to_jsonb(p)-'rank'-'status'-'professional_user_id'-'version_number') || jsonb_build_object(
   'professional_id',p.professional_user_id,
   'available',p.assignment_id is null or (p.status='active' and exists(select 1 from public.professional_student_relationships r where r.professional_user_id=p.professional_user_id and r.student_user_id=auth.uid() and r.status='active')),
   'workout_updates',case when e.previous_version_id is not null and coalesce(view.seen_version_id,'00000000-0000-0000-0000-000000000000'::uuid)<>(p.version->>'id')::uuid then coalesce((select jsonb_object_agg(day,p.version->>'id') from jsonb_array_elements_text(e.affected_days) day),'{}'::jsonb) else '{}'::jsonb end,
   'plan_update',case when e.id is null or view.seen_version_id=(p.version->>'id')::uuid then null else jsonb_build_object('id',e.id,'created_at',e.created_at,'is_first',e.previous_version_id is null and view.seen_version_id is null,'previous_version',case when coalesce(view.seen_version_id,e.previous_version_id) is null then null else (select to_jsonb(v0) from public.program_versions v0 where v0.id=coalesce(view.seen_version_id,e.previous_version_id)) end,'next_version',p.version,'affected_days',e.affected_days) end)
  order by p.created_at desc,p.id) from page p
  left join public.professional_plan_update_events e on e.student_user_id=auth.uid() and e.program_id=p.program_id and e.new_version_id=(p.version->>'id')::uuid
  left join public.professional_plan_update_views view on view.student_user_id=auth.uid() and view.program_id=p.program_id),'[]'::jsonb)) into result;
 return result;
end $$;
