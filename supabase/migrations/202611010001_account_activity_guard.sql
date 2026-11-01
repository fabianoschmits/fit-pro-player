begin;
-- The role setting survives SECURITY DEFINER calls; current_user does not.
create function public.account_is_active() returns boolean
language sql stable security definer set search_path = '' set row_security = off as $$
 select case
 when coalesce(nullif(current_setting('role',true),''),'none') in ('none','service_role','supabase_admin') then true
 when auth.uid() is null then false
 else exists(select 1 from public.profiles p where p.id=auth.uid() and p.suspended_at is null)
   or exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='admin') end
$$;
create function public.assert_account_active() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.account_is_active() then
  -- Account deletion cascades may run after the caller's auth row has been removed.
  -- A direct RPC with the old token still has trigger depth zero and is rejected.
  if pg_trigger_depth()>0 and auth.uid() is not null and not exists(select 1 from auth.users where id=auth.uid()) then return; end if;
  raise exception 'account-inactive' using errcode='42501';
 end if;
end $$;
revoke all on function public.account_is_active(), public.assert_account_active() from public, anon;
grant execute on function public.account_is_active(), public.assert_account_active() to authenticated,service_role;

-- Restrictive policies combine with every existing ownership/capability policy, never replace them.
-- Trigger enforcement also covers SECURITY DEFINER mutations which bypass RLS.
create function public.enforce_account_active() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 perform public.assert_account_active();
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.enforce_account_active() from public,anon,authenticated;
do $guard$
declare item record; definition text; body text; guarded text;
begin
 for item in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where c.relkind='r' and (n.nspname='public' or (n.nspname='storage' and c.relname='objects')) loop
  execute format('create trigger enforce_active_account before insert or update or delete on %I.%I for each row execute function public.enforce_account_active()',item.nspname,item.relname);
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=item.nspname and c.relname=item.relname and c.relrowsecurity) then
   execute format('create policy active_account_required on %I.%I as restrictive for all to authenticated using ((select public.account_is_active())) with check ((select public.account_is_active()))',item.nspname,item.relname);
  end if;
 end loop;
 -- Guard authenticated PL/pgSQL RPCs at entry, including no-op writes and nested calls.
 -- Trigger functions are excluded; their actor can be an auth/service process.
 for item in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
 where n.nspname='public' and l.lanname='plpgsql' and p.prokind='f' and p.prorettype<>'trigger'::regtype
 and p.proname not in ('assert_account_active','account_is_active','is_current_user_suspended')
 and has_function_privilege('authenticated',p.oid,'execute') loop
  definition:=pg_get_functiondef(item.oid);
  definition:=regexp_replace(definition, '\m[Bb][Ee][Gg][Ii][Nn]\M', 'BEGIN PERFORM public.assert_account_active();');
  execute definition;
 end loop;
 -- Actor-specific SQL SECURITY DEFINER reads also need an entry check: their owner bypasses RLS.
 for item in select p.*,t.typtype from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 join pg_language l on l.oid=p.prolang join pg_type t on t.oid=p.prorettype
 where n.nspname='public' and l.lanname='sql' and p.prosecdef and p.prokind='f'
 and p.proname not in ('account_is_active','is_current_user_suspended')
 and p.prosrc ~ 'auth[.]uid' and p.prorettype<>'void'::regtype
 and has_function_privilege('authenticated',p.oid,'execute') loop
  definition:=pg_get_functiondef(item.oid);
  body:=regexp_replace(btrim(item.prosrc),';[[:space:]]*$','');
  if item.proretset then guarded:='BEGIN PERFORM public.assert_account_active(); RETURN QUERY '||body||'; END';
  elsif item.typtype='c' then guarded:='DECLARE result '||format_type(item.prorettype,null)||'; BEGIN PERFORM public.assert_account_active(); SELECT q.* INTO result FROM ('||body||') q; RETURN result; END';
  else guarded:='BEGIN PERFORM public.assert_account_active(); RETURN ('||body||'); END'; end if;
  definition:=replace(definition,item.prosrc,guarded);
  definition:=replace(definition,'LANGUAGE sql','LANGUAGE plpgsql');
  execute definition;
 end loop;
end $guard$;
notify pgrst,'reload schema';
commit;
