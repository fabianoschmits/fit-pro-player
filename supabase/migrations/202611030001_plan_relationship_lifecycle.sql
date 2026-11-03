-- Historical cycles and server-authoritative relationship consent/fallback.
begin;

-- Pair FKs depended on historical uniqueness. Participants retain their auth.users FKs;
-- assignments and drafts now reference the exact cycle, including its participants.
do $$ declare c record; begin
 for c in select conrelid::regclass as table_name, conname from pg_constraint
 where confrelid='public.professional_student_relationships'::regclass and contype='f' and cardinality(confkey)=2 loop
  execute format('alter table %s drop constraint %I',c.table_name,c.conname);
 end loop;
end $$;
alter table public.professional_student_relationships drop constraint professional_student_relationships_pair_key;
alter table public.professional_student_relationships add column revoked_by uuid references auth.users(id) on delete set null;
alter table public.professional_student_relationships add constraint relationships_cycle_participants_key unique(id,professional_user_id,student_user_id);
create unique index relationships_one_current_pair_idx on public.professional_student_relationships(professional_user_id,student_user_id) where status in ('pending','active');

alter table public.program_assignments add column relationship_id uuid;
update public.program_assignments a set relationship_id=r.id from public.professional_student_relationships r
 where r.professional_user_id=a.professional_user_id and r.student_user_id=a.student_user_id;
-- The previous pair FK guaranteed one unambiguous cycle for every existing assignment.
-- Drain deferred constraint triggers before changing a populated table's definition.
set constraints all immediate;
alter table public.program_assignments alter column relationship_id set not null;
alter table public.program_assignments add constraint assignments_cycle_fkey foreign key(relationship_id,professional_user_id,student_user_id)
 references public.professional_student_relationships(id,professional_user_id,student_user_id) on delete restrict;
create index assignments_cycle_idx on public.program_assignments(relationship_id,status);

create function public.bind_assignment_cycle() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.relationship_id is null then
  select id into new.relationship_id from public.professional_student_relationships
  where professional_user_id=new.professional_user_id and student_user_id=new.student_user_id
   and (new.status='revoked' or status='active') order by created_at desc,id limit 1;
  if new.relationship_id is null then
   if new.status='active' then raise exception 'active assignment requires active relationship' using errcode='23514'; end if;
   raise exception 'assignment relationship required' using errcode='23503';
  end if;
 end if;
 return new;
end $$;
revoke all on function public.bind_assignment_cycle() from public,anon,authenticated;
create trigger assignments_bind_cycle before insert on public.program_assignments for each row execute function public.bind_assignment_cycle();

alter table public.professional_plan_drafts add column relationship_id uuid;
update public.professional_plan_drafts d set relationship_id=r.id from public.professional_student_relationships r
 where r.professional_user_id=d.professional_id and r.student_user_id=d.student_id;
set constraints all immediate;
alter table public.professional_plan_drafts alter column relationship_id set not null;
alter table public.professional_plan_drafts drop constraint professional_plan_drafts_pkey;
alter table public.professional_plan_drafts add primary key(professional_id,student_id,relationship_id);
alter table public.professional_plan_drafts add constraint drafts_cycle_fkey foreign key(relationship_id,professional_id,student_id)
 references public.professional_student_relationships(id,professional_user_id,student_user_id) on delete restrict;
drop policy draft_owner_read on public.professional_plan_drafts;
create policy draft_owner_read on public.professional_plan_drafts for select to authenticated using(professional_id=auth.uid() and exists(
 select 1 from public.professional_student_relationships r where r.id=relationship_id and r.status='active'));

create or replace function public.check_active_assignment_prescription() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' and (new.relationship_id is distinct from old.relationship_id or new.professional_user_id<>old.professional_user_id or new.student_user_id<>old.student_user_id or new.version_id<>old.version_id or new.program_id<>old.program_id) then
  raise exception 'assignment cycle and prescription are immutable' using errcode='23514';
 end if;
 if new.status='active' then
  if tg_op='UPDATE' and old.status='revoked' then raise exception 'revoked assignment is historical' using errcode='23514'; end if;
  perform pg_advisory_xact_lock(hashtextextended('fitpp.student:'||new.student_user_id::text,0));
  if new.relationship_id is null then
   select id into new.relationship_id from public.professional_student_relationships where professional_user_id=new.professional_user_id and student_user_id=new.student_user_id and status='active';
  end if;
  perform 1 from public.professional_student_relationships where id=new.relationship_id and professional_user_id=new.professional_user_id and student_user_id=new.student_user_id and status='active' for share;
  if not found or not exists(select 1 from public.programs p join public.program_versions v on v.program_id=p.id where p.id=new.program_id and p.professional_user_id=new.professional_user_id and not p.archived and v.id=new.version_id and v.published_at is not null) then
   raise exception 'active assignment requires its active cycle and published owned version' using errcode='23514';
  end if;
 end if;
 return new;
end $$;

