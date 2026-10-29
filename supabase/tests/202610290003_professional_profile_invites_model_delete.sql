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
 ('10290300-0000-0000-0000-000000000001'),('10290300-0000-0000-0000-000000000002'),('10290300-0000-0000-0000-000000000003'),('10290300-0000-0000-0000-000000000004');
insert into public.user_roles(user_id,role) values
 ('10290300-0000-0000-0000-000000000001','professional'),
 ('10290300-0000-0000-0000-000000000002','professional'),
 ('10290300-0000-0000-0000-000000000004','professional');
insert into public.professional_profiles(user_id,professional_name,verification_status,created_at) values
 ('10290300-0000-0000-0000-000000000001','Ana Silva','unverified','2026-10-01 12:00:00+00'),
 ('10290300-0000-0000-0000-000000000002','Bruno Lima','unverified','2026-10-02 12:00:00+00');
set local role service_role;
update public.professional_profiles set verification_status='pending' where user_id='10290300-0000-0000-0000-000000000001';
update public.professional_profiles set verification_status='verified' where user_id='10290300-0000-0000-0000-000000000002';
reset role;
set local role authenticated;
set local request.jwt.claim.sub='10290300-0000-0000-0000-000000000001';
select pg_temp.assert_true((public.save_professional_profile(auth.uid(),'Ana Silva Nova','Bio nova',array['força'],'São Paulo','CREF','123')).professional_name='Ana Silva Nova','owner can update editable fields');
select pg_temp.assert_true((select verification_status='pending' and created_at='2026-10-01 12:00:00+00'::timestamptz from public.professional_profiles where user_id=auth.uid()),'verification and creation timestamp remain server managed');
select pg_temp.expect_error($q$select public.save_professional_profile('10290300-0000-0000-0000-000000000002','Bruno',null,'{}',null,null,null)$q$,'42501');
select pg_temp.expect_error($q$select public.save_professional_profile(auth.uid(),'   ',null,'{}',null,null,null)$q$,'22023');
select pg_temp.expect_error($q$select public.save_professional_profile(auth.uid(),'Ana',null,array['Força'],null,null,null)$q$,'22023');
select pg_temp.expect_error($q$update public.professional_profiles set professional_name='Bypass' where user_id=auth.uid()$q$,'42501');
set local request.jwt.claim.sub='10290300-0000-0000-0000-000000000004';
select pg_temp.expect_error($q$select public.save_professional_profile(auth.uid(),'Missing',null,'{}',null,null,null)$q$,'P0002');
set local request.jwt.claim.sub='10290300-0000-0000-0000-000000000003';
select pg_temp.expect_error($q$select public.save_professional_profile(auth.uid(),'Student',null,'{}',null,null,null)$q$,'42501');
rollback;
select '1..1';
select 'ok 1 - protected professional profile save contract and access controls';
