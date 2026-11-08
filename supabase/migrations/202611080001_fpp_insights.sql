-- Inspected linked Fpp project bgqavxoxwgheloeubbpf on 2026-11-08.
-- Training, support, identities, consent and admin authorization reuse the live domain.
begin;
create table if not exists public.insights_events (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 received_at timestamptz not null default now(), occurred_at timestamptz not null,
 name text not null, session_id uuid not null, operation_id uuid, journey_id uuid,
 flow text, step text, action text, outcome text, error_category text,
 duration_ms integer check(duration_ms between 0 and 3600000),
 route text not null, app_version text not null,
 platform text not null check(platform in ('web','pwa','native')),
 device text not null check(device in ('ios','android','desktop'))
);
create index if not exists insights_events_time_idx on public.insights_events(occurred_at,platform,app_version);
create index if not exists insights_events_user_time_idx on public.insights_events(user_id,occurred_at);
create index if not exists insights_events_journey_idx on public.insights_events(journey_id,occurred_at) where journey_id is not null;
create table if not exists public.insights_alerts (
 id uuid primary key default gen_random_uuid(), fingerprint text unique not null,
 title text not null, description text not null, impact text not null,
 affected_users integer not null, occurrences integer not null,
 platform text, app_version text, device text, first_seen timestamptz not null, last_seen timestamptz not null,
 state text not null default 'open' check(state in ('open','investigating','resolved')),
 updated_at timestamptz not null default now()
);
create table if not exists public.insights_admin_access (
 id bigint generated always as identity primary key,
 admin_id uuid references auth.users(id) on delete set null,
 target_id uuid references auth.users(id) on delete cascade,
 resource text not null, created_at timestamptz not null default now()
);
alter table public.insights_events enable row level security;
alter table public.insights_alerts enable row level security;
alter table public.insights_admin_access enable row level security;
revoke all on public.insights_events,public.insights_alerts,public.insights_admin_access from public,anon,authenticated;

create or replace function public.insights_has_consent(p_user uuid) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 return coalesce((select granted and revoked_at is null and details::jsonb->>'analytics'='true'
 from public.privacy_consents where user_id=p_user and purpose='cookie_preferences'
 order by granted_at desc limit 1),false);
exception when invalid_text_representation then return false;
end
$$;
revoke all on function public.insights_has_consent(uuid) from public,anon,authenticated;

create or replace function public.insights_ingest(p_events jsonb,p_expected_account uuid) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare caller uuid:=auth.uid(); e jsonb; inserted integer:=0; n integer; allowed text[]:=array[
 'app_session_started','screen_viewed','onboarding_started','onboarding_step_viewed','onboarding_step_completed','onboarding_validation_failed','onboarding_completed',
 'plan_creation_started','plan_creation_step_completed','plan_creation_completed','plan_creation_failed','workout_start_requested','workout_start_confirmed','workout_set_recorded','workout_progress_recorded','workout_finish_requested','workout_finish_confirmed','workout_abandon_confirmed','workout_recovery_succeeded','workout_recovery_failed',
 'flex_adjustment_started','flex_adjustment_completed','flex_adjustment_failed','professional_link_requested','professional_link_established','professional_plan_selected','professional_step_completed',
 'community_feed_viewed','community_publish_started','community_upload_completed','community_publish_completed','community_publish_failed','photo_feature_opened','photo_selection_started','photo_upload_started','photo_upload_completed','photo_upload_failed','photo_comparison_opened','photo_comparison_interacted',
 'action_failed','action_retried','operation_slow','sync_failed','sync_recovered','asset_load_failed','runtime_error','flow_interrupted','app_open_measured','interface_usable','page_loaded','storage_failed','service_worker_failed'];