-- This private helper operates only after a validated cycle transition. It updates the
-- existing workspace and selection, never JWT impersonation or a parallel plan system.
create function public.restore_personal_plan_for(p_student uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare personal public.athlete_plan_library; routines jsonb; week jsonb; days jsonb; snapshot jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('fitpp.library:'||p_student::text,0));
 select * into personal from public.athlete_plan_library where user_id=p_student and source_type='self' order by updated_at desc,created_at desc,id limit 1 for update;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'prescription',prescription) order by position),'[]'::jsonb) into routines
 from public.athlete_routines where user_id=p_student and prescription->>'assigned' is distinct from 'true';
 select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb) into week from jsonb_each(coalesce(personal.personal_plan->'schedule'->'week','{}'::jsonb)) e
 where exists(select 1 from jsonb_array_elements(routines) r where r->>'id'=e.value#>>'{}');
 select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb) into days from jsonb_each(coalesce(personal.personal_plan->'schedule'->'dayPlan','{}'::jsonb)) e
 where e.value in ('null'::jsonb,'"rest"'::jsonb) or exists(select 1 from jsonb_array_elements(routines) r where r->>'id'=e.value#>>'{}');
 snapshot:=jsonb_build_object('mode',coalesce(personal.personal_plan->>'mode','weekly'),'schedule',jsonb_build_object('week',week,'dayPlan',days),'routines',routines);
 if personal.id is null then
  insert into public.athlete_plan_library(user_id,source_type,title,personal_plan) values(p_student,'self','Meu plano',snapshot) returning * into personal;
 else update public.athlete_plan_library set personal_plan=snapshot,updated_at=clock_timestamp() where id=personal.id;
 end if;
 -- Only operational prescription copies are removed; executions keep their snapshots/FKs.
 delete from public.athlete_routines where user_id=p_student and prescription->>'assigned'='true';
 insert into public.athlete_schedules(user_id,mode,schedule) values(p_student,snapshot->>'mode',(snapshot->'schedule')||jsonb_build_object('libraryId',personal.id,'libraryTitle',personal.title))
 on conflict(user_id) do update set mode=excluded.mode,schedule=excluded.schedule,revision=public.athlete_schedules.revision+1,updated_at=clock_timestamp();
 insert into public.athlete_plan_selection(user_id,plan_id) values(p_student,personal.id) on conflict(user_id) do update set plan_id=excluded.plan_id;
end $$;
revoke all on function public.restore_personal_plan_for(uuid) from public,anon,authenticated;

create or replace function public.end_revoked_relationship_assignments() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status='revoked' and old.status is distinct from 'revoked' then
  update public.program_assignments set status='revoked',revoked_at=coalesce(new.revoked_at,now()) where relationship_id=new.id and status='active';
  if exists(select 1 from public.athlete_plan_selection s join public.athlete_plan_library l on l.id=s.plan_id join public.program_assignments a on a.id=l.assignment_id where s.user_id=new.student_user_id and a.relationship_id=new.id) then
   perform public.restore_personal_plan_for(new.student_user_id);
  end if;
 end if;
 return new;
end $$;

create or replace function public.revoke_professional_relationship(p_relationship_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare relation public.professional_student_relationships;
begin
 perform public.assert_account_active();
 select * into relation from public.professional_student_relationships where id=p_relationship_id and auth.uid() in (professional_user_id,student_user_id);
 if not found then raise exception 'relationship not found' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fitpp.student:'||relation.student_user_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended('fitpp.library:'||relation.student_user_id::text,0));
 update public.professional_student_relationships set status='revoked',revoked_at=clock_timestamp(),revoked_by=auth.uid() where id=relation.id and status in ('pending','active');
end $$;

create table public.professional_link_requests (
 id uuid primary key default gen_random_uuid(),
 professional_user_id uuid not null references auth.users(id) on delete cascade,
 student_user_id uuid not null references auth.users(id) on delete cascade,
 source_invite_id uuid references public.professional_invites(id) on delete set null,
 status text not null default 'pending' check(status in ('pending','accepted','rejected','cancelled')),
 created_at timestamptz not null default clock_timestamp(),
 resolved_at timestamptz, resolved_by uuid references auth.users(id) on delete set null,
 relationship_id uuid references public.professional_student_relationships(id) on delete restrict,
 check(professional_user_id<>student_user_id),
 check((status='pending' and resolved_at is null and relationship_id is null) or (status<>'pending' and resolved_at is not null)),
 check((status='accepted')=(relationship_id is not null))
);
create unique index link_requests_one_pending_pair_idx on public.professional_link_requests(professional_user_id,student_user_id) where status='pending';
create index link_requests_professional_pending_idx on public.professional_link_requests(professional_user_id,created_at desc) where status='pending';
alter table public.professional_link_requests enable row level security;
revoke all on public.professional_link_requests from public,anon,authenticated;
grant select on public.professional_link_requests to authenticated;
create policy link_requests_participant_read on public.professional_link_requests for select to authenticated using(auth.uid() in (professional_user_id,student_user_id));
do $$ begin
 if to_regprocedure('public.account_is_active()') is not null then
  create policy active_account_required on public.professional_link_requests as restrictive for all to authenticated using((select public.account_is_active())) with check((select public.account_is_active()));
 end if;
end $$;

create function public.request_professional_link(p_code text) returns public.professional_link_requests
language plpgsql security definer set search_path=public,pg_temp as $$
declare invite public.professional_invites; result public.professional_link_requests;
begin
 perform public.assert_account_active();
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 select * into invite from public.professional_invites where code=upper(btrim(p_code)) and status='pending' and (expires_at is null or expires_at>now());
 if not found or invite.professional_user_id=auth.uid() then raise exception 'invalid invite' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fitpp.student:'||auth.uid()::text,0));
 if exists(select 1 from public.professional_student_relationships where professional_user_id=invite.professional_user_id and student_user_id=auth.uid() and status in ('active','pending')) then raise exception 'relationship already current' using errcode='22023'; end if;
 insert into public.professional_link_requests(professional_user_id,student_user_id,source_invite_id) values(invite.professional_user_id,auth.uid(),invite.id)
 on conflict(professional_user_id,student_user_id) where status='pending' do update set source_invite_id=public.professional_link_requests.source_invite_id returning * into result;
 return result;
end $$;

create function public.accept_professional_link_request(p_request_id uuid) returns public.professional_student_relationships
language plpgsql security definer set search_path=public,pg_temp as $$
declare request public.professional_link_requests; result public.professional_student_relationships;
begin
 perform public.assert_account_active();
 select * into request from public.professional_link_requests where id=p_request_id and professional_user_id=auth.uid();
 if not found or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then raise exception 'request recipient required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fitpp.student:'||request.student_user_id::text,0));
 select * into request from public.professional_link_requests where id=p_request_id for update;
 if request.status='accepted' then select * into result from public.professional_student_relationships where id=request.relationship_id; return result; end if;
 if request.status<>'pending' then raise exception 'request already resolved' using errcode='22023'; end if;
 if exists(select 1 from public.professional_student_relationships where professional_user_id=auth.uid() and student_user_id=request.student_user_id and status in ('active','pending')) then raise exception 'relationship already current' using errcode='22023'; end if;
 insert into public.professional_student_relationships(professional_user_id,student_user_id,status,accepted_at) values(auth.uid(),request.student_user_id,'active',clock_timestamp()) returning * into result;
 update public.professional_link_requests set status='accepted',resolved_at=clock_timestamp(),resolved_by=auth.uid(),relationship_id=result.id where id=request.id;
 return result;
