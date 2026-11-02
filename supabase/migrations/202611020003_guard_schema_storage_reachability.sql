begin;
-- Managed Storage metadata has grants but no permissive client policies: RLS
-- denies every operation. Report reachable operations, including any future
-- permissive policy. Public app tables and storage.objects retain strict checks.
create or replace function public.account_activity_guard_gaps()
returns table(object_type text,object_name text,reason text)
language sql stable security invoker set search_path='' as $$
 with client_tables as (
  select c.oid,n.nspname,c.relname,c.relrowsecurity,
   (has_table_privilege('authenticated',c.oid,'SELECT') and
    (n.nspname='public' or c.relname='objects' or not c.relrowsecurity or exists(
     select 1 from pg_policy accessible where accessible.polrelid=c.oid
      and accessible.polpermissive and accessible.polcmd in ('*','r')
      and (0=any(accessible.polroles) or (select oid from pg_roles where rolname='authenticated')=any(accessible.polroles))
    ))) can_read,
   (has_table_privilege('authenticated',c.oid,'INSERT') and
    (n.nspname='public' or c.relname='objects' or not c.relrowsecurity or exists(
     select 1 from pg_policy accessible where accessible.polrelid=c.oid
      and accessible.polpermissive and accessible.polcmd in ('*','a')
      and (0=any(accessible.polroles) or (select oid from pg_roles where rolname='authenticated')=any(accessible.polroles))
    ))) can_insert,
   (has_table_privilege('authenticated',c.oid,'UPDATE') and
    (n.nspname='public' or c.relname='objects' or not c.relrowsecurity or exists(
     select 1 from pg_policy accessible where accessible.polrelid=c.oid
      and accessible.polpermissive and accessible.polcmd in ('*','w')
      and (0=any(accessible.polroles) or (select oid from pg_roles where rolname='authenticated')=any(accessible.polroles))
    ))) can_update,
   (has_table_privilege('authenticated',c.oid,'DELETE') and
    (n.nspname='public' or c.relname='objects' or not c.relrowsecurity or exists(
     select 1 from pg_policy accessible where accessible.polrelid=c.oid
      and accessible.polpermissive and accessible.polcmd in ('*','d')
      and (0=any(accessible.polroles) or (select oid from pg_roles where rolname='authenticated')=any(accessible.polroles))
    ))) can_delete
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind in ('r','p') and (n.nspname='public' or n.nspname='storage')
   and has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE')
 ), policies as (
  select p.*,coalesce(pg_get_expr(p.polqual,p.polrelid),'') using_expression
  from pg_policy p
  where 0=any(p.polroles) or (select oid from pg_roles where rolname='authenticated')=any(p.polroles)
 ), findings as (
  select 'rpc'::text kind,p.oid::regprocedure::text identity,'missing explicit account activity assertion'::text detail
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind='f' and p.prorettype not in ('trigger'::regtype,'event_trigger'::regtype)
   and has_function_privilege('authenticated',p.oid,'EXECUTE')
   -- Guard primitives deliberately inspect an inactive account. Never recurse into themselves.
   and p.proname not in ('account_is_active','assert_account_active','is_current_user_suspended')
   and p.prosrc !~ '(^|[^a-zA-Z_])assert_account_active[[:space:]]*\('
   and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
  union all
  select 'table',format('%I.%I',t.nspname,t.relname),'authenticated access without RLS'
  from client_tables t where not t.relrowsecurity
  union all
  select 'table',format('%I.%I',t.nspname,t.relname),'authenticated reads lack an account activity policy'
  from client_tables t where t.can_read and t.relrowsecurity
   and not exists(select 1 from policies p where p.polrelid=t.oid and p.polcmd in ('*','r') and not p.polpermissive
    and p.using_expression ~ '(^|[^a-zA-Z_])account_is_active[[:space:]]*\(')
   and (not exists(select 1 from policies p where p.polrelid=t.oid and p.polcmd in ('*','r') and p.polpermissive)
    or exists(select 1 from policies p where p.polrelid=t.oid and p.polcmd in ('*','r') and p.polpermissive
     and p.using_expression !~ '(^|[^a-zA-Z_])account_is_active[[:space:]]*\('))
  union all
  select 'table',format('%I.%I',t.nspname,t.relname),'authenticated '||op.operation||' lacks a BEFORE activity guard'
  from client_tables t cross join lateral (values ('INSERT',4,t.can_insert),('UPDATE',16,t.can_update),('DELETE',8,t.can_delete)) op(operation,bit,allowed)
  where op.allowed and not exists(
   select 1 from pg_trigger g join pg_proc p on p.oid=g.tgfoid
   where g.tgrelid=t.oid and not g.tgisinternal and g.tgenabled in ('O','A')
    and (g.tgtype::int&2)=2 and (g.tgtype::int&op.bit)=op.bit
    and p.prosrc ~ '(^|[^a-zA-Z_])assert_account_active[[:space:]]*\('
  )
  union all
  select 'rpc',p.oid::regprocedure::text,'missing explicit community access assertion'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'community\_%' escape '\'
   and p.prokind='f' and p.prorettype<>'trigger'::regtype
   and has_function_privilege('authenticated',p.oid,'EXECUTE')
   -- Exact enforcement primitives and restricted-account recovery RPC exceptions.
   -- Each still requires assert_account_active under the preceding account check.
   and p.proname not in ('community_access_allowed','community_assert_access','community_access_status','community_acknowledge_restriction')
   and p.prosrc !~ '(^|[^a-zA-Z_])community_assert_access[[:space:]]*\('
  union all
  select 'table',format('%I.%I',t.nspname,t.relname),'authenticated community access lacks restrictive access policy'
  from client_tables t where t.nspname='public' and t.relname like 'community\_%' escape '\'
   and not exists(select 1 from policies p where p.polrelid=t.oid and not p.polpermissive and p.polcmd='*'
    and p.using_expression ~ '(^|[^a-zA-Z_])community_access_allowed[[:space:]]*\(')
 ) select kind,identity,detail from findings order by kind,identity,detail;
$$;
revoke all on function public.account_activity_guard_gaps() from public,anon,authenticated;
grant execute on function public.account_activity_guard_gaps() to service_role;

commit;