begin
 perform public.assert_account_active();
 if caller is null or caller is distinct from p_expected_account or exists(select 1 from auth.users where id=caller and is_anonymous) or not public.insights_has_consent(caller) then return 0; end if;
 if jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)>25 or octet_length(p_events::text)>32768 then raise exception 'invalid batch' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text,8001));
 if not public.insights_has_consent(caller) then return 0; end if;
 if (select count(*) from public.insights_events where user_id=caller and received_at>now()-interval '1 hour')+jsonb_array_length(p_events)>500 then return 0; end if;
 for e in select value from jsonb_array_elements(p_events) loop
  if not (e->>'name'=any(allowed)) or e->>'name' is null then raise exception 'invalid event' using errcode='22023'; end if;
  if exists(select 1 from jsonb_object_keys(e) k where k not in ('event_id','name','occurred_at','session_id','operation_id','journey_id','flow','step','action','outcome','error_category','duration_ms','route','app_version','platform','device')) then raise exception 'unknown metadata' using errcode='22023'; end if;
  if exists(select 1 from jsonb_each_text(e) p where p.key in ('flow','step','action','outcome','error_category','app_version') and p.value !~ '^[a-zA-Z0-9_.:-]{1,80}$') then raise exception 'invalid metadata' using errcode='22023'; end if;
  if e->>'route' not in ('/home','/plan','/workout','/community','/progress','/more','/support','/student/professionals','/professional','/other') then raise exception 'invalid route' using errcode='22023'; end if;
  if (e->>'occurred_at')::timestamptz<now()-interval '1 day' or (e->>'occurred_at')::timestamptz>now()+interval '5 minutes' then continue; end if;
  insert into public.insights_events(id,user_id,occurred_at,name,session_id,operation_id,journey_id,flow,step,action,outcome,error_category,duration_ms,route,app_version,platform,device)
  values((e->>'event_id')::uuid,caller,(e->>'occurred_at')::timestamptz,e->>'name',(e->>'session_id')::uuid,(e->>'operation_id')::uuid,(e->>'journey_id')::uuid,e->>'flow',e->>'step',e->>'action',e->>'outcome',e->>'error_category',(e->>'duration_ms')::integer,e->>'route',e->>'app_version',e->>'platform',e->>'device') on conflict(id) do nothing;
  get diagnostics n=row_count; inserted:=inserted+n;
  if e->>'flow'='professional' and e->>'outcome'='server_confirmed' and e->>'journey_id' is not null and e->>'operation_id' is not null then
   update public.insights_events set journey_id=(e->>'journey_id')::uuid where user_id=caller and flow='professional' and operation_id=(e->>'operation_id')::uuid and occurred_at>now()-interval '1 day';
  end if;
 end loop;
 return inserted;
end $$;

create or replace function public.insights_delete_own() returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,8001));
 delete from public.insights_events where user_id=auth.uid();
end $$;

create or replace function public.insights_privacy_cleanup() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,8001));
 if tg_table_name='privacy_requests' then
  if new.request_type in ('deletion','consent_revocation') then delete from public.insights_events where user_id=new.user_id; end if;
 elsif new.purpose='cookie_preferences' then
  if not new.granted or new.revoked_at is not null or not public.insights_has_consent(new.user_id) then delete from public.insights_events where user_id=new.user_id; end if;
 end if;
 return new;
end $$;
drop trigger if exists insights_consent_cleanup on public.privacy_consents;
create trigger insights_consent_cleanup after insert or update on public.privacy_consents for each row execute function public.insights_privacy_cleanup();
drop trigger if exists insights_request_cleanup on public.privacy_requests;
create trigger insights_request_cleanup after insert on public.privacy_requests for each row execute function public.insights_privacy_cleanup();

-- No public telemetry consumer uses this legacy administrative endpoint.
create or replace function public.ops_log_system_error(p_source text,p_message text,p_severity text default 'error',p_details jsonb default '{}') returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 perform public.ops_require_admin();
 if length(p_source)>80 or length(p_message)>500 or octet_length(p_details::text)>4096 then raise exception 'oversized diagnostic' using errcode='22023'; end if;
 insert into public.ops_system_errors(source,message,severity,details) values(coalesce(nullif(trim(p_source),''),'system'),coalesce(nullif(trim(p_message),''),'System event'),case when p_severity in ('warning','error','critical') then p_severity else 'error' end,coalesce(p_details,'{}')) returning id into v_id;
 return v_id;
end $$;

