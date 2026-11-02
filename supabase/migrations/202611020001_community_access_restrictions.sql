begin;

create table public.community_access_restrictions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 restriction_type text not null check (restriction_type in ('temporary','permanent')),
 reason text not null check (reason in ('spam','harassment','inappropriate','misinformation','abusive','repeated','other')),
 admin_message text not null default '' check (char_length(admin_message)<=500),
 source_ticket_id uuid references public.support_tickets(id) on delete set null,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default clock_timestamp(),
 starts_at timestamptz not null default clock_timestamp(), ends_at timestamptz,
 revoked_at timestamptz, revoked_by uuid references auth.users(id) on delete set null,
 revoke_reason text, acknowledged_at timestamptz,
 check ((restriction_type='permanent' and ends_at is null) or (restriction_type='temporary' and ends_at is not null and ends_at>starts_at))
);
create index community_restrictions_user_history on public.community_access_restrictions(user_id,created_at desc);
create index community_restrictions_open on public.community_access_restrictions(user_id,ends_at) where revoked_at is null;
alter table public.community_access_restrictions enable row level security;
revoke all on public.community_access_restrictions from public,anon,authenticated;
grant select,insert,update,delete on public.community_access_restrictions to service_role;
create trigger enforce_active_account before insert or update or delete on public.community_access_restrictions
 for each row execute function public.enforce_account_active();

