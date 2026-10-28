-- Delivery is availability, never selection. Keep historical prescriptions immutable.
create table public.athlete_plan_library (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 source_type text not null check(source_type in ('self','professional')),
 title text not null check(char_length(btrim(title)) between 1 and 160),
 personal_plan jsonb,
 assignment_id uuid unique references public.program_assignments(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check ((source_type='self' and personal_plan is not null and assignment_id is null) or (source_type='professional' and personal_plan is null and assignment_id is not null)),
 unique(id,user_id)
);
create index athlete_plan_library_owner_idx on public.athlete_plan_library(user_id,created_at desc,id);
create table public.athlete_plan_selection (
 user_id uuid primary key references auth.users(id) on delete cascade,
 plan_id uuid not null,
 foreign key(plan_id,user_id) references public.athlete_plan_library(id,user_id)
);
create table public.professional_plan_drafts (
 professional_id uuid not null references auth.users(id) on delete cascade,
 student_id uuid not null references auth.users(id) on delete cascade,
 program_id uuid not null references public.programs(id),
 title text not null check(char_length(btrim(title)) between 1 and 160),
 workspace jsonb not null default '{"routines":[],"week":{},"dayPlan":{},"planMode":"weekly"}',
 revision bigint not null default 1,
 sent_revision bigint,
 updated_at timestamptz not null default now(),
 primary key(professional_id,student_id),
 foreign key(professional_id,student_id) references public.professional_student_relationships(professional_user_id,student_user_id)
);
alter table public.athlete_plan_library enable row level security;
alter table public.athlete_plan_selection enable row level security;
alter table public.professional_plan_drafts enable row level security;
revoke all on public.athlete_plan_library,public.athlete_plan_selection,public.professional_plan_drafts from public,anon,authenticated;
grant select on public.athlete_plan_library,public.athlete_plan_selection,public.professional_plan_drafts to authenticated;
create policy library_owner_read on public.athlete_plan_library for select to authenticated using(user_id=auth.uid());
create policy selection_owner_read on public.athlete_plan_selection for select to authenticated using(user_id=auth.uid());
create policy draft_owner_read on public.professional_plan_drafts for select to authenticated using(professional_id=auth.uid() and exists(select 1 from public.professional_student_relationships r where r.professional_user_id=auth.uid() and r.student_user_id=student_id and r.status='active'));
-- Multiple available deliveries must coexist, including older selected versions.
drop index public.program_assignments_one_active_student_idx;

create function public.library_capture_personal(p_title text default 'Meu plano') returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; snapshot jsonb;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 select jsonb_build_object('mode',coalesce(s.mode,'weekly'),'schedule',coalesce(s.schedule,'{}'::jsonb),
 'routines',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'prescription',r.prescription) order by r.position) from public.athlete_routines r where r.user_id=auth.uid()),'[]'::jsonb))
 into snapshot from (select 1) seed left join public.athlete_schedules s on s.user_id=auth.uid();
 insert into public.athlete_plan_library(user_id,source_type,title,personal_plan) values(auth.uid(),'self',p_title,snapshot) returning id into result;
 return result;
end $$;

-- Preserve the existing validated writer behind a private boundary.
alter function public.save_athlete_plan(bigint,text,jsonb,jsonb) rename to library_write_execution_plan;
revoke all on function public.library_write_execution_plan(bigint,text,jsonb,jsonb) from public,anon,authenticated;
create function public.save_athlete_plan(p_expected_revision bigint,p_mode text,p_schedule jsonb,p_routines jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare selected public.athlete_plan_library; result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('fitpp.library:'||auth.uid()::text,0));
 select l.* into selected from public.athlete_plan_selection s join public.athlete_plan_library l on l.id=s.plan_id where s.user_id=auth.uid();
 if selected.id is not null and (p_schedule->>'libraryId') is distinct from selected.id::text then raise exception 'plan selection changed' using errcode='42501'; end if;
 if selected.source_type='professional' then raise exception 'professional prescription is read only' using errcode='42501'; end if;
 result:=public.library_write_execution_plan(p_expected_revision,p_mode,p_schedule,p_routines);
 if selected.id is not null then
 update public.athlete_plan_library set personal_plan=jsonb_build_object('mode',p_mode,'schedule',p_schedule,'routines',p_routines),updated_at=now() where id=selected.id;
 end if;
 return result;
end $$;

