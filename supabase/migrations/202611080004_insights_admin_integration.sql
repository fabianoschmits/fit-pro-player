begin;
-- Preserve the inspected notification feed and extend its contract in place.
do $$ begin
 if to_regprocedure('public.ops_notification_feed_before_insights()') is null then
  alter function public.ops_notification_feed() rename to ops_notification_feed_before_insights;
 end if;
end $$;
revoke all on function public.ops_notification_feed_before_insights() from public,anon,authenticated;
create or replace function public.ops_notification_feed()
returns table(id text,kind text,title text,body text,target_path text,created_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 perform public.ops_require_admin();
 return query select * from public.ops_notification_feed_before_insights()
 union all
 select 'insight:'||a.id::text,'insight'::text,a.title,
 a.affected_users::text||' usuários afetados. Investigue os sinais observados.',
 '/console/insights?tab=alerts'::text,a.first_seen
 from public.insights_alerts a where a.state<>'resolved' and a.affected_users>=20 and a.occurrences>=50 and a.last_seen>now()-interval '7 days';
end $$;
revoke all on function public.ops_notification_feed() from public,anon,authenticated;

create or replace function public.ops_user_insights_support(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare caller uuid:=public.ops_require_admin(); result jsonb;
begin
 if not public.insights_has_consent(p_user_id) then return '[]'; end if;
 insert into public.insights_admin_access(admin_id,target_id,resource) values(caller,p_user_id,'user_support_context');
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from (
  select s.id,c.label as category,s.status,s.created_at from public.support_tickets s join public.support_categories c on c.id=s.category_id where s.user_id=p_user_id order by s.created_at desc limit 20
 ) t;
 return result;
end $$;
revoke all on function public.ops_user_insights_support(uuid) from public,anon,authenticated;
grant execute on function public.ops_user_insights_support(uuid) to authenticated;
commit;
