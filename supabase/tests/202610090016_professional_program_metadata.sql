-- Transactional fixtures: run only through the disposable-local database harness.
begin;
create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'assertion failed: %', message; end if; end $$;
create function pg_temp.expect_error(command text, expected text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute command; exception when others then get stacked diagnostics actual = returned_sqlstate; end;
  if actual is distinct from expected then raise exception 'expected SQLSTATE %, got % for %', expected, actual, command; end if;
end $$;
insert into auth.users(id) values
 ('09001600-0000-0000-0000-000000000001'), ('09001600-0000-0000-0000-000000000002'),
 ('09001600-0000-0000-0000-000000000003'), ('09001600-0000-0000-0000-000000000004');
insert into public.user_roles(user_id, role) values
 ('09001600-0000-0000-0000-000000000001','professional'), ('09001600-0000-0000-0000-000000000002','professional');
insert into public.professional_student_relationships(id,professional_user_id,student_user_id,status) values
 ('09001610-0000-0000-0000-000000000001','09001600-0000-0000-0000-000000000001','09001600-0000-0000-0000-000000000003','active');
insert into public.programs(id,professional_user_id,title,description,archived) values
 ('09001620-0000-0000-0000-000000000001','09001600-0000-0000-0000-000000000001','Original','Base',false),
 ('09001620-0000-0000-0000-000000000002','09001600-0000-0000-0000-000000000002','Other',null,false),
 ('09001620-0000-0000-0000-000000000003','09001600-0000-0000-0000-000000000001','No version',null,true);
insert into public.program_versions(id,program_id,version_number,weekly_plan,published_at) values
 ('09001630-0000-0000-0000-000000000001','09001620-0000-0000-0000-000000000001',1,'{"monday":[{"exerciseId":"x","sets":3,"reps":8,"rest":90,"unit":"lb","notes":"Original","mode":"time","sec":45,"rir":2,"sg":"pair"}]}',now()),
 ('09001630-0000-0000-0000-000000000002','09001620-0000-0000-0000-000000000002',1,'{"monday":[{"exerciseId":"y","sets":2,"reps":10}]}',now());
create temporary table originals as select to_jsonb(v) as version from public.program_versions v where id='09001630-0000-0000-0000-000000000001';
grant select on originals to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='09001600-0000-0000-0000-000000000002';
select pg_temp.expect_error($q$select public.update_program_metadata('09001620-0000-0000-0000-000000000001','Attack',null,null)$q$,'42501');
select pg_temp.expect_error($q$select public.duplicate_professional_program('09001620-0000-0000-0000-000000000001','09001630-0000-0000-0000-000000000001','Attack')$q$,'42501');
set local request.jwt.claim.sub='09001600-0000-0000-0000-000000000001';
select pg_temp.expect_error($q$select public.duplicate_professional_program('09001620-0000-0000-0000-000000000001','09001630-0000-0000-0000-000000000002','Mismatch')$q$,'42501');
select pg_temp.assert_true((select title='Original' from public.programs where id='09001620-0000-0000-0000-000000000001'),'rejects_cross_owner_metadata_and_duplication without changes');
select pg_temp.assert_true((select count(*)=2 from public.programs),'cross-owner duplicate leaves no program');
select pg_temp.assert_true((public.update_program_metadata('09001620-0000-0000-0000-000000000003','No version',repeat('d',4000),repeat('o',160))).archived,'metadata preserves archival state and existing 4000-description bound');
select pg_temp.expect_error($q$select public.update_program_metadata('09001620-0000-0000-0000-000000000001','Original',null,repeat('o',161))$q$,'22023');
select pg_temp.expect_error($q$select public.update_program_metadata('09001620-0000-0000-0000-000000000001',repeat('t',161),null,null)$q$,'22023');
select pg_temp.expect_error($q$select public.update_program_metadata('09001620-0000-0000-0000-000000000001','Original',repeat('d',4001),null)$q$,'22023');
select public.assign_program_version('09001620-0000-0000-0000-000000000001','09001630-0000-0000-0000-000000000001','09001600-0000-0000-0000-000000000003');
set local request.jwt.claim.sub='09001600-0000-0000-0000-000000000003';
select public.start_workout_execution('09001640-0000-0000-0000-000000000001',(select id from public.program_assignments where status='active'),'monday');
select pg_temp.assert_true((select prescription_snapshot->>'workoutTitle'='monday' from public.workout_executions where id='09001640-0000-0000-0000-000000000001'),'legacy execution title falls back to day');
reset role;
create temporary table old_history as select to_jsonb(e) as execution from public.workout_executions e where id='09001640-0000-0000-0000-000000000001';
grant select on old_history to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='09001600-0000-0000-0000-000000000001';
select pg_temp.assert_true((public.publish_program_version_with_titles('09001620-0000-0000-0000-000000000001',(select version->'weekly_plan' from originals),jsonb_build_object('monday',repeat('n',80)))).workout_titles->>'monday'=repeat('n',80),'metadata_limits accepts 80-character workout name');
select pg_temp.expect_error($q$select public.publish_program_version_with_titles('09001620-0000-0000-0000-000000000001','{"monday":[{"exerciseId":"x","sets":3,"reps":8}]}',jsonb_build_object('monday',repeat('n',81)))$q$,'22023');
select pg_temp.expect_error($q$select public.publish_program_version_with_titles('09001620-0000-0000-0000-000000000001','{"monday":[{"exerciseId":"x","sets":0,"reps":8}]}','{}')$q$,'22023');
select pg_temp.expect_error($q$select public.publish_program_version_with_titles('09001620-0000-0000-0000-000000000001','{"monday":[{"exerciseId":"x","sets":3,"reps":8}]}','{"monday":12}')$q$,'22023');
select pg_temp.expect_error($q$select public.publish_program_version_with_titles('09001620-0000-0000-0000-000000000001','{"monday":[{"exerciseId":"x","sets":3,"reps":8}]}','{"unknown":"A"}')$q$,'22023');
select pg_temp.assert_true((select to_jsonb(v)=(select version from originals) from public.program_versions v where id='09001630-0000-0000-0000-000000000001'),'publishes_titles_without_mutating_old_versions');
select pg_temp.assert_true((select count(*)=2 from public.program_versions where program_id='09001620-0000-0000-0000-000000000001'),'failed publications leave no version');
select pg_temp.assert_true((select weekly_plan=(select version->'weekly_plan' from originals) from public.program_versions where program_id='09001620-0000-0000-0000-000000000001' and version_number=2),'new publication preserves all prescription fields');
select public.assign_program_version('09001620-0000-0000-0000-000000000001',(select id from public.program_versions where program_id='09001620-0000-0000-0000-000000000001' and version_number=2),'09001600-0000-0000-0000-000000000003');
select pg_temp.assert_true((public.duplicate_professional_program('09001620-0000-0000-0000-000000000001',(select id from public.program_versions where program_id='09001620-0000-0000-0000-000000000001' and version_number=2),'Copy')->'version'->'workout_titles'->>'monday')=repeat('n',80),'duplicate copies selected version title');
select pg_temp.assert_true((public.duplicate_professional_program('09001620-0000-0000-0000-000000000003',null,'Empty copy')->'version')='null'::jsonb,'unpublished duplicate has null version');
select pg_temp.assert_true((select bool_and(not archived) from public.programs where title in ('Copy','Empty copy')),'duplicate is independent and unarchived');
select pg_temp.assert_true((select count(*)=0 from public.program_assignments a join public.programs p on p.id=a.program_id where p.title in ('Copy','Empty copy')),'duplicate_has_no_assignments');
select pg_temp.assert_true((select version_number=1 and weekly_plan=(select version->'weekly_plan' from originals) from public.program_versions v join public.programs p on p.id=v.program_id where p.title='Copy'),'duplicate version starts at one');
select pg_temp.assert_true(public.professional_student_note('09001600-0000-0000-0000-000000000003')='{"body":"","updated_at":null}'::jsonb,'missing authorized note is empty');
select pg_temp.assert_true(public.save_professional_student_note('09001600-0000-0000-0000-000000000003',repeat('b',2000))->>'body'=repeat('b',2000),'metadata_limits accepts 2000-character note');
select pg_temp.expect_error($q$select public.save_professional_student_note('09001600-0000-0000-0000-000000000003',repeat('b',2001))$q$,'22023');
select pg_temp.assert_true(public.professional_student_note('09001600-0000-0000-0000-000000000003')->>'body'=repeat('b',2000),'failed note save preserves previous body');
select pg_temp.expect_error($q$select * from public.professional_student_notes$q$,'42501');
select pg_temp.expect_error($q$update public.professional_student_notes set body='bypass'$q$,'42501');
select pg_temp.expect_error($q$insert into public.professional_student_notes(professional_id,student_id,body) values(auth.uid(),'09001600-0000-0000-0000-000000000003','bypass')$q$,'42501');
select pg_temp.expect_error($q$delete from public.professional_student_notes$q$,'42501');
set local request.jwt.claim.sub='09001600-0000-0000-0000-000000000002';
select pg_temp.expect_error($q$select public.professional_student_note('09001600-0000-0000-0000-000000000003')$q$,'42501');
select pg_temp.expect_error($q$select public.save_professional_student_note('09001600-0000-0000-0000-000000000003','other professional')$q$,'42501');
set local request.jwt.claim.sub='09001600-0000-0000-0000-000000000003';
select pg_temp.expect_error($q$select public.professional_student_note(auth.uid())$q$,'42501');
select pg_temp.expect_error($q$select public.save_professional_student_note(auth.uid(),'student')$q$,'42501');
select pg_temp.assert_true(public.student_program_overview()->'version'->'workout_titles'->>'monday'=repeat('n',80),'overview propagates names');
select pg_temp.assert_true((select material->'workout_titles'->>'monday'=repeat('n',80) from public.student_professional_detail('09001600-0000-0000-0000-000000000001') d cross join lateral jsonb_array_elements(d.materials) material where material->>'status'='active' and material->>'program_id'='09001620-0000-0000-0000-000000000001'),'received material propagates names for the intended active assignment');
select public.start_workout_execution('09001640-0000-0000-0000-000000000002',(select id from public.program_assignments where status='active'),'monday');
select pg_temp.assert_true((select prescription_snapshot->>'workoutTitle'=repeat('n',80) and prescription_snapshot->'exercises'=(select version->'weekly_plan'->'monday' from originals) from public.workout_executions where id='09001640-0000-0000-0000-000000000002'),'new execution captures immutable version title and prescription');
select pg_temp.assert_true((select to_jsonb(e)=(select execution from old_history) from public.workout_executions e where id='09001640-0000-0000-0000-000000000001'),'new publication never rewrites old execution');
select public.revoke_professional_relationship('09001610-0000-0000-0000-000000000001');
set local request.jwt.claim.sub='09001600-0000-0000-0000-000000000001';
select pg_temp.expect_error($q$select public.professional_student_note('09001600-0000-0000-0000-000000000003')$q$,'42501');
select pg_temp.expect_error($q$select public.save_professional_student_note('09001600-0000-0000-0000-000000000003','revoked')$q$,'42501');
set local request.jwt.claim.sub='';
select pg_temp.expect_error($q$select public.professional_student_note('09001600-0000-0000-0000-000000000003')$q$,'42501');
set local role anon;
select pg_temp.expect_error($q$select public.professional_student_note('09001600-0000-0000-0000-000000000003')$q$,'42501');
select pg_temp.expect_error($q$select public.save_professional_student_note('09001600-0000-0000-0000-000000000003','anon')$q$,'42501');
rollback;
select '1..1';
select 'ok 1 - metadata ownership, private note ACL, duplication, immutable version names and execution snapshots';
