-- Behavioral assertions for a disposable database. All fixtures roll back.
\set ON_ERROR_STOP on
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
 ('91000000-0000-0000-0000-000000000001'), ('91000000-0000-0000-0000-000000000002'),
 ('91000000-0000-0000-0000-000000000003'), ('91000000-0000-0000-0000-000000000004'),
 ('91000000-0000-0000-0000-000000000005'), ('91000000-0000-0000-0000-000000000006');
insert into public.user_roles(user_id, role) values
 ('91000000-0000-0000-0000-000000000001', 'professional'),
 ('91000000-0000-0000-0000-000000000002', 'professional'),
 ('91000000-0000-0000-0000-000000000003', 'professional'),
 ('91000000-0000-0000-0000-000000000004', 'professional');
insert into public.professional_profiles(user_id, professional_name, bio, specialties, city_region, registration_type, registration_number) values
 ('91000000-0000-0000-0000-000000000001', 'Ana', 'Força adaptada', '{força}', 'São Paulo', 'CREF', '123'),
 ('91000000-0000-0000-0000-000000000002', 'Bia', 'Mobilidade', '{mobilidade}', 'Campinas', 'CREF', '456'),
 ('91000000-0000-0000-0000-000000000003', 'Revogada', null, '{}', null, null, null),
 ('91000000-0000-0000-0000-000000000004', 'Pendente', null, '{}', null, null, null);
insert into public.professional_student_relationships(id, professional_user_id, student_user_id, status, created_at, accepted_at) values
 ('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000005', 'active', '2026-09-28T00:00:00Z', '2026-10-01T00:00:00Z'),
 ('92000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000005', 'active', '2026-10-02T00:00:00Z', null),
 ('92000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000005', 'revoked', now(), null),
 ('92000000-0000-0000-0000-000000000004', '91000000-0000-0000-0000-000000000004', '91000000-0000-0000-0000-000000000005', 'pending', now(), null),
 ('92000000-0000-0000-0000-000000000006', '91000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000006', 'active', now(), null);