create function public.athlete_plan_library_page(p_offset integer default 0,p_limit integer default 30) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 return jsonb_build_object('selectedId',(select plan_id from public.athlete_plan_selection where user_id=auth.uid()),
 'items',coalesce((select jsonb_agg(item order by created_at desc,id) from (
 select l.id,l.created_at,to_jsonb(l)||jsonb_build_object('professional_name',pp.professional_name,'professional_id',a.professional_user_id,'program_id',a.program_id,'version',to_jsonb(v),'available',a.id is null or (a.status='active' and exists(select 1 from public.professional_student_relationships r where r.professional_user_id=a.professional_user_id and r.student_user_id=auth.uid() and r.status='active'))) item
 from public.athlete_plan_library l left join public.program_assignments a on a.id=l.assignment_id
 left join public.program_versions v on v.id=a.version_id left join public.professional_profiles pp on pp.user_id=a.professional_user_id
 where l.user_id=auth.uid() order by l.created_at desc,l.id offset greatest(0,p_offset) limit least(50,greatest(1,p_limit))) rows),'[]'::jsonb),
 'total',(select count(*) from public.athlete_plan_library where user_id=auth.uid()));
end $$;

create function public.save_personal_library_plan(p_title text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('fitpp.library:'||auth.uid()::text,0));
 if exists(select 1 from public.athlete_plan_selection s join public.athlete_plan_library l on l.id=s.plan_id where s.user_id=auth.uid() and l.source_type='professional') then raise exception 'cannot copy professional prescription' using errcode='42501'; end if;
 return public.library_capture_personal(p_title);
end $$;

create function public.apply_library_plan(p_plan_id uuid) returns jsonb
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
 snapshot:=jsonb_build_object('mode','weekly','routines',routines,'schedule',jsonb_build_object('week',week,'dayPlan','{}'::jsonb,'assignedProgram',jsonb_build_object('assignmentId',a.id,'programId',a.program_id,'versionId',v.id,'versionNumber',v.version_number)));
 else snapshot:=selected.personal_plan; end if;
 select revision into rev from public.athlete_schedules where user_id=auth.uid() for update;
 result:=public.library_write_execution_plan(coalesce(rev,0),snapshot->>'mode',(snapshot->'schedule')||jsonb_build_object('libraryId',selected.id,'libraryTitle',selected.title),snapshot->'routines');
 insert into public.athlete_plan_selection(user_id,plan_id) values(auth.uid(),selected.id) on conflict(user_id) do update set plan_id=excluded.plan_id;
 return result;
end $$;

-- Retain existing deliveries; backfill does not select any plan.
insert into public.athlete_plan_library(user_id,source_type,title,assignment_id)
 select a.student_user_id,'professional',p.title,a.id from public.program_assignments a join public.programs p on p.id=a.program_id;
create function public.library_receive_delivery() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.athlete_plan_library(user_id,source_type,title,assignment_id) select new.student_user_id,'professional',title,new.id from public.programs where id=new.program_id;
 return new;
end $$;
create trigger library_delivery after insert on public.program_assignments for each row execute function public.library_receive_delivery();

create or replace function public.assign_program_version(p_program_id uuid,p_version_id uuid,p_student_user_id uuid) returns public.program_assignments
language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.program_assignments;
begin
 if not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then raise exception 'professional capability required' using errcode='42501'; end if;
 perform 1 from public.professional_student_relationships where professional_user_id=auth.uid() and student_user_id=p_student_user_id and status='active' for share;
 if not found then raise exception 'active student relationship required' using errcode='42501'; end if;
 perform 1 from public.programs p join public.program_versions v on v.program_id=p.id where p.id=p_program_id and v.id=p_version_id and p.professional_user_id=auth.uid() and not p.archived and v.published_at is not null for share of p;
 if not found then raise exception 'program ownership required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fitpp.student:'||p_student_user_id::text,0));
 select * into result from public.program_assignments where student_user_id=p_student_user_id and version_id=p_version_id and status='active';
 if found then return result; end if;
 insert into public.program_assignments(program_id,version_id,professional_user_id,student_user_id) values(p_program_id,p_version_id,auth.uid(),p_student_user_id) returning * into result;
 return result;
end $$;

