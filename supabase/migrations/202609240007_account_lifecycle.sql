-- Delete the authenticated caller and all owner-scoped rows that reference it.
-- The browser only receives this narrow RPC; it never receives service_role.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'authenticated identity required' using errcode = '42501';
  end if;

  delete from auth.users where id = caller;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
