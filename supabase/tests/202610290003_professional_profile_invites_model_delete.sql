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
set local role authenticated;
set local request.jwt.claim.sub='10290300-0000-0000-0000-000000000001';
select pg_temp.assert_true((public.save_professional_profile(auth.uid(),'Ana Silva Nova','Bio nova',array['força'],'São Paulo','CREF','123')).professional_name='Ana Silva Nova','owner can update editable fields');
select pg_temp.assert_true((select verification_status='unverified' and created_at='2026-10-01 12:00:00+00'::timestamptz from public.professional_profiles where user_id=auth.uid()),'verification and creation timestamp remain server managed');
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
begin;
create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'assertion failed: %',message; end if; end $$;
create function pg_temp.expect_error(command text, expected text) returns void language plpgsql as $$
declare actual text;
begin begin execute command; exception when others then get stacked diagnostics actual = returned_sqlstate; end;
 if actual is distinct from expected then raise exception 'expected SQLSTATE %, got % for %',expected,actual,command; end if;
end $$;
insert into auth.users(id) values
 ('10290310-0000-0000-0000-000000000001'),('10290310-0000-0000-0000-000000000002'),
 ('10290310-0000-0000-0000-000000000003'),('10290310-0000-0000-0000-000000000004'),
 ('10290310-0000-0000-0000-000000000005'),('10290310-0000-0000-0000-000000000006'),
 ('10290310-0000-0000-0000-000000000007'),('10290310-0000-0000-0000-000000000008');
insert into public.user_roles(user_id,role) values
 ('10290310-0000-0000-0000-000000000001','professional'),('10290310-0000-0000-0000-000000000002','professional'),
 ('10290310-0000-0000-0000-000000000003','professional'),('10290310-0000-0000-0000-000000000004','professional');
insert into public.professional_invites(professional_user_id,kind,code,token_hash) values
 ('10290310-0000-0000-0000-000000000004','code','JOAOSILVA','manual-generated-reservation');
insert into public.professional_profiles(user_id,professional_name) values
 ('10290310-0000-0000-0000-000000000001','Ana de Souza'),
 ('10290310-0000-0000-0000-000000000002','Ana de Souza'),
 ('10290310-0000-0000-0000-000000000003','Ágata Lima'),
 ('10290310-0000-0000-0000-000000000004','João Silva');
select pg_temp.assert_true((select code='LEGACYPRO' from public.professional_invites where professional_user_id='10290299-0000-0000-0000-000000000001' and is_personal),'existing profile receives backfilled code');
select pg_temp.assert_true((select code='ANASOUZA' and is_personal and not is_custom from public.professional_invites where professional_user_id='10290310-0000-0000-0000-000000000001' and is_personal),'new profile receives first and last normalized code');
select pg_temp.assert_true((select code='ANASOUZA2' from public.professional_invites where professional_user_id='10290310-0000-0000-0000-000000000002' and is_personal),'automatic collision uses numeric suffix');
select pg_temp.assert_true((select code='AGATALIMA' from public.professional_invites where professional_user_id='10290310-0000-0000-0000-000000000003' and is_personal),'Portuguese accents normalize to ASCII');
set local role authenticated;
set local request.jwt.claim.sub='10290310-0000-0000-0000-000000000003';
select public.save_professional_profile(auth.uid(),'Bia Carvalho',null,'{}',null,null,null);
select pg_temp.assert_true((select code='BIACARVALHO' and not is_custom from public.professional_invites where professional_user_id=auth.uid() and is_personal),'automatic code follows profile name changes');
reset role;
select pg_temp.assert_true((select code='JOAOSILVA2' from public.professional_invites where professional_user_id='10290310-0000-0000-0000-000000000004' and is_personal),'personal code avoids preexisting generated codes');
set local role authenticated;
set local request.jwt.claim.sub='10290310-0000-0000-0000-000000000001';
select pg_temp.assert_true((public.save_professional_personal_invite('Código Especial')).code='CODIGOESPECIAL','custom code normalizes accents and separators');
select pg_temp.expect_error($q$select public.save_professional_personal_invite('ANA SOUZA2')$q$,'P0001');
select pg_temp.assert_true((public.save_professional_profile(auth.uid(),'Ana Souza Nova',null,'{}',null,null,null)).professional_name='Ana Souza Nova','profile rename saves through the RPC');
select pg_temp.assert_true((select code='CODIGOESPECIAL' and is_custom from public.professional_invites where professional_user_id=auth.uid() and is_personal),'custom code stays stable after profile rename');
set local request.jwt.claim.sub='10290310-0000-0000-0000-000000000005';
select pg_temp.assert_true((public.accept_professional_invite('CODIGOESPECIAL')).student_user_id=auth.uid(),'first student accepts reusable code');
reset role;
select pg_temp.assert_true((select status='pending' and accepted_by is null from public.professional_invites where professional_user_id='10290310-0000-0000-0000-000000000001' and is_personal),'personal code remains available after acceptance');
set local role authenticated;
set local request.jwt.claim.sub='10290310-0000-0000-0000-000000000006';
select pg_temp.assert_true((public.accept_professional_invite('CODIGOESPECIAL')).student_user_id=auth.uid(),'second student accepts same reusable code');
set local request.jwt.claim.sub='10290310-0000-0000-0000-000000000005';
select pg_temp.assert_true((public.accept_professional_invite('CODIGOESPECIAL')).student_user_id=auth.uid(),'same student can restore their relationship');
reset role;
insert into public.professional_invites(professional_user_id,kind,code,token_hash) values
 ('10290310-0000-0000-0000-000000000001','code','ONCEONLY','individual-invite-hash');
set local role authenticated;
set local request.jwt.claim.sub='10290310-0000-0000-0000-000000000007';
select public.accept_professional_invite('ONCEONLY');
select pg_temp.expect_error($q$select public.accept_professional_invite('ONCEONLY')$q$,'22023');
reset role;
select pg_temp.assert_true((select status='active' and accepted_by='10290310-0000-0000-0000-000000000007' from public.professional_invites where code='ONCEONLY'),'individual invite remains single-use');
set local role authenticated;
set local request.jwt.claim.sub='10290310-0000-0000-0000-000000000001';
select pg_temp.expect_error($q$select public.revoke_professional_invite((select id from public.professional_invites where is_personal and professional_user_id=auth.uid()))$q$,'42501');
select pg_temp.assert_true((select status='pending' from public.professional_invites where is_personal and professional_user_id=auth.uid()),'personal codes cannot be revoked');
select pg_temp.assert_true((public.save_professional_personal_invite('CODIGO ESPECIAL')).is_custom,'personal code remains explicitly customized');
select pg_temp.expect_error($q$select public.save_professional_personal_invite('@@@')$q$,'22023');
set local request.jwt.claim.sub='10290310-0000-0000-0000-000000000008';
select pg_temp.expect_error($q$select public.save_professional_personal_invite('SEM PAPEL')$q$,'42501');
select pg_temp.assert_true((public.provision_professional_profile('Nova Lima')).professional_name='Nova Lima','professional provisioning remains functional');
select pg_temp.assert_true((select code='NOVALIMA' and is_personal from public.professional_invites where professional_user_id=auth.uid() and is_personal),'newly provisioned profiles receive a personal code');
rollback;
select '1..1';
select 'ok 1 - personal invite backfill, normalization, collisions, custom stability, reuse and individual invite compatibility';