end $$;

create function public.reject_professional_link_request(p_request_id uuid) returns public.professional_link_requests
language plpgsql security definer set search_path=public,pg_temp as $$
declare request public.professional_link_requests;
begin
 perform public.assert_account_active();
 select * into request from public.professional_link_requests where id=p_request_id and professional_user_id=auth.uid();
 if not found or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then raise exception 'request recipient required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fitpp.student:'||request.student_user_id::text,0));
 select * into request from public.professional_link_requests where id=p_request_id for update;
 if request.status='rejected' then return request; end if;
 if request.status<>'pending' then raise exception 'request already resolved' using errcode='22023'; end if;
 update public.professional_link_requests set status='rejected',resolved_at=clock_timestamp(),resolved_by=auth.uid() where id=request.id returning * into request;
 return request;
end $$;

-- Before consent, expose only public identity, never training/body/profile preferences.
create function public.professional_link_request_detail(p_request_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 perform public.assert_account_active();
 select to_jsonb(r)||jsonb_build_object('display_name',coalesce(p.display_name,'Aluno'),'avatar_ref',p.avatar_ref)
 into result from public.professional_link_requests r left join public.profiles p on p.id=r.student_user_id
 where r.id=p_request_id and r.professional_user_id=auth.uid();
 if result is null then raise exception 'request recipient required' using errcode='42501'; end if;
 return result;
end $$;

create function public.professional_link_requests_page() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 perform public.assert_account_active();
 if not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then raise exception 'professional capability required' using errcode='42501'; end if;
 select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('display_name',coalesce(p.display_name,'Aluno'),'avatar_ref',p.avatar_ref) order by r.created_at,r.id),'[]'::jsonb),'total',count(*)) into result
 from public.professional_link_requests r left join public.profiles p on p.id=r.student_user_id where r.professional_user_id=auth.uid() and r.status='pending';
 return result;
end $$;

create function public.student_link_requests() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 perform public.assert_account_active();
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('professional_name',pp.professional_name) order by r.created_at desc),'[]'::jsonb) into result
 from public.professional_link_requests r left join public.professional_profiles pp on pp.user_id=r.professional_user_id where r.student_user_id=auth.uid();
 return result;
end $$;

create function public.professional_relationship_cycles(p_student_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 perform public.assert_account_active();
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id),'[]'::jsonb) into result from public.professional_student_relationships r where r.professional_user_id=auth.uid() and r.student_user_id=p_student_id;
 return result;
