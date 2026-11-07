begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception '%', message; end if; end $$;
insert into auth.users(id,email) values ('11070001-0000-4000-8000-000000000001','Signup-Probe@example.test');
set local role anon;
select pg_temp.assert_true(public.check_email_registered(' signup-probe@EXAMPLE.test '),'anonymous signup detects normalized email');
select pg_temp.assert_true(not public.check_email_registered('missing@example.test'),'unknown email remains available');
reset role;
select pg_temp.assert_true(not has_function_privilege('anon','public.delete_my_account()','EXECUTE'),'signup schema access does not grant account deletion');
select pg_temp.assert_true(not has_table_privilege('anon','public.profiles','SELECT'),'signup schema access does not grant private profile reads');
set local role authenticated;
set local request.jwt.claim.sub='11070001-0000-4000-8000-000000000001';
select pg_temp.assert_true(public.check_email_registered('signup-probe@example.test'),'active account can check email');
reset role;
update public.profiles set suspended_at=now() where id='11070001-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
  begin
    perform public.check_email_registered('signup-probe@example.test');
  exception when insufficient_privilege then
    if sqlerrm='account-inactive' then return; end if;
    raise;
  end;
  raise exception 'suspended account bypassed email lookup guard';
end $$;
reset role;
select pg_temp.assert_true(not exists(select 1 from public.account_activity_guard_gaps()),'email lookup leaves zero account activity guard gaps');
rollback;
