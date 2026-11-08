begin;
create or replace function public.ops_insights_workout_engagement(p_filters jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare caller uuid:=public.ops_require_admin(); result jsonb;
 f timestamptz:=coalesce((p_filters->>'from')::timestamptz,now()-interval '7 days');
 t timestamptz:=coalesce((p_filters->>'to')::timestamptz,now());
 plat text:=nullif(p_filters->>'platform',''); ver text:=nullif(p_filters->>'version',''); dev text:=nullif(p_filters->>'device','');
begin
 if t<=f or t-f>interval '90 days' or f<now()-interval '180 days' then raise exception 'invalid period' using errcode='22023'; end if;
 insert into public.insights_admin_access(admin_id,resource) values(caller,'workout_engagement');
 with cohort as (
  select w.user_id,count(*) as completed,
  not exists(select 1 from public.workout_sessions previous where previous.user_id=w.user_id and previous.status='completed' and previous.completed_at<f) as first_in_source
  from public.workout_sessions w where w.status='completed' and w.completed_at>=f and w.completed_at<t
  and ((plat is null and ver is null and dev is null) or exists(select 1 from public.insights_events e where e.journey_id=w.id and e.user_id=w.user_id and e.occurred_at>=f and e.occurred_at<t and (plat is null or e.platform=plat) and (ver is null or e.app_version=ver) and (dev is null or e.device=dev)))
  group by w.user_id
 ) select case when count(*)<5 then jsonb_build_object('insufficient',true) else jsonb_build_object(
  'eligible_users',count(*),'first_workout_users',case when count(*) filter(where first_in_source)=0 or count(*) filter(where first_in_source)>=5 then count(*) filter(where first_in_source) end,
  'recurring_workout_users',case when count(*) filter(where completed>=2)=0 or count(*) filter(where completed>=2)>=5 then count(*) filter(where completed>=2) end,
  'average_completed',round(avg(completed),1)) end into result from cohort;
 return result||jsonb_build_object('source','workout_sessions','updated_at',now());
end $$;
revoke all on function public.ops_insights_workout_engagement(jsonb) from public,anon,authenticated;
grant execute on function public.ops_insights_workout_engagement(jsonb) to authenticated;
commit;