end $$;

alter table public.professional_student_relationships add column closed_profile jsonb, add column closed_body jsonb;
create function public.capture_closed_relationship_profile() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status='revoked' and old.status<>'revoked' then
  new.revoked_at:=coalesce(new.revoked_at,clock_timestamp());
  new.revoked_by:=coalesce(new.revoked_by,auth.uid());
  select jsonb_build_object('birthDate',source->'birthDate','sex',source->'sex','heightCm',source->'heightCm','startWeight',source->'startWeight','goal',source->'goal','experience',source->'experience') into new.closed_profile
  from (select coalesce((select preferences->'profile' from public.account_preferences where user_id=new.student_user_id),(select payload->'profile' from public.account_snapshots where user_id=new.student_user_id),'{}'::jsonb) source) s;
  -- Body writers replace rows, so created_at cannot delimit a historical cycle.
  -- Freeze exactly what the professional can read now, including legacy accounts.
  select jsonb_build_object(
   'weights',coalesce((select jsonb_agg(to_jsonb(w) order by w.measured_on,w.id) from public.bodyweight_entries w where w.user_id=new.student_user_id),
    (select jsonb_agg(jsonb_build_object('id','legacy-weight-'||e.ordinality,'measured_on',e.item->>'d','weight_kg',e.item->'w') order by e.ordinality) from public.account_snapshots a cross join lateral jsonb_array_elements(case when jsonb_typeof(a.payload->'bodyweight')='array' then a.payload->'bodyweight' else '[]'::jsonb end) with ordinality e(item,ordinality) where a.user_id=new.student_user_id),'[]'::jsonb),
   'measurements',coalesce((select jsonb_agg(to_jsonb(m) order by m.measured_on,m.id) from public.body_measurement_checkins m where m.user_id=new.student_user_id),
    (select jsonb_agg(jsonb_build_object('id','legacy-measurement-'||e.ordinality,'measured_on',e.item->>'date','measurements_cm',e.item->'values','note',e.item->>'notes') order by e.ordinality) from public.account_snapshots a cross join lateral jsonb_array_elements(case when jsonb_typeof(a.payload->'bodyMeasurements')='array' then a.payload->'bodyMeasurements' else '[]'::jsonb end) with ordinality e(item,ordinality) where a.user_id=new.student_user_id),'[]'::jsonb)) into new.closed_body;
 end if;
 return new;
end $$;
revoke all on function public.capture_closed_relationship_profile() from public,anon,authenticated;
create trigger relationships_capture_close before update of status on public.professional_student_relationships for each row execute function public.capture_closed_relationship_profile();

create function public.professional_historical_student_detail(p_student_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare relation public.professional_student_relationships; result jsonb;
begin
 perform public.assert_account_active();
 if not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then raise exception 'professional capability required' using errcode='42501'; end if;
 select * into relation from public.professional_student_relationships where professional_user_id=auth.uid() and student_user_id=p_student_id order by created_at desc,id limit 1;
 if not found then raise exception 'historical relationship required' using errcode='42501'; end if;
 select jsonb_build_object('student_user_id',p_student_id,'display_name',coalesce(p.display_name,'Aluno'),'avatar_ref',p.avatar_ref,'relationship_created_at',relation.created_at,
  'profile',coalesce(relation.closed_profile,'{}'::jsonb),
  'weight_history',coalesce(relation.closed_body->'weights','[]'::jsonb),
  'measurements',coalesce(relation.closed_body->'measurements','[]'::jsonb),
  'assignments',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('program_title',pr.title,'version_number',v.version_number) order by a.created_at desc) from public.program_assignments a join public.programs pr on pr.id=a.program_id join public.program_versions v on v.id=a.version_id where a.professional_user_id=auth.uid() and a.student_user_id=p_student_id),'[]'::jsonb),
  'notes',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'body',n.body,'created_at',n.created_at) order by n.created_at desc) from public.professional_student_note_entries n where n.professional_id=auth.uid() and n.student_id=p_student_id),'[]'::jsonb))
 into result from public.profiles p where p.id=p_student_id;
 return result;
end $$;
revoke all on function public.professional_historical_student_detail(uuid) from public,anon,authenticated;
grant execute on function public.professional_historical_student_detail(uuid) to authenticated;

-- Legacy direct acceptance is allowed only for an explicitly generated invitation.
-- Public reusable personal codes and pairs with a student request cannot bypass consent.
create or replace function public.accept_professional_invite(p_code text) returns public.professional_student_relationships
language plpgsql security definer set search_path=public,pg_temp as $$
declare invite public.professional_invites; result public.professional_student_relationships;
begin
 perform public.assert_account_active();
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fitpp.student:'||auth.uid()::text,0));
 select * into invite from public.professional_invites where code=upper(btrim(p_code)) and status='pending' and (expires_at is null or expires_at>now()) for update;
 if not found or invite.professional_user_id=auth.uid() then raise exception 'invalid invite' using errcode='22023'; end if;
 if invite.is_personal or exists(select 1 from public.professional_link_requests where professional_user_id=invite.professional_user_id and student_user_id=auth.uid()) then raise exception 'professional approval required; request a link' using errcode='42501'; end if;
 select * into result from public.professional_student_relationships where professional_user_id=invite.professional_user_id and student_user_id=auth.uid() and status='active';
 if found then return result; end if;
 insert into public.professional_student_relationships(professional_user_id,student_user_id,status,accepted_at) values(invite.professional_user_id,auth.uid(),'active',clock_timestamp()) returning * into result;
 update public.professional_invites set status='active',accepted_at=clock_timestamp(),accepted_by=auth.uid() where id=invite.id;
 return result;