-- Private predicate: callers cannot probe another account's moderation state.
create function public.community_user_access_allowed(p_user_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_user_id is not null and (
 exists(select 1 from public.user_roles where user_id=p_user_id and role='admin')
 or not exists(select 1 from public.community_access_restrictions r where r.user_id=p_user_id
  and r.revoked_at is null and r.starts_at<=statement_timestamp() and (r.ends_at is null or r.ends_at>statement_timestamp())))
$$;
revoke all on function public.community_user_access_allowed(uuid) from public,anon,authenticated,service_role;
create function public.community_access_allowed() returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 perform public.assert_account_active();
 if coalesce(nullif(current_setting('role',true),''),'none') in ('none','service_role','supabase_admin') then return true; end if;
 return public.community_user_access_allowed(auth.uid());
end $$;
create function public.community_assert_access() returns void
language plpgsql stable security definer set search_path='' as $$
begin
 perform public.assert_account_active();
 if not public.community_access_allowed() then raise exception 'community-access-restricted' using errcode='42501'; end if;
end $$;
revoke all on function public.community_access_allowed(),public.community_assert_access() from public,anon;
grant execute on function public.community_access_allowed(),public.community_assert_access() to authenticated,service_role;

create or replace function public.community_assert_can_interact(p_actor uuid,p_peer uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.assert_account_active();
 if not public.community_user_access_allowed(p_actor) or (p_peer is not null and not public.community_user_access_allowed(p_peer))
 or exists(select 1 from public.community_user_blocks where
 (blocker_id=p_actor and blocked_id=p_peer) or (blocker_id=p_peer and blocked_id=p_actor)) then
 raise exception 'interaction-unavailable' using errcode='42501'; end if;
end $$;
revoke all on function public.community_assert_can_interact(uuid,uuid) from public,anon,authenticated;

create function public.community_enforce_access() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient uuid;
begin
 perform public.assert_account_active();
 -- Only a nested account-deletion cascade after removal of the caller's auth row.
 if tg_op='DELETE' and pg_trigger_depth()>1 and auth.uid() is not null
 and not exists(select 1 from auth.users where id=auth.uid()) then return old; end if;
 perform public.community_assert_access();
 -- Notification recipients and DM recipients cannot receive new activity while restricted.
 if tg_op<>'DELETE' and tg_table_name in ('community_direct_messages','community_notifications') then
 recipient:=(to_jsonb(new)->>'recipient_id')::uuid;
 if not public.community_user_access_allowed(recipient) then raise exception 'interaction-unavailable' using errcode='42501'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
revoke all on function public.community_enforce_access() from public,anon,authenticated;

-- Every existing client entry point receives a guard, including SQL invoker reads.
-- Rewriting preserves signatures, grants and SECURITY DEFINER/INVOKER semantics.
do $guard$
declare item record; definition text; body text; guarded text;
begin
 for item in select p.*,l.lanname,t.typtype from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 join pg_language l on l.oid=p.prolang join pg_type t on t.oid=p.prorettype
 where n.nspname='public' and p.proname like 'community\_%' escape '\' and p.prokind='f'
 and p.prorettype<>'trigger'::regtype and has_function_privilege('authenticated',p.oid,'EXECUTE')
 and p.proname not in ('community_access_allowed','community_assert_access') loop
 definition:=pg_get_functiondef(item.oid);
 if item.lanname='plpgsql' then
 definition:=regexp_replace(definition,'\m[Bb][Ee][Gg][Ii][Nn]\M','BEGIN PERFORM public.assert_account_active(); PERFORM public.community_assert_access();');
 elsif item.lanname='sql' then
 body:=regexp_replace(btrim(item.prosrc),';[[:space:]]*$','');
 if item.proretset then guarded:='BEGIN PERFORM public.assert_account_active(); PERFORM public.community_assert_access(); RETURN QUERY '||body||'; END';
 elsif item.prorettype='void'::regtype then guarded:='BEGIN PERFORM public.assert_account_active(); PERFORM public.community_assert_access(); '||body||'; END';
 else guarded:='BEGIN PERFORM public.assert_account_active(); PERFORM public.community_assert_access(); RETURN ('||body||'); END'; end if;
 definition:=replace(replace(definition,item.prosrc,guarded),'LANGUAGE sql','LANGUAGE plpgsql');
 else raise exception 'unsupported community RPC language: %',item.proname; end if;
 execute definition;
 end loop;
 for item in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','p') and c.relname like 'community\_%' escape '\'
 and c.relname<>'community_access_restrictions' loop
 execute format('alter table public.%I enable row level security',item.relname);
 execute format('create policy community_access_required on public.%I as restrictive for all to authenticated using ((select public.community_access_allowed())) with check ((select public.community_access_allowed()))',item.relname);
 execute format('create trigger enforce_community_access before insert or update or delete on public.%I for each row execute function public.community_enforce_access()',item.relname);
 end loop;
end $guard$;

-- A public bucket bypasses SELECT policies. Authenticated downloads now enforce access.
update storage.buckets set public=false where id like 'community%';
create policy community_storage_access_required on storage.objects as restrictive for all to authenticated
 using (bucket_id not like 'community%' or (select public.community_access_allowed()))
 with check (bucket_id not like 'community%' or (select public.community_access_allowed()));
create policy community_storage_no_anonymous on storage.objects as restrictive for all to anon
 using (bucket_id not like 'community%') with check (bucket_id not like 'community%');
create function public.community_enforce_storage_access() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform public.assert_account_active();
 if (tg_op<>'INSERT' and old.bucket_id like 'community%') or (tg_op<>'DELETE' and new.bucket_id like 'community%') then
 perform public.community_assert_access(); end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
revoke all on function public.community_enforce_storage_access() from public,anon,authenticated;
create trigger enforce_community_storage_access before insert or update or delete on storage.objects
 for each row execute function public.community_enforce_storage_access();

-- Self-service responses deliberately omit ticket, administrator and reporter identity.
create function public.community_access_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.assert_account_active();
 select jsonb_build_object('id',r.id,'restriction_type',r.restriction_type,'reason',r.reason,
 'admin_message',r.admin_message,'starts_at',r.starts_at,'ends_at',r.ends_at,'acknowledged_at',r.acknowledged_at)
 into result from public.community_access_restrictions r where r.user_id=auth.uid()
 and not public.community_user_access_allowed(auth.uid()) and r.revoked_at is null
 and r.starts_at<=statement_timestamp() and (r.ends_at is null or r.ends_at>statement_timestamp())
 order by r.created_at desc,r.id desc limit 1;
 return jsonb_build_object('active',result);
end $$;
create function public.community_acknowledge_restriction(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.assert_account_active();
 update public.community_access_restrictions set acknowledged_at=coalesce(acknowledged_at,clock_timestamp())
 where id=p_id and user_id=auth.uid();
end $$;

create function public.ops_community_restrict_user(p_user_id uuid,p_duration text,p_reason text,p_admin_message text,p_source_ticket_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; stamp timestamptz:=clock_timestamp(); expiration timestamptz; result public.community_access_restrictions;
begin
 perform public.assert_account_active(); actor:=public.ops_require_admin();
 if p_user_id is null or p_duration is null or p_duration not in ('24h','3d','7d','30d','permanent')
 or p_reason is null or p_reason not in ('spam','harassment','inappropriate','misinformation','abusive','repeated','other')
 or char_length(coalesce(p_admin_message,''))>500 then raise exception 'invalid community restriction' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fitpp.community.restriction:'||p_user_id::text,0));
 perform 1 from public.profiles where id=p_user_id for update;
 if not found then raise exception 'user not found' using errcode='P0002'; end if;
 if exists(select 1 from public.user_roles where user_id=p_user_id and role='admin') then raise exception 'cannot restrict administrator' using errcode='42501'; end if;
 if p_source_ticket_id is not null and not exists(select 1 from public.community_report_context where ticket_id=p_source_ticket_id and reported_user_id=p_user_id) then
 raise exception 'report target mismatch' using errcode='22023'; end if;
 expiration:=case p_duration when '24h' then stamp+interval '24 hours' when '3d' then stamp+interval '3 days' when '7d' then stamp+interval '7 days' when '30d' then stamp+interval '30 days' end;
 -- Replacement is a revocation in every original report's administrative history.
 with revoked as (
 update public.community_access_restrictions set revoked_at=stamp,revoked_by=actor,revoke_reason='Replaced by new restriction'
 where user_id=p_user_id and revoked_at is null and (ends_at is null or ends_at>stamp)
 returning source_ticket_id
 ), tickets as (
 select distinct r.source_ticket_id as id from revoked r
 join public.community_report_context c on c.ticket_id=r.source_ticket_id and c.reported_user_id=p_user_id
 )
 insert into public.support_ticket_events(ticket_id,actor_id,event_type,to_value)
 select id,actor,'community_user_unrestricted',jsonb_build_object('user_id',p_user_id,'reason','Replaced by new restriction') from tickets;
 insert into public.community_access_restrictions(user_id,restriction_type,reason,admin_message,source_ticket_id,created_by,created_at,starts_at,ends_at)
 values(p_user_id,case when p_duration='permanent' then 'permanent' else 'temporary' end,p_reason,coalesce(p_admin_message,''),p_source_ticket_id,actor,stamp,stamp,expiration) returning * into result;
 if p_source_ticket_id is not null then
 insert into public.support_ticket_events(ticket_id,actor_id,event_type,to_value) values(p_source_ticket_id,actor,'community_user_restricted',jsonb_build_object('user_id',p_user_id,'restriction_id',result.id,'duration',p_duration,'reason',p_reason)); end if;
 return to_jsonb(result);
end $$;
create function public.ops_community_unrestrict_user(p_user_id uuid,p_reason text,p_source_ticket_id uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 perform public.assert_account_active(); actor:=public.ops_require_admin();
 if p_user_id is null or nullif(btrim(p_reason),'') is null or char_length(p_reason)>500 then raise exception 'revocation reason required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fitpp.community.restriction:'||p_user_id::text,0));
 if p_source_ticket_id is not null and not exists(select 1 from public.community_report_context where ticket_id=p_source_ticket_id and reported_user_id=p_user_id) then raise exception 'report target mismatch' using errcode='22023'; end if;
 -- Also write to each revoked restriction's original report, including profile/list actions.
 with revoked as (
 update public.community_access_restrictions set revoked_at=clock_timestamp(),revoked_by=actor,revoke_reason=btrim(p_reason)
 where user_id=p_user_id and revoked_at is null and (ends_at is null or ends_at>statement_timestamp())
 returning source_ticket_id
 ), tickets as (
 select r.source_ticket_id as id from revoked r
 join public.community_report_context c on c.ticket_id=r.source_ticket_id and c.reported_user_id=p_user_id
 union select p_source_ticket_id where p_source_ticket_id is not null
 )
 insert into public.support_ticket_events(ticket_id,actor_id,event_type,to_value)
 select id,actor,'community_user_unrestricted',jsonb_build_object('user_id',p_user_id,'reason',btrim(p_reason)) from tickets;
end $$;

-- Internal administrative projection, never exposed through table privileges.
create view public.community_restriction_admin_rows with (security_invoker=true) as
 select r.*,p.display_name,a.display_name as admin_name,
 case when r.revoked_at is not null then 'revoked' when r.ends_at<=statement_timestamp() then 'expired' else 'active' end as status,
 case when r.ends_at is null then 'permanent' when r.ends_at-r.starts_at=interval '24 hours' then '24h'
 when r.ends_at-r.starts_at=interval '3 days' then '3d' when r.ends_at-r.starts_at=interval '7 days' then '7d' else '30d' end as duration
 from public.community_access_restrictions r left join public.profiles p on p.id=r.user_id left join public.profiles a on a.id=r.created_by;
revoke all on public.community_restriction_admin_rows from public,anon,authenticated;
create function public.ops_community_restriction_status(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform public.assert_account_active(); perform public.ops_require_admin();
 return jsonb_build_object('active',(select to_jsonb(r) from public.community_restriction_admin_rows r where user_id=p_user_id and status='active' order by created_at desc,id desc limit 1),
 'history',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc) from (select * from public.community_restriction_admin_rows where user_id=p_user_id order by created_at desc,id desc limit 100) r),'[]'::jsonb));
end $$;
create function public.ops_community_restrictions(p_status text default 'active',p_duration text default 'all',p_search text default '',p_offset integer default 0,p_limit integer default 30) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; count_rows integer; page_size integer:=greatest(1,least(coalesce(p_limit,30),100));
begin
 perform public.assert_account_active(); perform public.ops_require_admin();
 if p_status is null or p_status not in ('all','active','temporary','permanent','expired','revoked') or p_duration is null or p_duration not in ('all','24h','3d','7d','30d','permanent') then raise exception 'invalid restriction filter' using errcode='22023'; end if;
 with page as (select * from public.community_restriction_admin_rows r
 where (p_status='all' or r.status=p_status or (p_status in ('temporary','permanent') and r.status='active' and r.restriction_type=p_status))
 and (p_duration='all' or r.duration=p_duration)
 and (coalesce(r.display_name,'') ilike '%'||left(coalesce(p_search,''),100)||'%' or r.user_id::text=coalesce(p_search,''))
 order by r.created_at desc,r.id desc offset greatest(0,coalesce(p_offset,0)) limit page_size+1),
 numbered as (select *,row_number() over(order by created_at desc,id desc) rn from page)
 select coalesce(jsonb_agg(to_jsonb(numbered)-'rn' order by created_at desc,id desc) filter(where rn<=page_size),'[]'::jsonb),count(*) into result,count_rows from numbered;
 return jsonb_build_object('items',result,'hasMore',count_rows>page_size);
end $$;

do $$ declare item record; begin
 for item in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('community_access_status','community_acknowledge_restriction','ops_community_restrict_user','ops_community_unrestrict_user','ops_community_restriction_status','ops_community_restrictions') loop
 execute format('revoke all on function %s from public,anon',item.signature);
 execute format('grant execute on function %s to authenticated,service_role',item.signature);
 end loop;
end $$;
-- Reject privileged direct inserts as well as the administrative RPC path.
create function public.community_validate_restriction_target() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform public.assert_account_active();
 -- Historical rows may belong to a user promoted after the restriction; permit
 -- revocation, acknowledgment and FK cleanup without creating a new punishment.
 if tg_op='INSERT' and exists(select 1 from public.user_roles where user_id=new.user_id and role='admin') then
 raise exception 'cannot restrict administrator' using errcode='42501'; end if;
 if tg_op='UPDATE' and (new.user_id is distinct from old.user_id
 or (new.created_by is distinct from old.created_by and not (
  new.created_by is null and old.created_by is not null and pg_trigger_depth()>1
  and not exists(select 1 from auth.users where id=old.created_by)))
 or new.created_at is distinct from old.created_at or new.starts_at is distinct from old.starts_at
 or new.ends_at is distinct from old.ends_at or new.restriction_type is distinct from old.restriction_type
 or new.reason is distinct from old.reason or new.admin_message is distinct from old.admin_message) then
 raise exception 'restriction history is immutable' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function public.community_validate_restriction_target() from public,anon,authenticated;
create trigger validate_community_restriction_target before insert or update on public.community_access_restrictions
 for each row execute function public.community_validate_restriction_target();



-- Read-only schema diagnostic for migrations/deployment tooling, not a client RPC.
-- Run SELECT * FROM public.account_activity_guard_gaps(); after future migrations.
-- Any returned row requires review. Static coverage does not prove business authorization.
create or replace function public.account_activity_guard_gaps()
returns table(object_type text,object_name text,reason text)
language sql stable security invoker set search_path='' as $$
 with client_tables as (
  select c.oid,n.nspname,c.relname,c.relrowsecurity,
   has_table_privilege('authenticated',c.oid,'SELECT') can_read,
   has_table_privilege('authenticated',c.oid,'INSERT') can_insert,
   has_table_privilege('authenticated',c.oid,'UPDATE') can_update,
   has_table_privilege('authenticated',c.oid,'DELETE') can_delete
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

notify pgrst,'reload schema';
commit;








