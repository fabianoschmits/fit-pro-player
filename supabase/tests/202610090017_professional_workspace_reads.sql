-- Rollback-only fixtures for the disposable local database harness.
begin;
create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'assertion failed: %', message; end if; end $$;
create function pg_temp.expect_error(command text, expected text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute command; exception when others then get stacked diagnostics actual = returned_sqlstate; end;
  if actual is distinct from expected then raise exception 'expected SQLSTATE %, got % for %', expected, actual, command; end if;
end $$;
insert into auth.users(id) values ('09001700-0000-0000-0000-000000000001'),('09001700-0000-0000-0000-000000000002');
insert into auth.users(id) select md5('workspace-student-' || n)::uuid from generate_series(1,240) n;
insert into public.user_roles(user_id,role) values ('09001700-0000-0000-0000-000000000001','professional'),('09001700-0000-0000-0000-000000000002','professional');
insert into public.profiles(id,display_name,avatar_ref) select md5('workspace-student-' || n)::uuid, 'Student ' || lpad(n::text,3,'0'), null from generate_series(1,240) n
on conflict(id) do update set display_name=excluded.display_name;
insert into public.professional_student_relationships(professional_user_id,student_user_id,status,created_at)
select '09001700-0000-0000-0000-000000000001',md5('workspace-student-' || n)::uuid,'active',now()-interval '30 days' from generate_series(1,240) n;
update public.professional_student_relationships set created_at=now() where student_user_id in (md5('workspace-student-1')::uuid,md5('workspace-student-2')::uuid);
insert into public.programs(id,professional_user_id,title,objective,archived,updated_at) values
 ('09001720-0000-0000-0000-000000000001','09001700-0000-0000-0000-000000000001','In use','Strength',false,'2026-10-01'),
 ('09001720-0000-0000-0000-000000000002','09001700-0000-0000-0000-000000000001','Available',null,false,'2026-10-02'),
 ('09001720-0000-0000-0000-000000000003','09001700-0000-0000-0000-000000000001','Archived',null,true,'2026-10-03'),
 ('09001720-0000-0000-0000-000000000004','09001700-0000-0000-0000-000000000002','Other owner',null,false,'2026-10-04');
insert into public.program_versions(id,program_id,version_number,weekly_plan,workout_titles,published_at) values
 ('09001730-0000-0000-0000-000000000001','09001720-0000-0000-0000-000000000001',1,'{"thursday":[{"exerciseId":"x","sets":3,"reps":8}],"friday":[{"exerciseId":"y","sets":2,"reps":10}]}','{"thursday":"Local Thursday"}','2026-10-08');
insert into public.program_assignments(id,program_id,version_id,professional_user_id,student_user_id,status,created_at)
select md5('workspace-assignment-' || n)::uuid,'09001720-0000-0000-0000-000000000001','09001730-0000-0000-0000-000000000001','09001700-0000-0000-0000-000000000001',md5('workspace-student-' || n)::uuid,'active',now() from generate_series(1,240) n;
insert into public.program_assignments(id,program_id,version_id,professional_user_id,student_user_id,status,created_at,revoked_at) values
 ('09001740-0000-0000-0000-000000000001','09001720-0000-0000-0000-000000000001','09001730-0000-0000-0000-000000000001','09001700-0000-0000-0000-000000000001',md5('workspace-student-1')::uuid,'revoked',now()-interval '10 days',now());
insert into public.workout_executions(id,assignment_id,version_id,student_user_id,day_key,status,started_at,payload,prescription_snapshot)
select md5('workspace-execution-' || n)::uuid,'09001740-0000-0000-0000-000000000001','09001730-0000-0000-0000-000000000001',md5('workspace-student-1')::uuid,'thursday','abandoned',now()-interval '8 days','{"actual":"preserved"}','{"exercises":[{"notes":"full"}]}' from generate_series(1,601) n;
insert into public.workout_executions(id,assignment_id,version_id,student_user_id,day_key,status,started_at,completed_at) values
 ('09001750-0000-0000-0000-000000000001',md5('workspace-assignment-2')::uuid,'09001730-0000-0000-0000-000000000001',md5('workspace-student-2')::uuid,'thursday','completed','2026-10-09 01:00:00+00','2026-10-09 02:00:00+00');
insert into public.professional_invites(professional_user_id,kind,code,token_hash,status,expires_at) values
 ('09001700-0000-0000-0000-000000000001','code','WORKSPACE-VALID','hash-valid','pending',null),
 ('09001700-0000-0000-0000-000000000001','code','WORKSPACE-EXPIRED','hash-expired','pending',now()-interval '1 day');
set local role authenticated;
set local request.jwt.claim.sub='09001700-0000-0000-0000-000000000001';
select pg_temp.assert_true((public.professional_students_page('', 'all', 0, 30)->>'total')::int=240,'counts_beyond_previous_caps: students total 240');
select pg_temp.assert_true(jsonb_array_length(public.professional_students_page('', 'all', 0, 30)->'items')=30,'student page bounded');
select pg_temp.assert_true((public.professional_executions_page(null,'','all',null,null,0,20)->>'total')::int=602,'counts_beyond_previous_caps: executions total 602');
select pg_temp.assert_true((public.professional_executions_page(md5('workspace-student-1')::uuid,'','abandoned',null,null,600,20)->>'total')::int=601,'student/status filter uses exact total');
select pg_temp.assert_true(jsonb_array_length(public.professional_executions_page(md5('workspace-student-1')::uuid,'','abandoned',null,null,600,20)->'items')=1,'last execution page');
select pg_temp.assert_true((public.professional_executions_page(null,'','all',null,null,9999,20)->>'total')::int=602 and not (public.professional_executions_page(null,'','all',null,null,9999,20)->>'has_more')::boolean,'empty offset preserves global total');
select pg_temp.assert_true((select count(distinct item->>'student_user_id')=240 from generate_series(0,2) n cross join lateral jsonb_array_elements(public.professional_students_page('','all',n*100,100)->'items') item),'student date/UUID order has no omission or duplicates');
select pg_temp.assert_true((select count(distinct item->>'id')=602 from generate_series(0,6) n cross join lateral jsonb_array_elements(public.professional_executions_page(null,'','all',null,null,n*100,100)->'items') item),'execution date/UUID ties paginate deterministically');
select pg_temp.assert_true((public.professional_students_page('Student 001','all',0,30)->'items'->0->'attention_reasons')='[]'::jsonb,'attention_uses_current_assignment: old abandoned/inactive history ignored');
select pg_temp.assert_true((public.professional_students_page('Student 001','all',0,30)->'items'->0->'last_activity_at')='null'::jsonb,'current assignment has no fabricated activity');
select pg_temp.assert_true((public.professional_dashboard_summary('2026-10-08','America/Sao_Paulo')->>'today_workouts')::int=240,'timezone_midnight_agenda: Thursday schedule has exact global count');
select pg_temp.assert_true((select item->>'status'='completed' and item->>'workout_title'='Local Thursday' from jsonb_array_elements(public.professional_dashboard_summary('2026-10-08','America/Sao_Paulo')->'today') item where item->>'student_user_id'=md5('workspace-student-2')::uuid::text),'timezone_midnight_agenda: 01:00 UTC execution belongs to prior local day');
select pg_temp.assert_true((select item->>'status'='scheduled' from jsonb_array_elements(public.professional_dashboard_summary('2026-10-08','UTC')->'today') item where item->>'student_user_id'=md5('workspace-student-2')::uuid::text),'UTC boundary differs from local day');
select pg_temp.assert_true(jsonb_array_length(public.professional_dashboard_summary('2026-10-08','America/Sao_Paulo')->'today')<=10 and jsonb_array_length(public.professional_dashboard_summary('2026-10-08','America/Sao_Paulo')->'recent_activity')<=10,'summary lists bounded independently of totals');
select pg_temp.assert_true((public.professional_dashboard_summary('2026-10-08','America/Sao_Paulo')->>'active_programs')::int=1 and (public.professional_dashboard_summary('2026-10-08','America/Sao_Paulo')->>'pending_invites')::int=1,'in-use programs and unexpired pending invites');
select pg_temp.assert_true((public.professional_programs_page('In use',false,0,20)->'items'->0->>'student_count')::int=240 and (public.professional_programs_page('In use',false,0,20)->'items'->0->>'workout_count')::int=2 and (public.professional_programs_page('In use',false,0,20)->'items'->0->>'last_changed_at')::timestamptz='2026-10-08'::timestamptz,'program projection distinct active students, workouts and published max date');
select pg_temp.assert_true((public.professional_programs_page('',false,0,20)->>'total')::int=2 and (public.professional_programs_page('',true,0,20)->>'total')::int=1,'archived filter');
select pg_temp.assert_true((public.professional_executions_page(null,'In use','completed','2026-10-09 00:00+00','2026-10-09 02:00+00',0,20)->>'total')::int=1,'search and inclusive-from exclusive-to filters');
reset role;
insert into public.program_versions(id,program_id,version_number,weekly_plan,published_at) values
 ('09001730-0000-0000-0000-000000000000','09001720-0000-0000-0000-000000000001',2,'{"thursday":[{"exerciseId":"x","sets":3,"reps":8}]}','2026-10-08');
update public.program_assignments set status='revoked',revoked_at=now() where id=md5('workspace-assignment-3')::uuid;
update public.program_assignments set created_at=now()-interval '9 days' where id=md5('workspace-assignment-4')::uuid;
insert into public.workout_executions(assignment_id,version_id,student_user_id,day_key,status,started_at) values
 (md5('workspace-assignment-5')::uuid,'09001730-0000-0000-0000-000000000001',md5('workspace-student-5')::uuid,'thursday','in_progress',now()-interval '25 hours'),
 (md5('workspace-assignment-6')::uuid,'09001730-0000-0000-0000-000000000001',md5('workspace-student-6')::uuid,'thursday','abandoned',now());
set local role authenticated;
select pg_temp.assert_true((public.professional_programs_page('In use',false,0,20)->'items'->0->>'workout_count')::int=1,'latest published version follows version identity even when publication dates tie');
select pg_temp.assert_true((public.professional_students_page('Student 003','without_program',0,30)->'items'->0->'attention_reasons')='["without_program"]'::jsonb,'without-program filter and attention reason');
select pg_temp.assert_true((public.professional_students_page('Student 004','attention',0,30)->'items'->0->'attention_reasons')='["inactive_7_days"]'::jsonb,'no current execution after 7 days since assignment needs attention');
select pg_temp.assert_true((public.professional_students_page('Student 005','attention',0,30)->'items'->0->'attention_reasons')='["stale_in_progress"]'::jsonb,'stale ongoing execution needs attention');
select pg_temp.assert_true((public.professional_students_page('Student 006','attention',0,30)->'items'->0->'attention_reasons')='["abandoned"]'::jsonb,'current abandoned execution needs attention');
select pg_temp.assert_true((public.professional_students_page('','with_program',0,30)->>'total')::int=239 and (public.professional_students_page('','attention',0,30)->>'total')::int=4 and (public.professional_dashboard_summary('2026-10-08','UTC')->>'attention_students')::int=4,'exact filtered and dashboard attention totals');
select pg_temp.assert_true((public.professional_programs_page('In use',false,0,20)->'items'->0->>'student_count')::int=239,'revoked assignments excluded from active student count');
select pg_temp.assert_true((public.professional_students_page('%','all',0,30)->>'total')::int=0,'search treats wildcard as literal');
select pg_temp.expect_error($q$select public.professional_students_page('','invalid',0,30)$q$,'22023');
select pg_temp.expect_error($q$select public.professional_students_page('','all',-1,30)$q$,'22023');
select pg_temp.expect_error($q$select public.professional_programs_page('',null,0,101)$q$,'22023');
select pg_temp.expect_error($q$select public.professional_executions_page(null,'','all',null,null,0,0)$q$,'22023');
select pg_temp.expect_error($q$select public.professional_executions_page(null,'','bogus',null,null,0,20)$q$,'22023');
select pg_temp.expect_error($q$select public.professional_dashboard_summary('2026-10-08','Invalid/Zone')$q$,'22023');
select pg_temp.expect_error($q$select public.professional_dashboard_summary(null,'UTC')$q$,'22023');
set local request.jwt.claim.sub='09001700-0000-0000-0000-000000000002';
select pg_temp.assert_true((public.professional_students_page('','all',0,30)->>'total')::int=0 and (public.professional_executions_page(null,'','all',null,null,0,20)->>'total')::int=0,'caller-scoped student/execution isolation');
select pg_temp.assert_true((public.professional_programs_page('',null,0,20)->>'total')::int=1 and (public.professional_dashboard_summary('2026-10-08','UTC')->>'active_students')::int=0,'caller-scoped program/dashboard isolation');
-- Relationship revocation ends professional historical reads. Assignment revocation
-- alone must still preserve history while that professional's link is active.
reset role;
insert into public.professional_student_relationships(professional_user_id,student_user_id,status) values
 ('09001700-0000-0000-0000-000000000002',md5('workspace-student-1')::uuid,'active');
create temporary table own_history_before_revocation as
select jsonb_agg(to_jsonb(e) order by e.id) as rows from public.workout_executions e where e.student_user_id=md5('workspace-student-1')::uuid;
grant select on own_history_before_revocation to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='09001700-0000-0000-0000-000000000001';
select pg_temp.assert_true((public.professional_executions_page(md5('workspace-student-1')::uuid,'','all',null,null,0,20)->>'total')::int=601,'revoked assignment history remains readable while caller-owned relationship is active');
select pg_temp.assert_true(exists(select 1 from jsonb_array_elements(public.professional_dashboard_summary('2026-10-08','UTC')->'recent_activity') e where e->>'student_user_id'=md5('workspace-student-1')::uuid::text),'revoked assignment history remains in recent feed before relationship revocation');
select public.revoke_professional_relationship((select id from public.professional_student_relationships where professional_user_id=auth.uid() and student_user_id=md5('workspace-student-1')::uuid));
select pg_temp.assert_true((public.professional_executions_page(null,'','all',null,null,0,20)->>'total')::int=3,'revoked relationship excluded from global execution total');
select pg_temp.assert_true((public.professional_executions_page(md5('workspace-student-1')::uuid,'','all',null,null,0,20)->>'total')::int=0 and public.professional_executions_page(md5('workspace-student-1')::uuid,'','all',null,null,0,20)->'items'='[]'::jsonb,'revoked relationship excluded from selected student execution total and items');
select pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(public.professional_executions_page(null,'','all',null,null,0,100)->'items') e where e->>'student_user_id'=md5('workspace-student-1')::uuid::text),'revoked relationship excluded from all-student execution items');
select pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(public.professional_dashboard_summary('2026-10-08','UTC')->'recent_activity') e where e->>'student_user_id'=md5('workspace-student-1')::uuid::text),'revoked relationship excluded from dashboard recent feed even if another professional has an active link');
select pg_temp.assert_true(jsonb_array_length(public.professional_dashboard_summary('2026-10-08','UTC')->'recent_activity')=3,'dashboard recent feed keeps authorized students');
select pg_temp.assert_true((select count(*)=0 from public.workout_executions where student_user_id=md5('workspace-student-1')::uuid),'existing professional RLS also excludes revoked relationship');
set local request.jwt.claim.sub='b2c24b70-edf6-a7fb-5d32-e37f470305de';
select pg_temp.assert_true((select count(*)=601 and jsonb_agg(to_jsonb(e) order by e.id)=(select rows from own_history_before_revocation) from public.workout_executions e where e.student_user_id=auth.uid()),'student own historical access and entire execution rows remain unchanged after revocation');
set local request.jwt.claim.sub='';
select pg_temp.expect_error($q$select public.professional_students_page('','all',0,30)$q$,'42501');
select pg_temp.expect_error($q$select public.professional_programs_page('',null,0,20)$q$,'42501');
select pg_temp.expect_error($q$select public.professional_executions_page(null,'','all',null,null,0,20)$q$,'42501');
select pg_temp.expect_error($q$select public.professional_dashboard_summary('2026-10-08','UTC')$q$,'42501');
set local request.jwt.claim.sub='b2c24b70-edf6-a7fb-5d32-e37f470305de';
select pg_temp.expect_error($q$select public.professional_students_page('','all',0,30)$q$,'42501');
select pg_temp.expect_error($q$select public.professional_workspace_students()$q$,'42501');
set local role anon;
select pg_temp.expect_error($q$select public.professional_dashboard_summary('2026-10-08','UTC')$q$,'42501');
rollback;
select '1..1';
select 'ok 1 - exact workspace counts, timezone agenda, current assignment attention, scoped paginated reads';