end $$;

revoke all on function public.request_professional_link(text),public.accept_professional_link_request(uuid),public.reject_professional_link_request(uuid),public.professional_link_request_detail(uuid),public.professional_link_requests_page(),public.student_link_requests(),public.professional_relationship_cycles(uuid) from public,anon,authenticated;
grant execute on function public.request_professional_link(text),public.accept_professional_link_request(uuid),public.reject_professional_link_request(uuid),public.professional_link_request_detail(uuid),public.professional_link_requests_page(),public.student_link_requests(),public.professional_relationship_cycles(uuid) to authenticated;


-- Extend existing operations with exact-cycle validation and consistent lock order.

create or replace function public.apply_library_plan(p_plan_id uuid,p_expected_revision bigint) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare selected public.athlete_plan_library; old_id uuid; a public.program_assignments; v public.program_versions;
 snapshot jsonb; routines jsonb:='[]'; week jsonb:='{}'; entry record; rid uuid; rev bigint; result jsonb; number_day integer;
begin
 perform public.assert_account_active();
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 if p_expected_revision is null or p_expected_revision<0 then raise exception 'invalid revision' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fitpp.student:'||auth.uid()::text,0));
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
 perform 1 from public.professional_student_relationships where id=a.relationship_id and professional_user_id=a.professional_user_id and student_user_id=auth.uid() and status='active' for share;
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