insert into public.programs(id, professional_user_id, title, description) values
 ('93000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'Força Ana', 'Base'),
 ('93000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000002', 'Mobilidade Bia', 'Leve'),
 ('93000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000003', 'Revogado', null);
insert into public.program_versions(id, program_id, version_number, weekly_plan, published_at) values
 ('94000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', 1, '{"monday":[{"exerciseId":"squat","sets":3,"reps":10,"notes":"Controle"}]}', now()),
 ('94000000-0000-0000-0000-000000000002', '93000000-0000-0000-0000-000000000002', 1, '{"friday":[{"exerciseId":"stretch","sets":2,"reps":8}]}', now()),
 ('94000000-0000-0000-0000-000000000003', '93000000-0000-0000-0000-000000000001', 2, '{"monday":[{"exerciseId":"press","sets":2,"reps":8}]}', now()),
 ('94000000-0000-0000-0000-000000000004', '93000000-0000-0000-0000-000000000001', 3, '{}', null),
 ('94000000-0000-0000-0000-000000000005', '93000000-0000-0000-0000-000000000001', 4, '{}', now()),
 ('94000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000003', 1, '{}', now());
insert into public.program_assignments(id, program_id, version_id, professional_user_id, student_user_id, status, created_at) values
 ('95000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000005', 'active', '2026-10-03T00:00:00Z'),
 ('95000000-0000-0000-0000-000000000002', '93000000-0000-0000-0000-000000000002', '94000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000005', 'revoked', '2026-10-02T00:00:00Z'),
 ('95000000-0000-0000-0000-000000000003', '93000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000005', 'revoked', '2026-10-01T00:00:00Z'),
 ('95000000-0000-0000-0000-000000000004', '93000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000004', '91000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000005', 'revoked', now()),
 ('95000000-0000-0000-0000-000000000005', '93000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000006', 'active', now()),
 ('95000000-0000-0000-0000-000000000006', '93000000-0000-0000-0000-000000000003', '94000000-0000-0000-0000-000000000006', '91000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000005', 'revoked', now());
insert into public.workout_executions(id, assignment_id, version_id, student_user_id, day_key, status, payload, started_at, completed_at) values
 ('96000000-0000-0000-0000-000000000001', '95000000-0000-0000-0000-000000000001', '94000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000005', 'monday', 'completed', '{"sets":3}', '2026-10-04T10:00Z', '2026-10-04T11:00Z'),
 ('96000000-0000-0000-0000-000000000002', '95000000-0000-0000-0000-000000000002', '94000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000005', 'friday', 'abandoned', '{}', '2026-10-03T10:00Z', '2026-10-03T11:00Z'),
 ('96000000-0000-0000-0000-000000000003', '95000000-0000-0000-0000-000000000003', '94000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000005', 'monday', 'completed', '{}', '2026-10-02T10:00Z', '2026-10-02T11:00Z'),
 ('96000000-0000-0000-0000-000000000004', '95000000-0000-0000-0000-000000000004', '94000000-0000-0000-0000-000000000004', '91000000-0000-0000-0000-000000000005', 'monday', 'completed', '{}', now(), now()),
 ('96000000-0000-0000-0000-000000000005', '95000000-0000-0000-0000-000000000005', '94000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000006', 'monday', 'completed', '{}', now(), now()),
 ('96000000-0000-0000-0000-000000000006', '95000000-0000-0000-0000-000000000006', '94000000-0000-0000-0000-000000000006', '91000000-0000-0000-0000-000000000005', 'monday', 'completed', '{}', now(), now());
insert into public.workout_executions(id, student_user_id, day_key, status, prescription_snapshot) values
 ('96000000-0000-0000-0000-000000000007', '91000000-0000-0000-0000-000000000005', 'monday', 'completed', '{"programTitle":"Detached personal history"}');

-- Check real grants and fixed paths, not just migration text.
select pg_temp.assert_true(not has_function_privilege('anon', 'public.student_professional_summaries()', 'execute') and not has_function_privilege('anon', 'public.student_professional_detail(uuid)', 'execute'), 'anonymous execute revoked');
select pg_temp.assert_true(has_function_privilege('authenticated', 'public.student_professional_summaries()', 'execute') and has_function_privilege('authenticated', 'public.student_professional_detail(uuid)', 'execute'), 'authenticated execute granted');
select pg_temp.assert_true((select count(*)=2 and bool_and(prosecdef and proconfig @> array['search_path=public, pg_temp']) from pg_proc where oid in ('public.student_professional_summaries()'::regprocedure, 'public.student_professional_detail(uuid)'::regprocedure)), 'definer functions fix search_path');
set local role anon;
set local request.jwt.claim.sub='';
select pg_temp.expect_error($q$select * from public.student_professional_summaries()$q$, '42501');
select pg_temp.expect_error($q$select * from public.student_professional_detail('91000000-0000-0000-0000-000000000001')$q$, '42501');
set local role authenticated;
select pg_temp.expect_error($q$select * from public.student_professional_summaries()$q$, '42501');
select pg_temp.expect_error($q$select * from public.student_professional_detail('91000000-0000-0000-0000-000000000001')$q$, '42501');
set local request.jwt.claim.sub='91000000-0000-0000-0000-000000000005';
select pg_temp.assert_true((select count(*)=2 from public.student_professional_summaries()), 'only two active linked professionals visible');
select pg_temp.assert_true((select professional_name='Ana' and bio='Força adaptada' and specialties=array['força'] and city_region='São Paulo' and registration_type='CREF' and registration_number='123' and verification_status='unverified' and relationship_id='92000000-0000-0000-0000-000000000001' and linked_at='2026-10-01T00:00:00Z'::timestamptz and active_program_title='Força Ana' from public.student_professional_summaries() where professional_user_id='91000000-0000-0000-0000-000000000001'), 'Ana summary includes her complete profile, accepted date and active title');
select pg_temp.assert_true((select professional_name='Bia' and bio='Mobilidade' and city_region='Campinas' and linked_at='2026-10-02T00:00:00Z'::timestamptz and active_program_title is null from public.student_professional_summaries() where professional_user_id='91000000-0000-0000-0000-000000000002'), 'Bia summary stays independent and falls back to created date');
select pg_temp.assert_true((select count(*)=0 from public.professional_profiles), 'student still cannot select linked professional profiles directly');
select pg_temp.assert_true((select professional->>'professional_user_id'='91000000-0000-0000-0000-000000000001' and professional->>'professional_name'='Ana' and relationship->>'id'='92000000-0000-0000-0000-000000000001' and relationship->>'status'='active' and (relationship->>'linked_at')::timestamptz='2026-10-01T00:00:00Z'::timestamptz from public.student_professional_detail('91000000-0000-0000-0000-000000000001')), 'detail identifies selected professional and caller relationship');
select pg_temp.assert_true((select jsonb_array_length(materials)=2 and materials->0->>'assignment_id'='95000000-0000-0000-0000-000000000001' and materials->0->>'status'='active' and materials->1->>'status'='revoked' and materials->0->>'title'='Força Ana' and materials->0->>'description'='Base' and materials->0->>'version_number'='1' and materials->0->>'published_at' is not null and materials->0->>'assigned_at' is not null and materials->0->'weekly_plan'->'monday'->0->>'notes'='Controle' from public.student_professional_detail('91000000-0000-0000-0000-000000000001')), 'only caller assigned published Ana versions, with assignment status and full instructions');
select pg_temp.assert_true((select jsonb_array_length(executions)=2 and executions->0->>'id'='96000000-0000-0000-0000-000000000001' and executions->1->>'id'='96000000-0000-0000-0000-000000000003' and executions->0->>'status'='completed' and executions->0->'payload'='{"sets":3}'::jsonb and executions->0->>'program_title'='Força Ana' from public.student_professional_detail('91000000-0000-0000-0000-000000000001')), 'Ana history excludes Bia, other student, unpublished, revoked professional and detached history');
select pg_temp.assert_true((select jsonb_array_length(materials)=1 and materials->0->>'title'='Mobilidade Bia' and materials->0->>'status'='revoked' and jsonb_array_length(executions)=1 and executions->0->>'id'='96000000-0000-0000-0000-000000000002' from public.student_professional_detail('91000000-0000-0000-0000-000000000002')), 'Bia has independent historical material and execution');
select pg_temp.assert_true((select count(*)=0 from public.student_professional_detail('91000000-0000-0000-0000-000000000003')), 'revoked professional detail hidden');
select pg_temp.assert_true((select count(*)=0 from public.student_professional_detail('91000000-0000-0000-0000-000000000004')), 'pending professional detail hidden');
select pg_temp.assert_true((select count(*)=0 from public.student_professional_detail('91000000-0000-0000-0000-000000000006')), 'unlinked person detail hidden');
select pg_temp.assert_true((select count(*)=0 from public.student_professional_detail(null)), 'null selection has no detail');

set local request.jwt.claim.sub='91000000-0000-0000-0000-000000000006';
select pg_temp.assert_true((select count(*)=1 from public.student_professional_summaries()), 'another student sees only their link');
select pg_temp.assert_true((select count(*)=0 from public.student_professional_detail('91000000-0000-0000-0000-000000000002')), 'another student cannot select first students linked Bia');
select pg_temp.assert_true((select jsonb_array_length(materials)=1 and materials->0->>'assignment_id'='95000000-0000-0000-0000-000000000005' and jsonb_array_length(executions)=1 and executions->0->>'id'='96000000-0000-0000-0000-000000000005' from public.student_professional_detail('91000000-0000-0000-0000-000000000001')), 'same professional is independently scoped to second student');
set local request.jwt.claim.sub='91000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select count(*)=0 from public.student_professional_summaries()), 'account with no student links gets empty summaries');
select pg_temp.assert_true((select count(*)=1 and bool_and(user_id=auth.uid()) from public.professional_profiles), 'professional retains own-profile-only direct reads');

set local request.jwt.claim.sub='91000000-0000-0000-0000-000000000005';
select public.revoke_professional_relationship('92000000-0000-0000-0000-000000000001');
select pg_temp.assert_true((select count(*)=1 from public.student_professional_summaries()), 'revocation immediately removes professional summary');
select pg_temp.assert_true((select count(*)=0 from public.student_professional_detail('91000000-0000-0000-0000-000000000001')), 'revocation immediately removes professional detail');
select pg_temp.assert_true((select count(*)=6 from public.workout_executions where student_user_id=auth.uid()), 'existing personal history survives revocation');
rollback;
