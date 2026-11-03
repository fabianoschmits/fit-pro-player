begin;
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$begin if not coalesce(ok,false) then raise exception '%',message; end if; end$$;
create function pg_temp.inactive(command text) returns void language plpgsql as $$
begin
 begin execute command; exception when insufficient_privilege then
  if sqlerrm='account-inactive' then return; end if; raise;
 end;
 raise exception 'profile suspension bypass: %',command;
end$$;
insert into auth.users(id) values('11030317-4500-4000-8000-000000000001'),('11030317-4500-4000-8000-000000000002');
insert into public.user_roles(user_id,role) values('11030317-4500-4000-8000-000000000002','admin');
set local role authenticated;
set local request.jwt.claim.sub='11030317-4500-4000-8000-000000000001';
select public.provision_professional_profile('Original',null,array['força'],null,null,null,'SP','São Paulo','Centro');
select public.save_professional_profile(auth.uid(),'Editado','Bio editada',array['lecionar pilates'],null,null,null,'SC','Florianópolis','Centro');
select public.provision_professional_profile('Cadastro antigo',null,'{}',null,null,null,'SP','São Paulo','Bairro antigo');
select pg_temp.assert_true((select professional_name='Editado' and bio='Bio editada' and specialties=array['lecionar pilates'] and state_uf='SC' and city_name='Florianópolis' from public.professional_profiles where user_id=auth.uid()),'reopening preserves edited professional profile and location');
reset role;
update public.profiles set suspended_at=now() where id in('11030317-4500-4000-8000-000000000001','11030317-4500-4000-8000-000000000002');
set local role authenticated;
select pg_temp.inactive($q$select public.provision_professional_profile('Blocked')$q$);
select pg_temp.inactive($q$select public.save_professional_profile(auth.uid(),'Blocked',null,'{}',null,null,null)$q$);
select pg_temp.inactive($q$select public.ops_update_professional_profile('11030317-4500-4000-8000-000000000001','Blocked')$q$);
set local request.jwt.claim.sub='11030317-4500-4000-8000-000000000002';
select pg_temp.assert_true(public.account_is_active(),'existing administrator recovery exemption is preserved');
select public.ops_update_professional_profile('11030317-4500-4000-8000-000000000001','Admin edit');
reset role;
select pg_temp.assert_true(not exists(select 1 from public.account_activity_guard_gaps()),'new profile overloads have zero account activity guard gaps');
rollback;