create or replace function public.ops_insights_alert_state(p_id uuid,p_state text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare caller uuid:=public.ops_require_admin();
begin
 if p_state not in ('open','investigating','resolved') then raise exception 'invalid state' using errcode='22023'; end if;
 update public.insights_alerts set state=p_state,updated_at=now() where id=p_id;
 insert into public.insights_admin_access(admin_id,resource) values(caller,'alert:'||p_state);
end $$;

-- One guarded aggregate endpoint; section-specific repository methods keep independent requests.
create or replace function public.ops_insights(p_section text,p_filters jsonb default '{}',p_user_id uuid default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare caller uuid:=public.ops_require_admin();
 from_at timestamptz:=coalesce((p_filters->>'from')::timestamptz,now()-interval '7 days');
 to_at timestamptz:=coalesce((p_filters->>'to')::timestamptz,now());
 plat text:=nullif(p_filters->>'platform',''); ver text:=nullif(p_filters->>'version',''); dev text:=nullif(p_filters->>'device','');
 lim integer:=greatest(1,least(coalesce((p_filters->>'limit')::integer,20),50));
 offst integer:=greatest(0,least(coalesce((p_filters->>'offset')::integer,0),10000));
 result jsonb; sample integer; data_rows jsonb; previous_rows jsonb; operational jsonb; retained jsonb;
begin
 if to_at<=from_at or to_at-from_at>interval '90 days' or from_at<now()-interval '180 days' then raise exception 'invalid period' using errcode='22023'; end if;
 if p_section not in ('overview','friction','funnels','workouts','retention','performance','support','alerts','user') then raise exception 'invalid section' using errcode='22023'; end if;
 insert into public.insights_admin_access(admin_id,target_id,resource) values(caller,p_user_id,p_section);
 if p_section='user' and (p_user_id is null or not public.insights_has_consent(p_user_id)) then return jsonb_build_object('restricted',true,'rows','[]'::jsonb); end if;
 -- Each query is scoped and indexed. Small telemetry samples are suppressed, not interpreted as zero problems.
 select count(distinct user_id) into sample from public.insights_events where occurred_at>=from_at and occurred_at<to_at and (plat is null or platform=plat) and (ver is null or app_version=ver) and (dev is null or device=dev);
 if p_section='workouts' then
  select jsonb_build_object('started',count(*),'completed',count(*) filter(where w.status='completed'),'abandoned',count(*) filter(where w.status='abandoned'),'active',count(*) filter(where w.status='active'),'completion_rate',round(100.0*count(*) filter(where w.status='completed')/nullif(count(*) filter(where w.status<>'active'),0),1),'duration_minutes',round(avg(extract(epoch from(w.completed_at-w.started_at))/60) filter(where w.status='completed'),1),'source','workout_sessions','filtered_sample',plat is not null or ver is not null or dev is not null) into result
  from public.workout_sessions w where w.started_at>=from_at and w.started_at<to_at and ((plat is null and ver is null and dev is null) or exists(select 1 from public.insights_events e where e.user_id=w.user_id and e.journey_id=w.id and e.occurred_at>=from_at and e.occurred_at<to_at and (plat is null or e.platform=plat) and (ver is null or e.app_version=ver) and (dev is null or e.device=dev)));
  if sample>=5 then
   select coalesce(jsonb_agg(to_jsonb(g)),'[]') into data_rows from (select name as label,count(distinct journey_id) as count from public.insights_events where occurred_at>=from_at and occurred_at<to_at and name in ('flex_adjustment_started','flex_adjustment_completed','flex_adjustment_failed','workout_recovery_succeeded','workout_recovery_failed','sync_failed','sync_recovered') and (plat is null or platform=plat) and (ver is null or app_version=ver) and (dev is null or device=dev) group by name having count(distinct user_id)>=5 order by count(*) desc) g;
   result:=result||jsonb_build_object('experience',data_rows);
   select result||jsonb_build_object('flex',coalesce(jsonb_agg(to_jsonb(g)),'[]')) into result from (select e.step as label,count(distinct e.journey_id) as count,round(100.0*count(distinct e.journey_id) filter(where w.status='completed')/nullif(count(distinct e.journey_id) filter(where w.status in ('completed','abandoned')),0),1) as rate from public.insights_events e left join public.workout_sessions w on w.id=e.journey_id and w.user_id=e.user_id where e.occurred_at>=from_at and e.occurred_at<to_at and e.name='flex_adjustment_started' and e.action='duration_selection' and (plat is null or e.platform=plat) and (ver is null or e.app_version=ver) and (dev is null or e.device=dev) group by e.step having count(distinct e.user_id)>=5) g;

  end if;
  return result||jsonb_build_object('updated_at',now(),'sample',sample);
 elsif p_section='support' then
  select coalesce(jsonb_agg(to_jsonb(s)),'[]') into data_rows from (
   select c.label,count(*) as count,round(avg(extract(epoch from(t.first_response_at-t.created_at))/3600)::numeric,1) as response_hours,round(avg(extract(epoch from(t.resolved_at-t.created_at))/3600)::numeric,1) as resolution_hours
   from public.support_tickets t join public.support_categories c on c.id=t.category_id where t.created_at>=from_at and t.created_at<to_at
   and ((plat is null and ver is null and dev is null) or exists(select 1 from public.insights_events e where e.user_id=t.user_id and e.occurred_at>=from_at and e.occurred_at<to_at and (plat is null or e.platform=plat) and (ver is null or e.app_version=ver) and (dev is null or e.device=dev)))
   group by c.label order by count(*) desc limit lim offset offst) s;
  return jsonb_build_object('rows',data_rows,'source','support_tickets','updated_at',now(),'filtered_sample',plat is not null or ver is not null or dev is not null);
 end if;
 if sample<5 and p_section<>'user' then return jsonb_build_object('insufficient',true,'sample',null,'rows','[]'::jsonb,'updated_at',now()); end if;
 if p_section='overview' then
  with e as (select * from public.insights_events where occurred_at>=from_at and occurred_at<to_at and (plat is null or platform=plat) and (ver is null or app_version=ver) and (dev is null or device=dev))
  select jsonb_build_object('active_users',count(distinct user_id) filter(where name in ('screen_viewed','workout_start_confirmed','community_feed_viewed','onboarding_step_completed')),'sessions',count(distinct session_id),'affected_users',count(distinct user_id) filter(where name in ('action_failed','action_retried','operation_slow','sync_failed','onboarding_validation_failed')),'technical_errors',count(*) filter(where name in ('runtime_error','asset_load_failed','storage_failed','service_worker_failed')),'response_ms',round(avg(duration_ms) filter(where action is not null),0),'abandon_rate',null,'retention',null) into result from e;
  operational:=public.ops_insights('workouts',p_filters);
  retained:=public.ops_insights('retention',p_filters);
  result:=result||jsonb_build_object('workout_completion_rate',operational->'completion_rate','retention',(select x->'rate' from jsonb_array_elements(retained->'cohorts') x where x->>'day'='7'));
  with previous as (select * from public.insights_events where occurred_at>=from_at-(to_at-from_at) and occurred_at<from_at and (plat is null or platform=plat) and (ver is null or app_version=ver) and (dev is null or device=dev))
  select case when count(distinct user_id)>=5 then jsonb_build_object('active_users',count(distinct user_id) filter(where name in ('screen_viewed','workout_start_confirmed','community_feed_viewed','onboarding_step_completed')),'sessions',count(distinct session_id),'affected_users',count(distinct user_id) filter(where name in ('action_failed','action_retried','operation_slow','sync_failed','onboarding_validation_failed')),'technical_errors',count(*) filter(where name in ('runtime_error','asset_load_failed','storage_failed','service_worker_failed')),'response_ms',round(avg(duration_ms) filter(where action is not null),0)) end into previous_rows from previous;
  result:=result||jsonb_build_object('previous',previous_rows);
  with journeys as (select journey_id,min(occurred_at) as entered,bool_or(name in ('onboarding_completed','plan_creation_completed','workout_finish_confirmed','community_publish_completed','photo_upload_completed')) as completed from public.insights_events where journey_id is not null and occurred_at>=from_at and occurred_at<to_at and (plat is null or platform=plat) and (ver is null or app_version=ver) and (dev is null or device=dev) group by journey_id)
  select result||jsonb_build_object('abandon_rate',case when count(*)>=5 then round(100.0*count(*) filter(where not completed)/count(*),1) end) into result from journeys where entered<least(to_at,now())-interval '7 days';
 elsif p_section='friction' or p_section='performance' then
  with e as (select * from public.insights_events where occurred_at>=from_at-(to_at-from_at) and occurred_at<to_at and (plat is null or platform=plat) and (ver is null or app_version=ver) and (dev is null or device=dev)),
  exposures as (select coalesce(action,flow,name) as label,count(distinct user_id) as users from e where occurred_at>=from_at and name not in ('action_failed','action_retried','operation_slow','sync_failed','workout_recovery_failed','onboarding_validation_failed','flow_interrupted','runtime_error','asset_load_failed','storage_failed','service_worker_failed') group by coalesce(action,flow,name)),
  grouped as (select coalesce(action,flow,name) as label,error_category,platform,app_version,count(*) filter(where occurred_at>=from_at) as count,count(distinct user_id) filter(where occurred_at>=from_at) as users,count(distinct user_id) filter(where occurred_at<from_at) as previous_users,min(occurred_at) filter(where occurred_at>=from_at) as first_seen,max(occurred_at) as last_seen,max(outcome) as severity,round(avg(duration_ms) filter(where occurred_at>=from_at),0) as duration_ms
   from e where name=any(case when p_section='friction' then array['action_failed','action_retried','operation_slow','sync_failed','workout_recovery_failed','onboarding_validation_failed','flow_interrupted'] else array['runtime_error','asset_load_failed','operation_slow','sync_failed','workout_recovery_failed','storage_failed','service_worker_failed','app_open_measured','interface_usable','page_loaded'] end)
   and (name<>'flow_interrupted' or outcome='high')
   group by coalesce(action,flow,name),error_category,platform,app_version)
  select coalesce(jsonb_agg(to_jsonb(g)||jsonb_build_object('rate',case when p_section='performance' then round(100.0*g.users/sample,1) else (select case when x.users>=5 then least(100,round(100.0*g.users/x.users,1)) end from exposures x where x.label=g.label) end)),'[]') into data_rows from (select label,error_category,platform,app_version,count,users,case when previous_users>=5 then previous_users end as previous_users,first_seen,last_seen,severity,duration_ms from grouped where users>=5 order by users desc,count desc limit lim offset offst) g;
  result:=jsonb_build_object('rows',data_rows);
  if p_section='performance' then
   select result||jsonb_build_object('trend',coalesce(jsonb_agg(to_jsonb(t)),'[]')) into result from (select (occurred_at at time zone 'America/Sao_Paulo')::date as label,count(*) as count from public.insights_events where occurred_at>=from_at and occurred_at<to_at and name in ('runtime_error','asset_load_failed','operation_slow','sync_failed') and (plat is null or platform=plat) and (ver is null or app_version=ver) and (dev is null or device=dev) group by (occurred_at at time zone 'America/Sao_Paulo')::date having count(distinct user_id)>=5 order by label) t;
  end if;
 elsif p_section='retention' then
  with e as (select distinct user_id,(occurred_at at time zone 'America/Sao_Paulo')::date as day,platform from public.insights_events where occurred_at>=now()-interval '90 days' and occurred_at<to_at and name in ('screen_viewed','workout_start_confirmed','community_feed_viewed','onboarding_step_completed') and (plat is null or platform=plat) and (ver is null or app_version=ver) and (dev is null or device=dev)),
  cohorts as (select user_id,min(day) as first_day from e group by user_id),
  retention as (select d, count(*) filter(where c.first_day+d<(to_at at time zone 'America/Sao_Paulo')::date) as eligible,count(*) filter(where c.first_day+d<(to_at at time zone 'America/Sao_Paulo')::date and exists(select 1 from e where e.user_id=c.user_id and e.day=c.first_day+d)) as returned from cohorts c cross join (values(1),(7),(30)) days(d) where c.first_day>=(from_at at time zone 'America/Sao_Paulo')::date group by d),
  daily as (select day as label,count(distinct user_id) as count from e where day>=(from_at at time zone 'America/Sao_Paulo')::date group by day having count(distinct user_id)>=5 order by day)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(daily)) from daily),'[]'),'cohorts',coalesce((select jsonb_agg(jsonb_build_object('day',d,'eligible',case when eligible>=5 then eligible end,'returned',case when eligible>=5 then returned end,'rate',case when eligible>=5 then round(100.0*returned/nullif(eligible,0),1) end)) from retention),'[]'),'new_users',(select case when count(*)=0 or count(*)>=5 then count(*) end from (select distinct user_id from e where day>=(from_at at time zone 'America/Sao_Paulo')::date) a join public.profiles p on p.id=a.user_id where p.created_at>=from_at and p.created_at<to_at),
   'recurring_users',(select case when count(*)=0 or count(*)>=5 then count(*) end from (select distinct user_id from e where day>=(from_at at time zone 'America/Sao_Paulo')::date) a join public.profiles p on p.id=a.user_id where p.created_at<from_at),
   'active_daily',(select case when count(distinct user_id)>=5 then count(distinct user_id) end from e where day=(to_at at time zone 'America/Sao_Paulo')::date),
   'active_weekly',(select case when count(distinct user_id)>=5 then count(distinct user_id) end from e where day>(to_at at time zone 'America/Sao_Paulo')::date-7),
   'active_monthly',(select case when count(distinct user_id)>=5 then count(distinct user_id) end from e where day>(to_at at time zone 'America/Sao_Paulo')::date-30),
   'platforms',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from (select platform as label,count(distinct user_id) as count from e where day>=(from_at at time zone 'America/Sao_Paulo')::date group by platform having count(distinct user_id)>=5) p),
   'weekly',(select coalesce(jsonb_agg(to_jsonb(w)),'[]') from (select date_trunc('week',day)::date as label,count(distinct user_id) as count from e where day>=(from_at at time zone 'America/Sao_Paulo')::date group by date_trunc('week',day) having count(distinct user_id)>=5 order by label) w),
   'definition','Coorte de primeira atividade observada no histÃ³rico retido; retorno no dia civil exato (America/Sao_Paulo).') into result;
 elsif p_section='funnels' then
  -- Ordered per-journey progression, 7-day conversion window, no revisits counted twice.
  with definitions(flow,steps) as (values
   ('onboarding',array['personal','avatar','body','measurements','goal','style','days','saved']),
   ('plan_creation',array['create','name','exercise','configure','save','apply']),
   ('workout',array['requested','confirmed','first_set','progress','finish_requested','finished']),
   ('professional',array['start','sent','received','linked','available','selected','first_workout']),
   ('photos',array['open','select','upload','processed','compare','interact']),
   ('community',array['feed','start','uploaded','published'])),
  e as (select * from public.insights_events where occurred_at>=from_at and occurred_at<least(to_at+interval '7 days',now()) and journey_id is not null and (plat is null or platform=plat) and (ver is null or app_version=ver) and (dev is null or device=dev)),
  journeys as (select d.flow,d.steps,e.journey_id,min(e.occurred_at) as start_at from definitions d join e on e.flow=d.flow and e.step=d.steps[1] and e.name not like '%failed' where e.occurred_at<to_at group by d.flow,d.steps,e.journey_id),
  steps as (select j.flow,j.journey_id,s.step,s.ordinality,min(e.user_id::text)::uuid as actor,min(e.occurred_at) as completed from journeys j cross join lateral unnest(j.steps) with ordinality s(step,ordinality) left join e on e.journey_id=j.journey_id and e.flow=j.flow and e.step=s.step and e.occurred_at>=j.start_at and e.occurred_at<j.start_at+interval '7 days' and e.name not in ('onboarding_step_viewed','onboarding_validation_failed','action_failed','flow_interrupted') group by j.flow,j.journey_id,s.step,s.ordinality),
  counts as (select a.flow,a.step,a.ordinality,count(distinct a.journey_id) filter(where a.completed is not null and not exists(select 1 from steps b where b.journey_id=a.journey_id and b.flow=a.flow and b.ordinality<a.ordinality and (b.completed is null or b.completed>a.completed))) as count,count(distinct a.actor) filter(where a.completed is not null and not exists(select 1 from steps b where b.journey_id=a.journey_id and b.flow=a.flow and b.ordinality<a.ordinality and (b.completed is null or b.completed>a.completed))) as users from steps a group by a.flow,a.step,a.ordinality),
  grouped as (select flow,jsonb_agg(jsonb_build_object('label',step,'count',case when users>=5 then count end) order by ordinality) as steps from counts group by flow)
  select jsonb_build_object('rows',coalesce(jsonb_agg(to_jsonb(grouped)),'[]'),'window_days',7,'denominator','Jornadas distintas; etapas confirmadas em ordem. Coortes recentes ainda podem converter.') into result from grouped;
 elsif p_section='alerts' then
  insert into public.insights_alerts(fingerprint,title,description,impact,affected_users,occurrences,platform,app_version,device,first_seen,last_seen)
  select coalesce(action,name)||':'||platform||':'||app_version||':'||device,
   'Falhas recorrentes: '||coalesce(action,name),'Sinais tÃ©cnicos observados; investigar antes de atribuir uma causa.','high',count(distinct user_id),count(*),platform,app_version,device,min(occurred_at),max(occurred_at)
  from public.insights_events where occurred_at>=from_at and occurred_at<to_at and name in ('runtime_error','sync_failed','action_failed','workout_recovery_failed') and (plat is null or platform=plat) and (ver is null or app_version=ver) and (dev is null or device=dev)
  group by coalesce(action,name),platform,app_version,device having count(distinct user_id)>=5 and count(*)>=10
  on conflict(fingerprint) do update set affected_users=greatest(insights_alerts.affected_users,excluded.affected_users),occurrences=greatest(insights_alerts.occurrences,excluded.occurrences),last_seen=greatest(insights_alerts.last_seen,excluded.last_seen);
  select coalesce(jsonb_agg(to_jsonb(a)),'[]') into data_rows from (select * from public.insights_alerts where last_seen>=from_at and first_seen<to_at and (plat is null or platform=plat) and (ver is null or app_version=ver) and (dev is null or device=dev) order by affected_users desc,last_seen desc limit lim offset offst) a;
  result:=jsonb_build_object('rows',data_rows);
 elsif p_section='user' then
  select coalesce(jsonb_agg(to_jsonb(e)),'[]') into data_rows from (select name,flow,action,outcome,error_category,platform,app_version,occurred_at from public.insights_events where user_id=p_user_id and occurred_at>=from_at and occurred_at<to_at and (plat is null or platform=plat) and (ver is null or app_version=ver) and (dev is null or device=dev) order by occurred_at desc limit lim offset offst) e;
  result:=jsonb_build_object('rows',data_rows);
 end if;
 return coalesce(result,'{}')||jsonb_build_object('sample',sample,'updated_at',now(),'consented_only',true,'timezone','America/Sao_Paulo','limit',lim,'offset',offst);
end $$;

create or replace function public.insights_cleanup() returns void language sql security definer set search_path=public,pg_temp as $$
 delete from public.insights_events where occurred_at<now()-interval '90 days';
 delete from public.insights_admin_access where created_at<now()-interval '180 days';
 delete from public.insights_alerts where last_seen<now()-interval '90 days';
$$;
revoke all on function public.insights_cleanup(),public.insights_privacy_cleanup() from public,anon,authenticated;
revoke all on function public.insights_ingest(jsonb,uuid),public.insights_delete_own(),public.ops_insights(text,jsonb,uuid),public.ops_insights_alert_state(uuid,text) from public,anon,authenticated;
grant execute on function public.insights_ingest(jsonb,uuid),public.insights_delete_own(),public.ops_insights(text,jsonb,uuid),public.ops_insights_alert_state(uuid,text) to authenticated;
do $$ begin
 if to_regnamespace('cron') is not null then perform cron.schedule('fpp-insights-retention','23 3 * * *','select public.insights_cleanup()'); end if;
end $$;
commit;