create or replace function public.athlete_plan_library_page(p_offset integer default 0,p_limit integer default 30) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 perform public.assert_account_active();
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 with ranked as (
  select l.*,a.professional_user_id,a.program_id,a.relationship_id,a.status,v.version_number,to_jsonb(v) version,pp.professional_name,row_number() over(partition by coalesce(a.program_id,l.id) order by v.version_number desc nulls last,l.created_at desc,l.id) rank
  from public.athlete_plan_library l left join public.program_assignments a on a.id=l.assignment_id left join public.program_versions v on v.id=a.version_id left join public.professional_profiles pp on pp.user_id=a.professional_user_id where l.user_id=auth.uid() and (l.source_type='self' or (exists(select 1 from public.professional_student_relationships cycle where cycle.id=a.relationship_id and cycle.status='active') and (a.status='active' or l.id=(select plan_id from public.athlete_plan_selection where user_id=auth.uid()))))
 ), latest as (select * from ranked where rank=1 or id=(select plan_id from public.athlete_plan_selection where user_id=auth.uid())), page as (select * from latest order by created_at desc,id offset greatest(0,p_offset) limit least(50,greatest(1,p_limit)))
 select jsonb_build_object('selectedId',(select plan_id from public.athlete_plan_selection where user_id=auth.uid()),'total',(select count(*) from latest),'items',coalesce((select jsonb_agg(
 (to_jsonb(p)-'rank'-'status'-'professional_user_id'-'version_number') || jsonb_build_object('professional_id',p.professional_user_id,'available',p.assignment_id is null or (p.status='active' and exists(select 1 from public.professional_student_relationships r where r.id=p.relationship_id and r.professional_user_id=p.professional_user_id and r.student_user_id=auth.uid() and r.status='active')),'workout_updates',coalesce(changes.pending,'{}'::jsonb),'workout_update_bases',coalesce(changes.bases,'{}'::jsonb),'plan_update',case when changes.changed is null then null else jsonb_build_object('is_first',global_base.id is null,'previous_version',global_base.version,'next_version',p.version,'affected_days',changes.changed) end)
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

create or replace function public.assign_program_version(p_program_id uuid,p_version_id uuid,p_student_user_id uuid) returns public.program_assignments
language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.program_assignments;
begin
 perform public.assert_account_active();
 perform pg_advisory_xact_lock(hashtextextended('fitpp.student:'||p_student_user_id::text,0));
 if not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then raise exception 'professional capability required' using errcode='42501'; end if;
 perform 1 from public.professional_student_relationships where professional_user_id=auth.uid() and student_user_id=p_student_user_id and status='active' for share;
 if not found then raise exception 'active student relationship required' using errcode='42501'; end if;
 perform 1 from public.programs p join public.program_versions v on v.program_id=p.id where p.id=p_program_id and v.id=p_version_id and p.professional_user_id=auth.uid() and not p.archived and v.published_at is not null for share of p;
 if not found then raise exception 'program ownership required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fitpp.student:'||p_student_user_id::text,0));
 select * into result from public.program_assignments where student_user_id=p_student_user_id and version_id=p_version_id and status='active' and exists(select 1 from public.professional_student_relationships r where r.id=relationship_id and r.status='active');
 if found then return result; end if;
 insert into public.program_assignments(program_id,version_id,professional_user_id,student_user_id) values(p_program_id,p_version_id,auth.uid(),p_student_user_id) returning * into result;
 return result;
end $$;

create or replace function public.save_student_plan_draft(p_student_id uuid,p_title text,p_workspace jsonb,p_expected_revision bigint default 0) returns public.professional_plan_drafts
language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.professional_plan_drafts; program public.programs; cycle uuid;
begin
 perform public.assert_account_active();
 perform pg_advisory_xact_lock(hashtextextended('fitpp.student:'||p_student_id::text,0));
 if p_expected_revision is null or p_expected_revision<0 then raise exception 'invalid revision' using errcode='22023'; end if;
 if not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then raise exception 'professional capability required' using errcode='42501'; end if;
 select id into cycle from public.professional_student_relationships where professional_user_id=auth.uid() and student_user_id=p_student_id and status='active' for share;
 if not found then raise exception 'active student relationship required' using errcode='42501'; end if;
 perform public.validate_professional_json(p_workspace,262144);
 if jsonb_typeof(p_workspace->'routines') is distinct from 'array' or jsonb_typeof(p_workspace->'week') is distinct from 'object' then raise exception 'invalid workspace' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fitpp.draft:'||auth.uid()::text||p_student_id::text,0));
 select * into result from public.professional_plan_drafts where professional_id=auth.uid() and student_id=p_student_id and relationship_id=cycle for update;
 if coalesce(result.revision,0)<>p_expected_revision then raise exception 'draft revision conflict' using errcode='40001'; end if;
 if result.program_id is null then
 program:=public.create_program(p_title,null);
 insert into public.professional_plan_drafts(professional_id,student_id,relationship_id,program_id,title,workspace) values(auth.uid(),p_student_id,cycle,program.id,p_title,p_workspace) returning * into result;
 else
 update public.professional_plan_drafts set title=p_title,workspace=p_workspace,revision=revision+1,updated_at=now() where professional_id=auth.uid() and student_id=p_student_id and relationship_id=cycle returning * into result;
 end if;
 return result;
end $$;

create or replace function public.send_student_plan(p_student_id uuid,p_expected_revision bigint) returns public.program_assignments
language plpgsql security definer set search_path=public,pg_temp as $$
declare draft public.professional_plan_drafts; version public.program_versions; previous public.program_versions; result public.program_assignments; weekly jsonb:='{}'; titles jsonb:='{}'; entry record; routine jsonb; day_name text; days jsonb; cycle uuid;
begin
 perform public.assert_account_active();
 perform pg_advisory_xact_lock(hashtextextended('fitpp.student:'||p_student_id::text,0));
 if p_expected_revision is null or p_expected_revision<0 then raise exception 'invalid revision' using errcode='22023'; end if;
 if not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then raise exception 'professional capability required' using errcode='42501'; end if;
 select id into cycle from public.professional_student_relationships where professional_user_id=auth.uid() and student_user_id=p_student_id and status='active' for share;
 if not found then raise exception 'active student relationship required' using errcode='42501'; end if;
 select * into draft from public.professional_plan_drafts where professional_id=auth.uid() and student_id=p_student_id and relationship_id=cycle for update;
 if not found then raise exception 'draft ownership required' using errcode='42501'; end if;
 if draft.revision<>p_expected_revision then raise exception 'draft revision conflict' using errcode='40001'; end if;
 if draft.sent_revision=draft.revision then select * into result from public.program_assignments where program_id=draft.program_id and student_user_id=p_student_id and relationship_id=cycle order by created_at desc limit 1; return result; end if;
 select v.* into previous from public.program_assignments a join public.program_versions v on v.id=a.version_id where a.program_id=draft.program_id and a.student_user_id=p_student_id and relationship_id=cycle order by v.version_number desc limit 1;
 for entry in select key,value from jsonb_each_text(draft.workspace->'week') loop
  day_name:=(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])[entry.key::int+1]; select x into routine from jsonb_array_elements(draft.workspace->'routines') x where x->>'id'=entry.value;
  if day_name is null or routine is null or jsonb_array_length(routine->'ex')=0 then continue; end if;
  weekly:=weekly||jsonb_build_object(day_name,(select jsonb_agg((x-'id'-'weight')||jsonb_build_object('exerciseId',x->>'id','sets',coalesce(x->'sets','1'::jsonb),'reps',coalesce(x->'reps','1'::jsonb),'load',coalesce(x->'weight','0'::jsonb))) from jsonb_array_elements(routine->'ex') x)); titles:=titles||jsonb_build_object(day_name,routine->>'name');
 end loop;
 perform public.update_program_metadata(draft.program_id,draft.title,null,null); version:=public.publish_program_version_with_titles(draft.program_id,weekly,titles); result:=public.assign_program_version(draft.program_id,version.id,p_student_id);
 select coalesce(jsonb_agg(key),'[]'::jsonb) into days from (select key from jsonb_each(weekly) where weekly->key is distinct from coalesce(previous.weekly_plan,'{}'::jsonb)->key union select key from jsonb_each(coalesce(previous.weekly_plan,'{}'::jsonb)) where coalesce(previous.weekly_plan,'{}'::jsonb)->key is distinct from weekly->key) changed;
 insert into public.professional_plan_update_events(student_user_id,professional_user_id,program_id,previous_version_id,new_version_id,affected_days) values(p_student_id,auth.uid(),draft.program_id,previous.id,version.id,days) on conflict(student_user_id,program_id,new_version_id) do nothing;
 if previous.id is null then insert into public.professional_plan_update_views(student_user_id,program_id,seen_version_id) values(p_student_id,draft.program_id,version.id) on conflict(student_user_id,program_id) do nothing; end if;
 update public.professional_plan_drafts set sent_revision=revision where professional_id=auth.uid() and student_id=p_student_id and relationship_id=cycle;
 return result;
end $$;

create or replace function public.professional_students_page(p_search text default '',p_status text default 'all',p_offset int default 0,p_limit int default 30)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare result jsonb;
begin
 perform public.assert_account_active();
  if auth.uid() is null or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then
    raise exception 'professional capability required' using errcode='42501';
  end if;
  if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100
    or p_status is null or p_status not in ('all','active','inactive','with_program','without_program','attention') then
    raise exception 'invalid page parameters' using errcode='22023';
  end if;
  if p_status='inactive' then
   with past as materialized (
    select distinct on (r.student_user_id) r.student_user_id,coalesce(p.display_name,'Aluno') display_name,p.avatar_ref,r.created_at relationship_created_at,r.revoked_at,
      null::jsonb current_program,'[]'::jsonb attention_reasons,'revoked' relationship_status
    from public.professional_student_relationships r left join public.profiles p on p.id=r.student_user_id
    where r.professional_user_id=auth.uid() and r.status='revoked'
      and not exists(select 1 from public.professional_student_relationships active where active.professional_user_id=auth.uid() and active.student_user_id=r.student_user_id and active.status='active')
      and strpos(lower(coalesce(p.display_name,'')),lower(btrim(coalesce(p_search,''))))>0
    order by r.student_user_id,r.revoked_at desc nulls last,r.created_at desc
   ), page as (select * from past order by revoked_at desc nulls last,student_user_id offset p_offset limit p_limit)
   select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p.revoked_at desc nulls last,p.student_user_id) from page p),'[]'::jsonb),'total',(select count(*) from past),'offset',p_offset,'has_more',(select count(*) from past)>p_offset::bigint+p_limit) into result;
   return result;
  end if;
  with filtered as materialized (
    select s.* from public.professional_workspace_students() s
    where strpos(lower(s.display_name),lower(btrim(coalesce(p_search,''))))>0
      and (p_status in ('all','active') or (p_status='with_program' and s.active_assignment_id is not null)
        or (p_status='without_program' and s.active_assignment_id is null)
        or (p_status='attention' and jsonb_array_length(s.attention_reasons)>0))
  ), page as (
    select * from filtered order by relationship_created_at desc, student_user_id desc offset p_offset limit p_limit
  )
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p.relationship_created_at desc,p.student_user_id desc) from page p),'[]'::jsonb),
    'total',(select count(*) from filtered),'offset',p_offset,'has_more',(select count(*) from filtered)>p_offset::bigint+p_limit)
  into result;
  return result;