create function public.save_student_plan_draft(p_student_id uuid,p_title text,p_workspace jsonb,p_expected_revision bigint default 0) returns public.professional_plan_drafts
language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.professional_plan_drafts; program public.programs;
begin
 if p_expected_revision is null or p_expected_revision<0 then raise exception 'invalid revision' using errcode='22023'; end if;
 if not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then raise exception 'professional capability required' using errcode='42501'; end if;
 perform 1 from public.professional_student_relationships where professional_user_id=auth.uid() and student_user_id=p_student_id and status='active' for share;
 if not found then raise exception 'active student relationship required' using errcode='42501'; end if;
 perform public.validate_professional_json(p_workspace,262144);
 if jsonb_typeof(p_workspace->'routines') is distinct from 'array' or jsonb_typeof(p_workspace->'week') is distinct from 'object' then raise exception 'invalid workspace' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fitpp.draft:'||auth.uid()::text||p_student_id::text,0));
 select * into result from public.professional_plan_drafts where professional_id=auth.uid() and student_id=p_student_id for update;
 if coalesce(result.revision,0)<>p_expected_revision then raise exception 'draft revision conflict' using errcode='40001'; end if;
 if result.program_id is null then
 program:=public.create_program(p_title,null);
 insert into public.professional_plan_drafts(professional_id,student_id,program_id,title,workspace) values(auth.uid(),p_student_id,program.id,p_title,p_workspace) returning * into result;
 else
 update public.professional_plan_drafts set title=p_title,workspace=p_workspace,revision=revision+1,updated_at=now() where professional_id=auth.uid() and student_id=p_student_id returning * into result;
 end if;
 return result;
end $$;

create function public.send_student_plan(p_student_id uuid,p_expected_revision bigint) returns public.program_assignments
language plpgsql security definer set search_path=public,pg_temp as $$
declare draft public.professional_plan_drafts; version public.program_versions; result public.program_assignments; weekly jsonb:='{}'; titles jsonb:='{}'; entry record; routine jsonb; day_name text;
begin
 if p_expected_revision is null or p_expected_revision<0 then raise exception 'invalid revision' using errcode='22023'; end if;
 if not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then raise exception 'professional capability required' using errcode='42501'; end if;
 perform 1 from public.professional_student_relationships where professional_user_id=auth.uid() and student_user_id=p_student_id and status='active' for share;
 if not found then raise exception 'active student relationship required' using errcode='42501'; end if;
 select * into draft from public.professional_plan_drafts where professional_id=auth.uid() and student_id=p_student_id for update;
 if not found then raise exception 'draft ownership required' using errcode='42501'; end if;
 if draft.revision<>p_expected_revision then raise exception 'draft revision conflict' using errcode='40001'; end if;
 if draft.sent_revision=draft.revision then
 select * into result from public.program_assignments where program_id=draft.program_id and student_user_id=p_student_id order by created_at desc limit 1;
 return result;
 end if;
 for entry in select key,value from jsonb_each_text(draft.workspace->'week') loop
 day_name:=(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])[entry.key::int+1];
 select x into routine from jsonb_array_elements(draft.workspace->'routines') x where x->>'id'=entry.value;
 if day_name is null or routine is null or jsonb_array_length(routine->'ex')=0 then continue; end if;
 weekly:=weekly||jsonb_build_object(day_name,(select jsonb_agg((x-'id'-'weight')||jsonb_build_object('exerciseId',x->>'id','sets',coalesce(x->'sets','1'::jsonb),'reps',coalesce(x->'reps','1'::jsonb),'load',coalesce(x->'weight','0'::jsonb))) from jsonb_array_elements(routine->'ex') x));
 titles:=titles||jsonb_build_object(day_name,routine->>'name');
 end loop;
 perform public.update_program_metadata(draft.program_id,draft.title,null,null);
 version:=public.publish_program_version_with_titles(draft.program_id,weekly,titles);
 result:=public.assign_program_version(draft.program_id,version.id,p_student_id);
 update public.professional_plan_drafts set sent_revision=revision where professional_id=auth.uid() and student_id=p_student_id;
 return result;
end $$;

revoke all on function public.library_capture_personal(text),public.library_receive_delivery(),public.save_athlete_plan(bigint,text,jsonb,jsonb),public.athlete_plan_library_page(integer,integer),public.save_personal_library_plan(text),public.apply_library_plan(uuid),public.save_student_plan_draft(uuid,text,jsonb,bigint),public.send_student_plan(uuid,bigint) from public,anon,authenticated;
grant execute on function public.save_athlete_plan(bigint,text,jsonb,jsonb),public.athlete_plan_library_page(integer,integer),public.save_personal_library_plan(text),public.apply_library_plan(uuid),public.save_student_plan_draft(uuid,text,jsonb,bigint),public.send_student_plan(uuid,bigint) to authenticated;

