-- Full workflow with real RPCs/RLS. Disposable database only; all fixtures roll back.
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
 ('00000000-0000-0000-0000-000000000061'),
 ('00000000-0000-0000-0000-000000000062'),
 ('00000000-0000-0000-0000-000000000063');
create temp table flow_invites as select * from public.professional_invites with no data;
create temp table flow_programs as select * from public.programs with no data;
create temp table flow_versions as select * from public.program_versions with no data;
grant all on flow_invites, flow_programs, flow_versions to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000061';
select pg_temp.expect_error($q$select public.create_professional_invite('code')$q$, '42501');
select public.provision_professional_profile('Profissional do teste de convites');
select pg_temp.assert_true((select count(*)=1 from public.user_roles where user_id=auth.uid() and role='professional'), 'profile provisioning grants professional capability');
insert into flow_invites select * from public.create_professional_invite('code');
insert into flow_invites select * from public.create_professional_invite('link');
select pg_temp.assert_true((select count(*)=2 and count(distinct code)=2 and bool_and(code ~ '^[A-F0-9]{10}$') from flow_invites), 'both invitation kinds generate distinct usable codes');
select pg_temp.expect_error($q$select public.accept_professional_invite((select code from flow_invites where kind='code'))$q$, '22023');
insert into flow_programs select * from public.create_program('Treino enviado por convite');
insert into flow_versions select * from public.publish_program_version_with_titles(
 (select id from flow_programs),
 '{"monday":[{"exerciseId":"0025","sets":3,"reps":10,"load":25,"rest":90}]}',
 '{"monday":"Treino A"}');
select pg_temp.expect_error($q$select public.assign_program_version((select id from flow_programs),(select id from flow_versions),'00000000-0000-0000-0000-000000000062')$q$, '42501');

set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000062';
select pg_temp.assert_true((select professional_name='Profissional do teste de convites' from public.preview_professional_invite('  ' || lower((select code from flow_invites where kind='code')) || '  ')), 'client previews the issuing professional with normalized code');
select public.accept_professional_invite((select code from flow_invites where kind='code'));
select pg_temp.assert_true((select count(*)=1 from public.student_professional_summaries()), 'accepted professional appears in client management');
select pg_temp.expect_error($q$select public.accept_professional_invite((select code from flow_invites where kind='code'))$q$, '22023');
select pg_temp.expect_error($q$select public.create_professional_invite('code')$q$, '42501');

set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000063';
select pg_temp.assert_true((select count(*)=0 from public.student_professional_summaries()), 'third party cannot see client relationships');
select pg_temp.expect_error($q$select public.accept_professional_invite((select code from flow_invites where kind='code'))$q$, '22023');
select pg_temp.expect_error($q$select public.revoke_professional_invite((select id from flow_invites where kind='link'))$q$, '42501');

set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000061';
select pg_temp.assert_true((select status='active' and accepted_by='00000000-0000-0000-0000-000000000062' from public.professional_invites where kind='code'), 'accepted invite persists actual active status and recipient');
select public.assign_program_version((select id from flow_programs),(select id from flow_versions),'00000000-0000-0000-0000-000000000062');
select public.revoke_professional_invite((select id from flow_invites where kind='link'));
select pg_temp.assert_true((select status='revoked' from public.professional_invites where kind='link'), 'cancelled invite persists actual revoked status');

set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000062';
select pg_temp.assert_true((select count(*)=0 from public.preview_professional_invite((select code from flow_invites where kind='link'))), 'revoked invite is unavailable');
select pg_temp.expect_error($q$select public.accept_professional_invite((select code from flow_invites where kind='link'))$q$, '22023');
select pg_temp.assert_true(public.student_program_overview()->'version'->>'id'=(select id::text from flow_versions), 'client receives exactly the assigned version');
select pg_temp.assert_true((select materials->0->'weekly_plan'->'monday'->0->>'load'='25' from public.student_professional_detail('00000000-0000-0000-0000-000000000061')), 'received material preserves prescribed load');
select public.start_workout_execution('40000000-0000-0000-0000-000000000062',(select id from public.program_assignments where status='active'),'monday');
select public.complete_workout_execution('40000000-0000-0000-0000-000000000062','{"sets":3}');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000061';
select pg_temp.assert_true((select count(*)=1 from public.workout_executions where student_user_id='00000000-0000-0000-0000-000000000062' and status='completed'), 'professional can follow linked client execution');

-- Expiration and anonymous guards, followed by client-initiated unlinking.
reset role;
update public.professional_invites set status='pending', expires_at=now()-interval '1 minute' where id=(select id from flow_invites where kind='link');
set local role authenticated;
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000000062';
select pg_temp.assert_true((select count(*)=0 from public.preview_professional_invite((select code from flow_invites where kind='link'))), 'expired invite cannot be previewed');
select pg_temp.expect_error($q$select public.accept_professional_invite((select code from flow_invites where kind='link'))$q$, '22023');
select public.revoke_professional_relationship((select id from public.professional_student_relationships where professional_user_id='00000000-0000-0000-0000-000000000061'));
select pg_temp.assert_true(public.student_program_overview()='{}'::jsonb, 'unlinking removes active training');
select pg_temp.assert_true((select count(*)=0 from public.student_professional_summaries()), 'unlinking removes professional from client management');
set local role anon;
select pg_temp.expect_error($q$select public.create_professional_invite('code')$q$, '42501');
select pg_temp.expect_error($q$select public.accept_professional_invite('INVALID')$q$, '42501');
select pg_temp.expect_error($q$select public.provision_professional_profile('Anonymous')$q$, '42501');
rollback;
