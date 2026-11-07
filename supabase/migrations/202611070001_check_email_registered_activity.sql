begin;
-- Signup remains available anonymously. An existing authenticated session must
-- respect the same account activity guard as the other application RPCs.
create or replace function public.check_email_registered(p_email text)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is not null then perform public.assert_account_active(); end if;
  return exists(select 1 from auth.users where lower(email)=lower(trim(p_email)));
end $$;
revoke all on function public.check_email_registered(text) from public;
grant usage on schema public to anon;
grant execute on function public.check_email_registered(text) to anon,authenticated,service_role;
commit;