create or replace function public.professional_workspace_students()
returns table (
  student_user_id uuid, display_name text, avatar_ref text, relationship_created_at timestamptz,
  active_assignment_id uuid, program_id uuid, program_title text, version_id uuid, version_number integer,
  last_execution_at timestamptz, last_execution_status public.execution_status,
  current_program jsonb, last_activity_at timestamptz, attention_reasons jsonb
)
language sql security definer set search_path = public, pg_temp
as $$
  with active_assignments as (
    select a.* from public.program_assignments a
    join public.athlete_plan_library l on l.assignment_id=a.id
    join public.athlete_plan_selection selected on selected.plan_id=l.id and selected.user_id=a.student_user_id
    where a.professional_user_id=auth.uid() and a.status='active'
  ), latest as (
    select distinct on (e.assignment_id) e.assignment_id,e.started_at,e.status
    from public.workout_executions e join active_assignments a on a.id=e.assignment_id
    where e.student_user_id=a.student_user_id and e.version_id=a.version_id
    order by e.assignment_id,e.started_at desc,e.id desc
  )
  select r.student_user_id, coalesce(p.display_name,''), p.avatar_ref, r.created_at,
    a.id,a.program_id,pr.title,a.version_id,v.version_number,e.started_at,e.status,
    case when a.id is not null then jsonb_build_object('id',pr.id,'title',pr.title,'assignment_id',a.id,'version_id',v.id,'version_number',v.version_number,'assigned_at',a.created_at) end,
    e.started_at,
    to_jsonb(array_remove(array[
      case when a.id is null then 'without_program' end,
      case when exists(select 1 from public.professional_plan_drafts d where d.professional_id=auth.uid() and d.student_id=r.student_user_id and d.revision is distinct from d.sent_revision) then 'draft' end,
      case when e.status='abandoned' then 'abandoned' end,
      case when e.status='in_progress' and e.started_at < now()-interval '24 hours' then 'stale_in_progress' end,
      case when a.id is not null and coalesce(e.started_at,a.created_at) <= now()-interval '7 days' then 'inactive_7_days' end
    ],null))
  from public.professional_student_relationships r
  left join public.profiles p on p.id=r.student_user_id
  left join active_assignments a on a.student_user_id=r.student_user_id
  left join public.programs pr on pr.id=a.program_id and pr.professional_user_id=auth.uid()
  left join public.program_versions v on v.id=a.version_id and v.program_id=pr.id
  left join latest e on e.assignment_id=a.id
  where r.professional_user_id=auth.uid() and r.status='active';
$$;
revoke all on function public.professional_workspace_students() from public, anon, authenticated;


