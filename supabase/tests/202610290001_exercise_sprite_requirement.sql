begin;
create function pg_temp.assert_true(value boolean,message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'assertion failed: %',message; end if; end $$;
create function pg_temp.expect_unavailable(statement text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when sqlstate '22023' then
    if sqlerrm='weekly-plan-exercise-unavailable' then return; end if;
    raise;
  end;
  raise exception 'pending exercise was accepted: %',statement;
end $$;
insert into auth.users(id) values
 ('29000100-0000-4000-8000-000000000001'),
 ('29000100-0000-4000-8000-000000000002'),
 ('29000100-0000-4000-8000-000000000003');
insert into public.user_roles(user_id,role) values ('29000100-0000-4000-8000-000000000001','professional') on conflict do nothing;
insert into public.professional_student_relationships(professional_user_id,student_user_id,status) values
 ('29000100-0000-4000-8000-000000000001','29000100-0000-4000-8000-000000000002','active'),
 ('29000100-0000-4000-8000-000000000001','29000100-0000-4000-8000-000000000003','active');
insert into public.programs(id,professional_user_id,title) values
 ('29000100-0000-4000-8000-000000000010','29000100-0000-4000-8000-000000000001','Legado');
-- Simulate an immutable prescription and delivery saved before this release.
set local session_replication_role=replica;
insert into public.program_versions(id,program_id,version_number,weekly_plan,published_at) values
 ('29000100-0000-4000-8000-000000000011','29000100-0000-4000-8000-000000000010',1,'{"monday":[{"exerciseId":"2330","sets":3,"reps":10,"load":0}]}',now());
insert into public.program_assignments(id,program_id,version_id,professional_user_id,student_user_id,status) values
 ('29000100-0000-4000-8000-000000000012','29000100-0000-4000-8000-000000000010','29000100-0000-4000-8000-000000000011','29000100-0000-4000-8000-000000000001','29000100-0000-4000-8000-000000000003','active');
insert into public.athlete_plan_library(id,user_id,source_type,title,assignment_id) values
 ('29000100-0000-4000-8000-000000000013','29000100-0000-4000-8000-000000000003','professional','Legado','29000100-0000-4000-8000-000000000012');
set local session_replication_role=origin;
set local role authenticated;
select set_config('request.jwt.claim.sub','29000100-0000-4000-8000-000000000001',true);
select pg_temp.expect_unavailable($q$select public.publish_program_version('29000100-0000-4000-8000-000000000010','{"monday":[{"exerciseId":"2330","sets":3,"reps":10,"load":0}]}')$q$);
select pg_temp.expect_unavailable($q$select public.publish_program_version_with_titles('29000100-0000-4000-8000-000000000010','{"monday":[{"exerciseId":"0001","sets":3,"reps":10,"load":0}]}','{}')$q$);
select pg_temp.expect_unavailable($q$select public.duplicate_professional_program('29000100-0000-4000-8000-000000000010','29000100-0000-4000-8000-000000000011','Cópia')$q$);
select pg_temp.expect_unavailable($q$select public.assign_program_version('29000100-0000-4000-8000-000000000010','29000100-0000-4000-8000-000000000011','29000100-0000-4000-8000-000000000002')$q$);
select public.save_student_plan_draft('29000100-0000-4000-8000-000000000002','Revisar','{"routines":[{"id":"a","name":"A","ex":[{"id":"2330","sets":3,"reps":10,"weight":0}]}],"week":{"1":"a"}}',0);
select pg_temp.expect_unavailable($q$select public.send_student_plan('29000100-0000-4000-8000-000000000002',1)$q$);
select public.save_student_plan_draft('29000100-0000-4000-8000-000000000002','Corrigido','{"routines":[{"id":"a","name":"A","ex":[{"id":"0025","sets":3,"reps":10,"weight":0}]}],"week":{"1":"a"}}',1);
select public.send_student_plan('29000100-0000-4000-8000-000000000002',2);
select set_config('request.jwt.claim.sub','29000100-0000-4000-8000-000000000002',true);
select pg_temp.assert_true((select prescription->'ex'->0->>'id'='0025' from public.athlete_routines where user_id=auth.uid()),'available exercise reaches student');
select set_config('request.jwt.claim.sub','29000100-0000-4000-8000-000000000003',true);
select pg_temp.expect_unavailable($q$select public.apply_library_plan('29000100-0000-4000-8000-000000000013')$q$);
select pg_temp.assert_true((select weekly_plan->'monday'->0->>'exerciseId'='2330' from public.program_versions where id='29000100-0000-4000-8000-000000000011'),'historical prescription remains readable and unchanged');
reset role;
select pg_temp.assert_true(not has_table_privilege('authenticated','public.exercise_sprite_catalogue','INSERT'),'clients cannot activate exercises themselves');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.exercise_sprite_catalogue','DELETE'),'clients cannot change sprite coverage');
select pg_temp.assert_true(not has_function_privilege('authenticated','public.require_sprite_exercises(jsonb)','EXECUTE'),'validation helper stays private');
rollback;