end;
$$;

create function public.professional_historical_executions_page(p_student_id uuid default null,p_search text default '',p_status text default 'all',p_from timestamptz default null,p_to timestamptz default null,p_offset int default 0,p_limit int default 20)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare result jsonb;
begin
 perform public.assert_account_active();
  if auth.uid() is null or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then
    raise exception 'professional capability required' using errcode='42501';
  end if;
  if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100
    or p_status is null or p_status not in ('all','in_progress','completed','abandoned')
    or (p_from is not null and p_to is not null and p_from>=p_to) then
    raise exception 'invalid page parameters' using errcode='22023';
  end if;
  with filtered as materialized (
    select e.*,coalesce(p.display_name,'') as display_name,p.avatar_ref,pr.title as program_title,v.version_number
    from public.workout_executions e join public.program_assignments a on a.id=e.assignment_id
    join public.professional_student_relationships r on r.id=a.relationship_id and r.professional_user_id=a.professional_user_id
      and r.student_user_id=a.student_user_id and r.professional_user_id=auth.uid()
    join public.programs pr on pr.id=a.program_id and pr.professional_user_id=auth.uid()
    join public.program_versions v on v.id=e.version_id and v.program_id=pr.id
    left join public.profiles p on p.id=e.student_user_id
    where a.professional_user_id=auth.uid() and e.student_user_id=a.student_user_id
      and (p_student_id is null or e.student_user_id=p_student_id)
      and (p_status='all' or e.status::text=p_status)
      and (p_from is null or e.started_at>=p_from) and (p_to is null or e.started_at<p_to)
      and strpos(lower(coalesce(p.display_name,'') || ' ' || pr.title || ' ' || e.day_key || ' ' || coalesce(e.prescription_snapshot->>'workoutTitle','')),lower(btrim(coalesce(p_search,''))))>0
  ), page as (
    select * from filtered order by started_at desc,id desc offset p_offset limit p_limit
  )
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p.started_at desc,p.id desc) from page p),'[]'::jsonb),
    'total',(select count(*) from filtered),'offset',p_offset,'has_more',(select count(*) from filtered)>p_offset::bigint+p_limit)
  into result;
  return result;
