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
insert into auth.users(id) values
 ('10290200-0000-0000-0000-000000000001'),('10290200-0000-0000-0000-000000000002'),
 ('10290200-0000-0000-0000-000000000003'),('10290200-0000-0000-0000-000000000004');
insert into public.user_roles(user_id,role) values
 ('10290200-0000-0000-0000-000000000001','professional'),
 ('10290200-0000-0000-0000-000000000002','professional');
insert into public.professional_student_relationships(id,professional_user_id,student_user_id,status) values
 ('10290210-0000-0000-0000-000000000001','10290200-0000-0000-0000-000000000001','10290200-0000-0000-0000-000000000003','active'),
 ('10290210-0000-0000-0000-000000000002','10290200-0000-0000-0000-000000000001','10290200-0000-0000-0000-000000000004','revoked');
insert into public.programs(id,professional_user_id,title,archived,updated_at) values
 ('10290220-0000-0000-0000-000000000001','10290200-0000-0000-0000-000000000001','Latest plan',false,'2026-10-01'),
 ('10290220-0000-0000-0000-000000000002','10290200-0000-0000-0000-000000000001','No plan',false,'2026-10-02');
insert into public.program_versions(id,program_id,version_number,weekly_plan,published_at) values
 ('10290230-0000-0000-0000-000000000001','10290220-0000-0000-0000-000000000001',1,'{"monday":[{"exerciseId":"0025","sets":3,"reps":8}]}','2026-10-01'),
 ('10290230-0000-0000-0000-000000000002','10290220-0000-0000-0000-000000000001',2,'{"friday":[{"exerciseId":"0043","sets":2,"reps":10}]}','2026-10-02');
select pg_temp.assert_true((select body='' from public.professional_student_notes where professional_id='10290100-0000-0000-0000-000000000001' and student_id='10290100-0000-0000-0000-000000000002'),'legacy mutable slot is cleared after migration');
set local role authenticated;
set local request.jwt.claim.sub='10290200-0000-0000-0000-000000000001';
select pg_temp.assert_true(public.professional_programs_page('Latest plan',false,0,20)->'items'->0->'weekly_plan'='{"friday":[{"exerciseId":"0043","sets":2,"reps":10}]}'::jsonb,'program list projects latest published weekly plan');
select pg_temp.assert_true(public.professional_programs_page('No plan',false,0,20)->'items'->0->'weekly_plan'='{}'::jsonb,'program list uses neutral plan for unpublished models');
set local request.jwt.claim.sub='10290100-0000-0000-0000-000000000001';
select pg_temp.assert_true(public.list_professional_student_notes('10290100-0000-0000-0000-000000000002')->0->>'body'='Nota antiga','legacy private note remains visible after migration');
select pg_temp.assert_true((public.list_professional_student_notes('10290100-0000-0000-0000-000000000002')->0->>'created_at')::timestamptz='2026-10-20 12:30:00+00'::timestamptz,'legacy timestamp remains unchanged');
set local request.jwt.claim.sub='10290200-0000-0000-0000-000000000001';
select pg_temp.assert_true(jsonb_array_length(public.list_professional_student_notes('10290200-0000-0000-0000-000000000003'))=0,'new student has no notes');
select pg_temp.assert_true((public.add_professional_student_note('10290200-0000-0000-0000-000000000003','Primeira anotação')->>'body')='Primeira anotação','append returns inserted private note');
select pg_temp.assert_true((public.add_professional_student_note('10290200-0000-0000-0000-000000000003','Segunda anotação')->>'body')='Segunda anotação','second append preserves independent note');
select pg_temp.assert_true(jsonb_array_length(public.list_professional_student_notes('10290200-0000-0000-0000-000000000003'))=2,'append keeps both notes');
select pg_temp.assert_true(public.list_professional_student_notes('10290200-0000-0000-0000-000000000003')->0->>'body'='Segunda anotação','notes order newest first');
select pg_temp.assert_true(public.list_professional_student_notes('10290200-0000-0000-0000-000000000003')->1->>'body'='Primeira anotação','older note remains available');
select pg_temp.assert_true((public.list_professional_student_notes('10290200-0000-0000-0000-000000000003')->0->>'created_at')::timestamptz is not null,'note returns timestamp');
select pg_temp.expect_error($q$select public.add_professional_student_note('10290200-0000-0000-0000-000000000003',repeat('x',2001))$q$,'22023');
select pg_temp.expect_error($q$select public.add_professional_student_note('10290200-0000-0000-0000-000000000003','   ')$q$,'22023');
select pg_temp.expect_error($q$select * from public.professional_student_note_entries$q$,'42501');
select pg_temp.expect_error($q$insert into public.professional_student_note_entries(professional_id,student_id,body) values(auth.uid(),'10290200-0000-0000-0000-000000000003','bypass')$q$,'42501');
select pg_temp.expect_error($q$select public.list_professional_student_notes('10290200-0000-0000-0000-000000000004')$q$,'42501');
select pg_temp.expect_error($q$select public.add_professional_student_note('10290200-0000-0000-0000-000000000004','revoked')$q$,'42501');
set local request.jwt.claim.sub='10290200-0000-0000-0000-000000000002';
select pg_temp.expect_error($q$select public.list_professional_student_notes('10290200-0000-0000-0000-000000000003')$q$,'42501');
set local request.jwt.claim.sub='10290200-0000-0000-0000-000000000004';
select pg_temp.expect_error($q$select public.list_professional_student_notes('10290200-0000-0000-0000-000000000003')$q$,'42501');
rollback;
select '1..1';
select 'ok 1 - private note entries, relationship authorization and timestamped append contract';