create function public.store_personal_plan_snapshot(p_title text,p_plan jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 perform public.validate_professional_json(p_plan,262144);
 if p_plan->>'mode' not in ('weekly','daily') or jsonb_typeof(p_plan->'schedule') is distinct from 'object' or jsonb_typeof(p_plan->'routines') is distinct from 'array' then raise exception 'invalid personal plan' using errcode='22023'; end if;
 if jsonb_array_length(p_plan->'routines')>200 or exists(select 1 from jsonb_array_elements(p_plan->'routines') x where coalesce(x->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or char_length(btrim(coalesce(x->>'title',''))) not between 1 and 160 or jsonb_typeof(x->'prescription') is distinct from 'object') then raise exception 'invalid personal routines' using errcode='22023'; end if;
 insert into public.athlete_plan_library(user_id,source_type,title,personal_plan) values(auth.uid(),'self',p_title,p_plan) returning id into result;
 return result;
end $$;
revoke all on function public.store_personal_plan_snapshot(text,jsonb) from public,anon,authenticated;
grant execute on function public.store_personal_plan_snapshot(text,jsonb) to authenticated;

create or replace function public.professional_programs_page(p_search text default '',p_archived bool default null,p_offset int default 0,p_limit int default 20)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then
    raise exception 'professional capability required' using errcode='42501';
  end if;
  if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 then
    raise exception 'invalid page parameters' using errcode='22023';
  end if;
  with owned as materialized (
    select p.* from public.programs p where p.professional_user_id=auth.uid()
      and not exists(select 1 from public.professional_plan_drafts d where d.program_id=p.id)
      and (p_archived is null or p.archived=p_archived)
      and strpos(lower(p.title || ' ' || coalesce(p.objective,'') || ' ' || coalesce(p.description,'')),lower(btrim(coalesce(p_search,''))))>0
  ), latest as (
    select distinct on (v.program_id) v.program_id,v.weekly_plan,max(v.published_at) over (partition by v.program_id) as published_at
    from public.program_versions v join owned p on p.id=v.program_id
    where v.published_at is not null
    order by v.program_id,v.version_number desc,v.id desc
  ), counts as (
    select a.program_id,count(distinct a.student_user_id) as student_count
    from public.program_assignments a join owned p on p.id=a.program_id
    join public.professional_student_relationships r on r.professional_user_id=auth.uid() and r.student_user_id=a.student_user_id and r.status='active'
    where a.professional_user_id=auth.uid() and a.status='active' group by a.program_id
  ), projected as materialized (
    select p.id,p.title,p.description,p.objective,p.archived,
      (select count(*) from jsonb_each(coalesce(v.weekly_plan,'{}'::jsonb)) d where jsonb_typeof(d.value)='array' and jsonb_array_length(d.value)>0) as workout_count,
      coalesce(c.student_count,0) as student_count,greatest(p.updated_at,v.published_at) as last_changed_at
    from owned p left join latest v on v.program_id=p.id left join counts c on c.program_id=p.id
  ), page as (
    select * from projected order by last_changed_at desc,id desc offset p_offset limit p_limit
  )
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p.last_changed_at desc,p.id desc) from page p),'[]'::jsonb),
    'total',(select count(*) from projected),'offset',p_offset,'has_more',(select count(*) from projected)>p_offset::bigint+p_limit)
  into result;
  return result;
end;
$$;


alter table public.notification_events drop constraint notification_events_kind_check;
alter table public.notification_events add constraint notification_events_kind_check check(kind in ('program_received','program_updated','program_removed','relationship_accepted','relationship_ended','student_workout_completed','student_workout_abandoned','verification_changed'));
alter table public.notification_jobs drop constraint notification_jobs_kind_check;
alter table public.notification_jobs add constraint notification_jobs_kind_check check(kind in ('workout_reminder','weight_reminder','measurement_reminder','program_received','program_updated','program_removed','relationship_accepted','relationship_ended','student_workout_completed','student_workout_abandoned','verification_changed'));
create or replace function public.notification_assignment_event() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare relation uuid; event_kind text;
begin
 select id into relation from public.professional_student_relationships where professional_user_id=new.professional_user_id and student_user_id=new.student_user_id and status='active';
 if relation is null then return new; end if;
 if tg_op='INSERT' and new.status='active' then
 event_kind:=case when exists(select 1 from public.program_assignments a where a.student_user_id=new.student_user_id and a.program_id=new.program_id and a.id<>new.id) then 'program_updated' else 'program_received' end;
 perform public.notification_emit_event(new.student_user_id,event_kind||':'||new.id,event_kind,'/#/plan',relation,new.id);
 elsif tg_op='UPDATE' and old.status='active' and new.status='revoked' then
 perform public.notification_emit_event(new.student_user_id,'program_removed:'||new.id,'program_removed','/#/plan',relation,new.id);
 end if;
 return new;
end $$;

create function public.student_professional_cards() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(to_jsonb(person)||jsonb_build_object('received_count',(
 select count(distinct a.program_id) from public.athlete_plan_library l join public.program_assignments a on a.id=l.assignment_id
 where l.user_id=auth.uid() and a.professional_user_id=person.professional_user_id))), '[]'::jsonb)
 from public.student_professional_summaries() person;
$$;
revoke all on function public.student_professional_cards() from public,anon,authenticated;
grant execute on function public.student_professional_cards() to authenticated;

create or replace function public.notification_event_is_current(p_event public.notification_events) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
select p_event.consumed_at is null and p_event.expires_at>now() and (
  p_event.kind in ('relationship_ended','verification_changed')
  or exists(select 1 from public.professional_student_relationships r where r.id=p_event.relationship_id and r.status='active' and p_event.owner_id in (r.professional_user_id,r.student_user_id))
) and (p_event.kind not in ('program_received','program_updated') or exists(select 1 from public.program_assignments a where a.id=p_event.assignment_id and a.status='active'))
$$;

