-- Behavioral regression suite. Run against a disposable database, never production.
\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'assertion failed: %', message; end if; end $$;
create function pg_temp.expect_error(command text, expected text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute command; exception when others then get stacked diagnostics actual = returned_sqlstate; end;
  if actual is distinct from expected then raise exception 'expected SQLSTATE %, got % for %',expected,actual,command; end if;
end $$;
insert into auth.users(id) values
 ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003'), ('00000000-0000-0000-0000-000000000004');
insert into public.user_roles(user_id,role) values ('00000000-0000-0000-0000-000000000001','professional'),('00000000-0000-0000-0000-000000000002','professional');
insert into public.professional_student_relationships(id,professional_user_id,student_user_id,status) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','active'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','active');
insert into public.programs(id,professional_user_id,title) values
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','First'),
 ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Other');
insert into public.program_versions(id,program_id,version_number,weekly_plan,published_at) values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1,'{"monday":[{"exerciseId":"squat","sets":3,"reps":10}]}',now()),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002',1,'{"monday":[{"exerciseId":"squat","sets":3,"reps":10}]}',now());
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
-- Old policy accepted another owner's program and unrelated version via direct INSERT.
select pg_temp.expect_error($q$insert into public.program_assignments(program_id,version_id,professional_user_id,student_user_id) values ('20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001',auth.uid(),'00000000-0000-0000-0000-000000000003')$q$,'42501');
select pg_temp.expect_error($q$update public.programs set title='bypass'$q$,'42501');
select pg_temp.expect_error($q$insert into public.program_versions(program_id,version_number) values ('20000000-0000-0000-0000-000000000001',2)$q$,'42501');
select pg_temp.expect_error($q$select public.publish_program_version('20000000-0000-0000-0000-000000000001','{"monday":[{"exerciseId":"x","sets":0,"reps":10}]}')$q$,'22023');
select pg_temp.expect_error($q$select public.publish_program_version('20000000-0000-0000-0000-000000000001','{"monday":[{"exerciseId":"x","sets":3,"reps":10,"rest":-1}]}')$q$,'22023');
select pg_temp.expect_error($q$select public.publish_program_version('20000000-0000-0000-0000-000000000001','{"monday":[{"exerciseId":"x","sets":3,"reps":10,"rpe":11}]}')$q$,'22023');
select pg_temp.expect_error($q$select public.publish_program_version('20000000-0000-0000-0000-000000000001','{"monday":[]}')$q$,'22023');
select pg_temp.assert_true((public.publish_program_version('20000000-0000-0000-0000-000000000001','{"monday":[{"exerciseId":"x","sets":2,"reps":8,"mode":"cardio","min":25,"speed":6.5,"unit":"lb","rest":0,"notes":"Leve","effort":"rpe","rpe":6,"sg":"a"}]}')).weekly_plan->'monday'->0->>'min'='25','timed cardio prescription is preserved');
select pg_temp.expect_error($q$select public.assign_program_version('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003')$q$,'42501');
select pg_temp.expect_error($q$select public.assign_program_version('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004')$q$,'42501');
select public.assign_program_version('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003');
select pg_temp.assert_true((select count(*)=1 from public.program_assignments where status='active'),'one assignment after replay');
select public.assign_program_version('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
select public.start_workout_execution('40000000-0000-0000-0000-000000000001',(select id from public.program_assignments where status='active'),'monday');
select public.start_workout_execution('40000000-0000-0000-0000-000000000001',(select id from public.program_assignments where status='active'),'monday');
select pg_temp.assert_true((select count(*)=1 from public.workout_executions),'start replay creates one execution');
select pg_temp.expect_error($q$select public.start_workout_execution('40000000-0000-0000-0000-000000000001',null,null)$q$,'22023');
select pg_temp.expect_error($q$update public.workout_executions set version_id='30000000-0000-0000-0000-000000000002'$q$,'42501');
select pg_temp.expect_error($q$select public.start_workout_execution('40000000-0000-0000-0000-000000000002',(select id from public.program_assignments where status='active'),'friday')$q$,'22023');
select pg_temp.expect_error($q$select public.start_workout_execution('40000000-0000-0000-0000-000000000003',(select id from public.program_assignments where status='active'),'monday',jsonb_build_object('oversized',repeat('x',262145)))$q$,'22023');
select pg_temp.expect_error($q$select public.complete_workout_execution('40000000-0000-0000-0000-000000000001','{}',now()-interval '1 day')$q$,'22023');
select public.complete_workout_execution('40000000-0000-0000-0000-000000000001','{"sets":3}');
select public.complete_workout_execution('40000000-0000-0000-0000-000000000001','{"sets":3}');
select pg_temp.expect_error($q$select public.abandon_workout_execution('40000000-0000-0000-0000-000000000001')$q$,'22023');
select pg_temp.assert_true((select payload='{"sets":3}'::jsonb and status='completed' from public.workout_executions),'terminal replay preserves first result');
select public.start_workout_execution('40000000-0000-0000-0000-000000000002',(select id from public.program_assignments where status='active'),'monday');
select public.abandon_workout_execution('40000000-0000-0000-0000-000000000002');
select public.abandon_workout_execution('40000000-0000-0000-0000-000000000002');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000004';
select pg_temp.expect_error($q$select public.complete_workout_execution('40000000-0000-0000-0000-000000000001')$q$,'42501');
select pg_temp.expect_error($q$select public.create_program('No capability')$q$,'42501');
select pg_temp.expect_error($q$select public.start_workout_execution('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','monday')$q$,'42501');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select public.assign_program_version('20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
select pg_temp.assert_true((select count(*)=1 from public.program_assignments where status='active'),'replacement is global across professionals');
select public.revoke_professional_relationship('10000000-0000-0000-0000-000000000001');
select public.revoke_professional_relationship('10000000-0000-0000-0000-000000000002');
select pg_temp.assert_true(public.student_program_overview()='{}'::jsonb,'revocation clears active overview');
select pg_temp.assert_true((select count(*)=0 from public.programs),'revoked student cannot read program');
select pg_temp.assert_true((select count(*)=2 from public.workout_executions),'personal history retained');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select count(*)=0 from public.workout_executions),'professional cannot read revoked execution history');
select pg_temp.assert_true((select count(*)=0 from public.professional_client_detail('00000000-0000-0000-0000-000000000003')),'revoked detail hidden');
select pg_temp.expect_error($q$select public.assign_program_version('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003')$q$,'42501');
select public.create_program(' New program ','Description');
select public.update_program('20000000-0000-0000-0000-000000000001','Archived','Description',true);
select pg_temp.expect_error($q$select public.publish_program_version('20000000-0000-0000-0000-000000000001','{"monday":[{"exerciseId":"x","sets":3,"reps":10}]}')$q$,'22023');
select pg_temp.expect_error($q$select public.update_program('20000000-0000-0000-0000-000000000002','Foreign',null,false)$q$,'42501');
select pg_temp.expect_error($q$select public.save_own_account_snapshot(0,1,jsonb_build_object('oversized',repeat('x',2097153)))$q$,'22023');
select pg_temp.assert_true((select status='APPLIED' from public.save_own_account_snapshot(0,1,'{}')),'first snapshot applies');
select pg_temp.assert_true((select status='CONFLICT' and revision=1 from public.save_own_account_snapshot(0,1,'{}')),'stale first snapshot conflicts');
set local role anon;
select pg_temp.expect_error($q$select public.create_program('Anonymous')$q$,'42501');
select pg_temp.expect_error($q$select public.start_workout_execution('40000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','monday')$q$,'42501');
reset role;
-- Composite foreign keys protect service-side writes as well.
select pg_temp.expect_error($q$insert into public.program_assignments(program_id,version_id,professional_user_id,student_user_id,status) values ('20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000004','revoked')$q$,'23503');
select pg_temp.expect_error($q$insert into public.program_assignments(program_id,version_id,professional_user_id,student_user_id) values ('20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003')$q$,'23514');
update public.professional_student_relationships set status='active' where id='10000000-0000-0000-0000-000000000001';
update public.programs set archived=false where id='20000000-0000-0000-0000-000000000001';
update public.program_assignments set status='active' where program_id='20000000-0000-0000-0000-000000000001';
insert into public.workout_executions(assignment_id,version_id,student_user_id,day_key)
select a.id,a.version_id,a.student_user_id,'monday' from public.program_assignments a cross join generate_series(1,150)
where a.program_id='20000000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
select pg_temp.assert_true(jsonb_array_length(public.student_program_overview()->'executions')=100,'student overview bounds recent history');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select jsonb_array_length(executions)=100 from public.professional_client_detail('00000000-0000-0000-0000-000000000003')),'professional detail bounds recent history');
select public.delete_my_account();
reset role;
select pg_temp.assert_true(not exists(select 1 from auth.users where id='00000000-0000-0000-0000-000000000001'),'permanent professional deletion removes auth identity');
select pg_temp.assert_true(not exists(select 1 from public.programs where professional_user_id='00000000-0000-0000-0000-000000000001'),'permanent professional deletion removes owned programs');
select pg_temp.assert_true((select count(*)=152 from public.workout_executions where student_user_id='00000000-0000-0000-0000-000000000003'),'professional deletion preserves student execution history');
select pg_temp.assert_true((select count(*)=152 from public.workout_executions where assignment_id is null and version_id is null),'preserved student history is detached from deleted owner');
select pg_temp.assert_true((select bool_and(prescription_snapshot->>'programTitle' in ('First','Archived') and prescription_snapshot->>'versionNumber'='1' and prescription_snapshot->'exercises'->0->>'exerciseId'='squat') from public.workout_executions),'preserved student history includes real prescription');
select pg_temp.assert_true((select prescription_snapshot->>'programTitle'='First' from public.workout_executions where id='40000000-0000-0000-0000-000000000001'),'new execution snapshot preserves original program title');
select pg_temp.assert_true(not exists(select 1 from public.workout_executions where status='in_progress'),'professional deletion closes in-progress sessions');
select pg_temp.assert_true((select payload='{"sets":3}'::jsonb and status='completed' from public.workout_executions where id='40000000-0000-0000-0000-000000000001'),'professional deletion preserves performed payload and completed status');
select pg_temp.assert_true(exists(select 1 from public.programs where id='20000000-0000-0000-0000-000000000002'),'professional deletion leaves other professionals programs');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
select pg_temp.assert_true((select count(*)=152 from public.workout_executions),'student retains RLS access to detached execution history');
select public.delete_my_account();
reset role;
select pg_temp.assert_true(not exists(select 1 from auth.users where id='00000000-0000-0000-0000-000000000003'),'student deletion removes own auth identity');
select pg_temp.assert_true(not exists(select 1 from public.workout_executions where student_user_id='00000000-0000-0000-0000-000000000003'),'student deletion removes own execution history');
select pg_temp.assert_true(exists(select 1 from public.programs where id='20000000-0000-0000-0000-000000000002'),'student deletion leaves other professionals programs');
set local role anon;
select pg_temp.expect_error($q$select public.delete_my_account()$q$,'42501');
rollback;
select '1..1';
select 'ok 1 - authenticated professional invariants and bounded histories';