end;
$$;

create or replace function public.apply_library_plan(p_plan_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare current_revision bigint;
begin
 perform public.assert_account_active();
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fitpp.student:'||auth.uid()::text,0));
 perform pg_advisory_xact_lock(hashtextextended('fitpp.library:'||auth.uid()::text,0));
 select revision into current_revision from public.athlete_schedules where user_id=auth.uid() for update;
 return public.apply_library_plan(p_plan_id,coalesce(current_revision,0));
end $$;
revoke all on function public.professional_historical_executions_page(uuid,text,text,timestamptz,timestamptz,int,int) from public,anon,authenticated;
grant execute on function public.professional_historical_executions_page(uuid,text,text,timestamptz,timestamptz,int,int) to authenticated;

do $$ declare target text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach target in array array['professional_link_requests','professional_student_relationships','athlete_schedules'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=target) then
    execute format('alter publication supabase_realtime add table public.%I',target);
   end if;
  end loop;
 end if;
end $$;
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
    where exists(select 1 from public.professional_student_relationships cycle where cycle.id=a.relationship_id and cycle.status='active') and a.professional_user_id=auth.uid() and (a.status='active' or exists(select 1 from public.program_assignments newer where newer.student_user_id=a.student_user_id and newer.professional_user_id=a.professional_user_id and newer.program_id=a.program_id and newer.status='active'))
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
      case when exists(select 1 from public.professional_plan_drafts d where d.professional_id=auth.uid() and d.student_id=r.student_user_id and d.relationship_id=r.id and d.revision is distinct from d.sent_revision) then 'draft' end,
      case when e.status='abandoned' then 'abandoned' end,
      case when e.status='in_progress' and e.started_at < now()-interval '24 hours' then 'stale_in_progress' end,
      case when a.id is not null and coalesce(e.started_at,a.created_at) <= now()-interval '7 days' then 'inactive_7_days' end
    ],null))
  from public.professional_student_relationships r
  left join public.profiles p on p.id=r.student_user_id
  left join active_assignments a on a.student_user_id=r.student_user_id and a.relationship_id=r.id
  left join public.programs pr on pr.id=a.program_id and pr.professional_user_id=auth.uid()
  left join public.program_versions v on v.id=a.version_id and v.program_id=pr.id
  left join latest e on e.assignment_id=a.id
  where r.professional_user_id=auth.uid() and r.status='active';
$$;
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare caller uuid:=auth.uid(); deleted_student_id uuid;
begin
  perform public.assert_account_active();
  if caller is null then raise exception 'authenticated identity required' using errcode='42501'; end if;
  -- Follow the student-before-program lock order used by assignment and sending.
  for deleted_student_id in
    select student_user_id from public.program_assignments where professional_user_id=caller
    union select student_user_id from public.professional_student_relationships where professional_user_id=caller
    union select student_id from public.professional_plan_drafts where professional_id=caller
    union select student_user_id from public.professional_link_requests where professional_user_id=caller
    union select caller order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended('fitpp.student:'||deleted_student_id::text,0));
  end loop;
  perform 1 from public.programs where professional_user_id=caller order by id for update;
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
  update public.professional_student_relationships set status='revoked',revoked_at=now(),revoked_by=caller where professional_user_id=caller and status='active';
  delete from public.program_assignments where professional_user_id=caller or student_user_id=caller;
  delete from public.professional_link_requests where professional_user_id=caller or student_user_id=caller;
  delete from public.professional_plan_drafts where professional_id=caller or student_id=caller;
  delete from public.professional_plan_update_day_views where student_user_id=caller or program_id in(select id from public.programs where professional_user_id=caller);
  delete from public.professional_plan_update_views where student_user_id=caller or program_id in(select id from public.programs where professional_user_id=caller);
  delete from public.professional_plan_update_events where student_user_id=caller or professional_user_id=caller;
  delete from public.program_versions where program_id in(select id from public.programs where professional_user_id=caller);
  delete from public.programs where professional_user_id=caller;
  delete from auth.users where id=caller;
end $$;
revoke all on function public.delete_my_account() from public,anon;
grant execute on function public.delete_my_account() to authenticated;

notify pgrst,'reload schema';
commit;
