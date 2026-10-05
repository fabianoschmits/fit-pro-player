-- Portable schema: hosted Cron, pg_net and Vault are provisioned separately.
create table public.notification_settings (
  singleton boolean primary key default true check(singleton),
  ready boolean not null default false,
  native_ready boolean not null default false,
  vapid_public_key text not null default '',
  dispatcher_until timestamptz,
  scheduler_job_ids bigint[] not null default '{}'
);
insert into public.notification_settings(singleton) values(true);

create table public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  device_key uuid not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  transport text not null check(transport in ('webpush','fcm')),
  subscription jsonb not null,
  subscription_revision bigint not null default 1 check(subscription_revision>0),
  enabled boolean not null default true,
  preferences jsonb not null,
  timezone text not null,
  lang text not null,
  schedule jsonb not null,
  foreground_until timestamptz,
  expanded_local_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notification_devices_refill_idx on public.notification_devices(expanded_local_date) where enabled;
-- Native tokens can exceed a btree text key; a fixed-size SHA-256 index preserves
-- endpoint uniqueness while the lookup also verifies the original value.
create unique index notification_devices_endpoint_idx on public.notification_devices((sha256(endpoint::bytea)));
create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.notification_devices(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  kind text not null check(kind in ('program_updated','program_removed','relationship_accepted','relationship_ended','student_workout_completed','student_workout_abandoned','verification_changed')),
  href text not null,
  relationship_id uuid,
  assignment_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '1 day',
  consumed_at timestamptz,
  unique(device_id,event_key)
);
create index notification_events_pending_idx on public.notification_events(device_id,created_at,id) where consumed_at is null;
create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.notification_devices(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  subscription_revision bigint not null,
  event_id uuid references public.notification_events(id) on delete cascade,
  event_key text not null,
  kind text not null check(kind in ('workout_reminder','weight_reminder','measurement_reminder','program_updated','program_removed','relationship_accepted','relationship_ended','student_workout_completed','student_workout_abandoned','verification_changed')),
  href text not null,
  local_date date,
  local_due_at timestamptz not null default now(),
  due_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'pending' check(status in ('pending','claimed','sent','delivered_local','cancelled','failed')),
  attempts integer not null default 0 check(attempts between 0 and 5),
  claim_token uuid,
  claimed_until timestamptz,
  last_status integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(device_id,event_key)
);
-- The five-second probe and dispatcher scan only the eligible pending slice.
create index notification_jobs_due_idx on public.notification_jobs(due_at,id) include(device_id,expires_at) where status='pending';
create index notification_jobs_claim_idx on public.notification_jobs(claimed_until) where status='claimed';
create index notification_jobs_device_idx on public.notification_jobs(device_id,status);
create index notification_jobs_event_idx on public.notification_jobs(event_id) where event_id is not null;

alter table public.notification_settings enable row level security;
alter table public.notification_devices enable row level security;
alter table public.notification_events enable row level security;
alter table public.notification_jobs enable row level security;
revoke all on public.notification_settings,public.notification_devices,public.notification_events,public.notification_jobs from public,anon,authenticated;
grant select,insert,update,delete on public.notification_settings,public.notification_devices,public.notification_events,public.notification_jobs to service_role;

create function public.notification_config() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
select jsonb_build_object('ready',ready,'nativeReady',native_ready,'vapidPublicKey',vapid_public_key) from public.notification_settings where singleton
$$;

create function public.notification_valid_subscription(p_subscription jsonb) returns boolean
language plpgsql immutable set search_path=public,pg_temp as $$
declare endpoint text:=p_subscription->>'endpoint'; dh text:=p_subscription->'keys'->>'p256dh'; secret text:=p_subscription->'keys'->>'auth'; point bytea; token bytea; proof text;
begin
  if jsonb_typeof(p_subscription) is distinct from 'object' or octet_length(p_subscription::text)>8192 then return false; end if;
  if p_subscription->>'type'='fcm' then
    proof:=p_subscription->>'installationProof';
    if jsonb_typeof(p_subscription->'token') is distinct from 'string' or char_length(p_subscription->>'token') not between 40 and 4096 or p_subscription->>'token' !~ '^[A-Za-z0-9_:-]+$'
      or jsonb_typeof(p_subscription->'installationProof') is distinct from 'string' or proof !~ '^[A-Za-z0-9_-]{43}$' then return false; end if;
    token:=decode(translate(proof,'-_','+/')||'=','base64');
    return octet_length(token)=32 and rtrim(translate(encode(token,'base64'),'+/','-_'),'=')=proof;
  end if;
  if p_subscription ? 'type' and p_subscription->>'type' is distinct from 'webpush' then return false; end if;
  if jsonb_typeof(p_subscription) is distinct from 'object' or jsonb_typeof(p_subscription->'keys') is distinct from 'object'
    or octet_length(p_subscription::text)>8192 or endpoint is null or char_length(endpoint)>2048
    or endpoint !~ '^https://(push\.apple\.com|([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+notify\.windows\.com)/[^[:space:]#\\]*$'
    or dh is null or dh !~ '^[A-Za-z0-9_-]{87}$' or secret is null or secret !~ '^[A-Za-z0-9_-]{22}$' then return false; end if;
  point:=decode(translate(dh,'-_','+/')||'=','base64'); token:=decode(translate(secret,'-_','+/')||'==','base64');
  return octet_length(point)=65 and get_byte(point,0)=4 and octet_length(token)=16
    and rtrim(translate(replace(encode(point,'base64'),E'\n',''),'+/','-_'),'=')=dh
    and rtrim(translate(encode(token,'base64'),'+/','-_'),'=')=secret;
exception when others then return false;
end $$;
create function public.notification_subscription_endpoint(p_subscription jsonb) returns text
language sql immutable set search_path=public,pg_temp as $$select case when p_subscription->>'type'='fcm' then 'fcm:'||(p_subscription->>'token') else p_subscription->>'endpoint' end$$;

create function public.notification_preferences(p_input jsonb) returns jsonb
language plpgsql immutable set search_path=public,pg_temp as $$
declare p jsonb; k text;
begin
  if p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>4096 then raise exception 'invalid notification preferences' using errcode='22023'; end if;
  p:='{"workoutReminder":false,"professional":true,"weightReminder":false,"measurementReminder":false,"trainingTime":"18:00","leadMinutes":120,"checkinDay":0,"checkinTime":"09:00","quietHours":{"enabled":false,"start":"22:00","end":"07:00"}}'::jsonb||(p_input-'rest'-'timedSet');
  for k in select jsonb_object_keys(p_input) loop
    if k not in ('rest','timedSet','workoutReminder','professional','weightReminder','measurementReminder','trainingTime','leadMinutes','checkinDay','checkinTime','quietHours') then raise exception 'unknown notification preference' using errcode='22023'; end if;
  end loop;
  foreach k in array array['workoutReminder','professional','weightReminder','measurementReminder'] loop
    if jsonb_typeof(p->k) is distinct from 'boolean' then raise exception 'invalid notification category' using errcode='22023'; end if;
  end loop;
  if jsonb_typeof(p->'quietHours') is distinct from 'object' then raise exception 'invalid quiet hours' using errcode='22023'; end if;
  p:=jsonb_set(p,'{quietHours}','{"enabled":false,"start":"22:00","end":"07:00"}'::jsonb||p->'quietHours');
  if jsonb_typeof(p->'quietHours'->'enabled') is distinct from 'boolean'
    or coalesce(p->>'trainingTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or coalesce(p->>'checkinTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or coalesce(p->'quietHours'->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or coalesce(p->'quietHours'->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or jsonb_typeof(p->'leadMinutes') is distinct from 'number' or p->>'leadMinutes' not in ('0','15','30','60','120','180','360')
    or jsonb_typeof(p->'checkinDay') is distinct from 'number' or p->>'checkinDay' !~ '^[0-6]$' then raise exception 'invalid notification schedule preferences' using errcode='22023'; end if;
  return p;
end $$;

create function public.notification_valid_date(p_date text) returns boolean
language plpgsql immutable set search_path=public,pg_temp as $$
begin return p_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and to_char(p_date::date,'YYYY-MM-DD')=p_date; exception when others then return false; end $$;
create function public.notification_schedule(p_input jsonb) returns jsonb
language plpgsql immutable set search_path=public,pg_temp as $$
declare s jsonb; k text; e record; r jsonb; item jsonb;
begin
  if p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>1048576 then raise exception 'invalid notification calendar' using errcode='22023'; end if;
  s:='{"planMode":"weekly","week":{},"dayPlan":{},"routines":[],"completedDates":[],"activeDate":null,"weightDates":[],"measurementWeeks":[]}'::jsonb||p_input;
  if jsonb_typeof(s->'planMode') is distinct from 'string' or s->>'planMode' not in ('weekly','daily') or jsonb_typeof(s->'week') is distinct from 'object' or jsonb_typeof(s->'dayPlan') is distinct from 'object' or jsonb_typeof(s->'routines') is distinct from 'array' or jsonb_array_length(s->'routines')>2000 then raise exception 'invalid notification calendar shape' using errcode='22023'; end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(s->'routines'))<>jsonb_array_length(s->'routines') then raise exception 'duplicate notification routine' using errcode='22023'; end if;
  for r in select value from jsonb_array_elements(s->'routines') loop
    if jsonb_typeof(r)<>'object' or jsonb_typeof(r->'id') is distinct from 'string' or char_length(r->>'id') not between 1 and 256
      or jsonb_typeof(r->'hasExercises') is distinct from 'boolean' then raise exception 'invalid notification routine' using errcode='22023'; end if;
  end loop;
  for e in select * from jsonb_each(s->'week') loop
    if e.key !~ '^[0-6]$' or jsonb_typeof(e.value) is distinct from 'string' or char_length(e.value#>>'{}') not between 1 and 256 then raise exception 'invalid weekly notification plan' using errcode='22023'; end if;
  end loop;
  if (select count(*) from jsonb_object_keys(s->'dayPlan'))>366 then raise exception 'notification calendar too large' using errcode='22023'; end if;
  for e in select * from jsonb_each(s->'dayPlan') loop
    if not public.notification_valid_date(e.key) or jsonb_typeof(e.value) is distinct from 'string' or char_length(e.value#>>'{}') not between 1 and 256 then raise exception 'invalid daily notification plan' using errcode='22023'; end if;
  end loop;
  foreach k in array array['completedDates','weightDates','measurementWeeks'] loop
    if jsonb_typeof(s->k) is distinct from 'array' or jsonb_array_length(s->k)>366 then raise exception 'invalid notification record dates' using errcode='22023'; end if;
    for item in select value from jsonb_array_elements(s->k) loop
      if jsonb_typeof(item) is distinct from 'string' or not public.notification_valid_date(item#>>'{}') then raise exception 'invalid notification record date' using errcode='22023'; end if;
      if k='measurementWeeks' and extract(isodow from (item#>>'{}')::date)<>1 then raise exception 'measurement week must start Monday' using errcode='22023'; end if;
    end loop;
  end loop;
  if s->'activeDate'<>'null'::jsonb and (jsonb_typeof(s->'activeDate') is distinct from 'string' or not public.notification_valid_date(s->>'activeDate')) then raise exception 'invalid active notification date' using errcode='22023'; end if;
  return jsonb_set(s,'{routines}',coalesce((select jsonb_agg(jsonb_build_object('id',value->>'id','hasExercises',value->'hasExercises')) from jsonb_array_elements(s->'routines')),'[]'::jsonb));
end $$;

create function public.notification_category_enabled(p_preferences jsonb,p_kind text) returns boolean
language sql immutable set search_path=public,pg_temp as $$
select coalesce((p_preferences->>case p_kind when 'workout_reminder' then 'workoutReminder' when 'weight_reminder' then 'weightReminder' when 'measurement_reminder' then 'measurementReminder' else 'professional' end)::boolean,false)
$$;
create function public.notification_effective_routine(p_schedule jsonb,p_date date) returns text
language plpgsql immutable set search_path=public,pg_temp as $$
declare ov text:=p_schedule->'dayPlan'->>to_char(p_date,'YYYY-MM-DD'); rid text;
begin
  if ov='rest' then return null; end if;
  if ov is not null and exists(select 1 from jsonb_array_elements(p_schedule->'routines') r where r->>'id'=ov) then rid:=ov;
  elsif p_schedule->>'planMode'='daily' then return null;
  else rid:=p_schedule->'week'->>extract(dow from p_date)::integer::text; end if;
  if exists(select 1 from jsonb_array_elements(p_schedule->'routines') r where r->>'id'=rid and (r->>'hasExercises')::boolean) then return rid; end if;
  return null;
end $$;
create function public.notification_allowed_at(p_preferences jsonb,p_timezone text,p_at timestamptz) returns timestamptz
language plpgsql stable set search_path=public,pg_temp as $$
declare local_at timestamp:=p_at at time zone p_timezone; start_at time; end_at time;
begin
  if not coalesce((p_preferences->'quietHours'->>'enabled')::boolean,false) then return p_at; end if;
  start_at:=(p_preferences->'quietHours'->>'start')::time; end_at:=(p_preferences->'quietHours'->>'end')::time;
  if start_at>end_at then
    if local_at::time>=start_at then return ((local_at::date+1)+end_at) at time zone p_timezone;
    elsif local_at::time<end_at then return (local_at::date+end_at) at time zone p_timezone; end if;
  elsif start_at<end_at and local_at::time>=start_at and local_at::time<end_at then return (local_at::date+end_at) at time zone p_timezone; end if;
  return p_at;
end $$;

create function public.notification_event_is_current(p_event public.notification_events) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
select p_event.consumed_at is null and p_event.expires_at>now() and (
  p_event.kind in ('relationship_ended','verification_changed')
  or exists(select 1 from public.professional_student_relationships r where r.id=p_event.relationship_id and r.status='active' and p_event.owner_id in (r.professional_user_id,r.student_user_id))
) and (p_event.kind<>'program_updated' or exists(select 1 from public.program_assignments a where a.id=p_event.assignment_id and a.status='active'))
$$;

create function public.notification_expand_device(p_device_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.notification_devices; today date; day date; iso text; kind text; due timestamptz; expiry timestamptz; week_start date; qualifies boolean;
begin
  select * into d from public.notification_devices where id=p_device_id for update;
  if not found or not d.enabled then return; end if;
  today:=(now() at time zone d.timezone)::date;
  update public.notification_jobs j set status='cancelled',claim_token=null,claimed_until=null,updated_at=now() where j.device_id=d.id and j.kind in ('workout_reminder','weight_reminder','measurement_reminder') and j.status in ('pending','claimed');
  for day in select today+i from generate_series(0,13) i loop
    iso:=to_char(day,'YYYY-MM-DD'); week_start:=day-(extract(isodow from day)::integer-1);
    foreach kind in array array['workout_reminder','weight_reminder','measurement_reminder'] loop
      if not public.notification_category_enabled(d.preferences,kind) then continue; end if;
      if kind='workout_reminder' then
        qualifies:=public.notification_effective_routine(d.schedule,day) is not null and d.schedule->>'activeDate' is distinct from iso and not d.schedule->'completedDates' ? iso;
        due:=((day+(d.preferences->>'trainingTime')::time) at time zone d.timezone)-make_interval(mins=>(d.preferences->>'leadMinutes')::integer);
        expiry:=(day+(d.preferences->>'trainingTime')::time) at time zone d.timezone;
        expiry:=expiry+interval '30 minutes';
      else
        qualifies:=extract(dow from day)::integer=(d.preferences->>'checkinDay')::integer;
        if kind='weight_reminder' then
          qualifies:=qualifies and not exists(select 1 from jsonb_array_elements_text(d.schedule->'weightDates') r where r::date between week_start and week_start+6);
        else qualifies:=qualifies and not d.schedule->'measurementWeeks' ? to_char(week_start,'YYYY-MM-DD'); end if;
        due:=(day+(d.preferences->>'checkinTime')::time) at time zone d.timezone;
        expiry:=due+interval '12 hours';
      end if;
      due:=public.notification_allowed_at(d.preferences,d.timezone,due);
      -- Do not resurrect a missed reminder after a calendar/settings refresh.
      if not qualifies or due<=now() or due>=expiry then continue; end if;
      insert into public.notification_jobs(device_id,owner_id,subscription_revision,event_key,kind,href,local_date,local_due_at,due_at,expires_at)
      values(d.id,d.owner_id,d.subscription_revision,kind||':'||iso,kind,case when kind='workout_reminder' then '/#/workout' else '/#/body-progress' end,day,due,due,expiry)
      on conflict(device_id,event_key) do update set subscription_revision=excluded.subscription_revision,owner_id=excluded.owner_id,local_due_at=excluded.local_due_at,due_at=excluded.due_at,expires_at=excluded.expires_at,status='pending',claim_token=null,claimed_until=null,attempts=0,updated_at=now()
        where notification_jobs.status not in ('sent','delivered_local');
    end loop;
  end loop;
  update public.notification_devices set expanded_local_date=today where id=d.id;
end $$;

create function public.register_notification_device(p_device_key uuid,p_subscription jsonb,p_preferences jsonb,p_timezone text,p_lang text,p_schedule jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare caller uuid:=auth.uid(); d public.notification_devices; endpoint_device public.notification_devices; prefs jsonb; sched jsonb; changed boolean; resolved_endpoint text; resolved_transport text;
begin
  if caller is null then raise exception 'authenticated identity required' using errcode='42501'; end if;
  if p_device_key is null or not public.notification_valid_subscription(p_subscription) or not exists(select 1 from pg_timezone_names where name=p_timezone) or p_lang is null or p_lang not in ('pt','en','de','es','fr','hi','it','ko','pl','ru','tr','zh') then raise exception 'invalid notification device' using errcode='22023'; end if;
  resolved_transport:=case when p_subscription->>'type'='fcm' then 'fcm' else 'webpush' end;
  resolved_endpoint:=public.notification_subscription_endpoint(p_subscription);
  if resolved_transport='fcm' and not (select native_ready from public.notification_settings where singleton) then raise exception 'native push is not provisioned' using errcode='42501'; end if;
  prefs:=public.notification_preferences(p_preferences); sched:=public.notification_schedule(p_schedule);
  -- Registration is rare; one transaction lock gives endpoint/key rebind a fixed lock order.
  perform pg_advisory_xact_lock(hashtextextended('fitpp.notifications.register',0));
  -- Rebinding can touch two devices. Match the trigger lock order before reading either.
  perform 1 from public.notification_devices
    where device_key=p_device_key or (sha256(endpoint::bytea)=sha256(resolved_endpoint::bytea) and endpoint=resolved_endpoint)
    order by id for update;
  select * into d from public.notification_devices where device_key=p_device_key;
  if d.id is not null and d.owner_id<>caller then raise exception 'device ownership required; create a new account-scoped device key' using errcode='42501'; end if;
  select * into endpoint_device from public.notification_devices where sha256(endpoint::bytea)=sha256(resolved_endpoint::bytea) and endpoint=resolved_endpoint;
  if endpoint_device.id is not null and endpoint_device.owner_id<>caller and (
    endpoint_device.transport<>resolved_transport
    or (resolved_transport='webpush' and endpoint_device.subscription->'keys' is distinct from p_subscription->'keys')
    or (resolved_transport='fcm' and (endpoint_device.subscription->>'token' is distinct from p_subscription->>'token' or endpoint_device.subscription->>'installationProof' is distinct from p_subscription->>'installationProof'))
  ) then raise exception 'subscription proof required for endpoint rebinding' using errcode='42501'; end if;
  if endpoint_device.id is not null and endpoint_device.id is distinct from d.id then
    update public.notification_jobs set status='cancelled',claim_token=null,claimed_until=null,updated_at=now() where device_id=endpoint_device.id and status in ('pending','claimed');
    -- Reuse the endpoint row only when this device has not already registered elsewhere.
    if d.id is null then d:=endpoint_device;
    else delete from public.notification_devices where id=endpoint_device.id; end if;
  end if;
  if d.id is null then
    insert into public.notification_devices(device_key,owner_id,endpoint,transport,subscription,preferences,timezone,lang,schedule)
    values(p_device_key,caller,resolved_endpoint,resolved_transport,p_subscription,prefs,p_timezone,p_lang,sched) returning * into d;
  else
    changed:=d.owner_id<>caller or d.device_key<>p_device_key or d.subscription is distinct from p_subscription or not d.enabled;
    if changed then
      update public.notification_jobs set status='cancelled',claim_token=null,claimed_until=null,updated_at=now() where device_id=d.id and status in ('pending','claimed');
      update public.notification_events set consumed_at=now() where device_id=d.id and consumed_at is null;
    end if;
    update public.notification_devices set device_key=p_device_key,owner_id=caller,endpoint=resolved_endpoint,transport=resolved_transport,subscription=p_subscription,
      subscription_revision=subscription_revision+case when changed then 1 else 0 end,enabled=true,preferences=prefs,timezone=p_timezone,lang=p_lang,schedule=sched,
      foreground_until=case when changed then null else foreground_until end,updated_at=now() where id=d.id returning * into d;
  end if;
  update public.notification_jobs set status='cancelled',claim_token=null,claimed_until=null,updated_at=now() where device_id=d.id and status in ('pending','claimed') and not public.notification_category_enabled(prefs,kind);
  if not (prefs->>'professional')::boolean then update public.notification_events set consumed_at=now() where device_id=d.id and consumed_at is null; end if;
  perform public.notification_expand_device(d.id);
  return jsonb_build_object('id',d.id);
end $$;

create function public.read_notification_events(p_device_key uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.notification_devices;
begin
  select * into d from public.notification_devices where device_key=p_device_key and owner_id=auth.uid() and enabled;
  if auth.uid() is null or not found then raise exception 'device ownership required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'kind',j.kind,'createdAt',j.created_at,'href',j.href) order by j.created_at,j.id)
    from (select * from public.notification_jobs nj where nj.device_id=d.id and nj.owner_id=d.owner_id
      and nj.status in ('pending','claimed') and nj.local_due_at<=now() and public.notification_job_eligible(nj)
      and public.notification_allowed_at(d.preferences,d.timezone,now())<=now() order by nj.created_at,nj.id limit 25) j),'[]'::jsonb);
end $$;
create function public.set_notification_presence(p_device_key uuid,p_foreground boolean) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_foreground is null then raise exception 'invalid notification presence' using errcode='22023'; end if;
  update public.notification_devices set foreground_until=case when p_foreground then now()+interval '65 seconds' else null end
    where device_key=p_device_key and owner_id=auth.uid() and enabled;
  if auth.uid() is null or not found then raise exception 'device ownership required' using errcode='42501'; end if;
  return case when p_foreground then public.read_notification_events(p_device_key) else '[]'::jsonb end;
end $$;
create function public.consume_notification_events(p_device_key uuid,p_event_ids uuid[]) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.notification_devices;
begin
  if cardinality(p_event_ids)>25 or p_event_ids is null then raise exception 'invalid notification event acknowledgement' using errcode='22023'; end if;
  select * into d from public.notification_devices where device_key=p_device_key and owner_id=auth.uid() and enabled for update;
  if auth.uid() is null or not found then raise exception 'device ownership required' using errcode='42501'; end if;
  update public.notification_events e set consumed_at=coalesce(e.consumed_at,now()) from public.notification_jobs j where j.event_id=e.id and j.device_id=d.id and j.owner_id=d.owner_id and j.id=any(p_event_ids);
  update public.notification_jobs set status='delivered_local',claim_token=null,claimed_until=null,updated_at=now() where device_id=d.id and owner_id=d.owner_id and id=any(p_event_ids) and status in ('pending','claimed');
end $$;
create function public.disable_notification_device(p_device_key uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.notification_devices;
begin
  select * into d from public.notification_devices where device_key=p_device_key and owner_id=auth.uid() for update;
  if auth.uid() is null or not found then raise exception 'device ownership required' using errcode='42501'; end if;
  update public.notification_devices set enabled=false,foreground_until=null,subscription_revision=subscription_revision+1,updated_at=now() where id=d.id;
  update public.notification_jobs set status='cancelled',claim_token=null,claimed_until=null,updated_at=now() where device_id=d.id and status in ('pending','claimed');
  update public.notification_events set consumed_at=now() where device_id=d.id and consumed_at is null;
end $$;

create function public.notification_job_eligible(p_job public.notification_jobs) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare d public.notification_devices; iso text; week_start date;
begin
  if p_job.expires_at<=now() or (p_job.status='pending' and p_job.attempts>=5) then return false; end if;
  select * into d from public.notification_devices where id=p_job.device_id and owner_id=p_job.owner_id and enabled and subscription_revision=p_job.subscription_revision;
  if not found or not public.notification_category_enabled(d.preferences,p_job.kind) then return false; end if;
  if p_job.event_id is not null then
    return exists(select 1 from public.notification_events e where e.id=p_job.event_id and e.owner_id=d.owner_id and e.device_id=d.id and public.notification_event_is_current(e));
  end if;
  iso:=to_char(p_job.local_date,'YYYY-MM-DD'); week_start:=p_job.local_date-(extract(isodow from p_job.local_date)::integer-1);
  if p_job.kind='workout_reminder' then return public.notification_effective_routine(d.schedule,p_job.local_date) is not null and d.schedule->>'activeDate' is distinct from iso and not d.schedule->'completedDates' ? iso
    and not exists(select 1 from public.workout_executions e where e.student_user_id=d.owner_id and e.status in ('in_progress','completed') and (e.started_at at time zone d.timezone)::date=p_job.local_date);
  elsif p_job.kind='weight_reminder' then return not exists(select 1 from jsonb_array_elements_text(d.schedule->'weightDates') r where r::date between week_start and week_start+6);
  elsif p_job.kind='measurement_reminder' then return not d.schedule->'measurementWeeks' ? to_char(week_start,'YYYY-MM-DD'); end if;
  return false;
end $$;

create function public.claim_notification_jobs(p_limit integer default 25,p_native_ready boolean default false) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.notification_jobs; d public.notification_devices; result jsonb:='[]'; token uuid; allowed_at timestamptz;
begin
  if p_limit is null or p_limit not between 1 and 100 or p_native_ready is null then raise exception 'invalid notification claim limit' using errcode='22023'; end if;
  -- A crashed worker's lease expires; attempts are still bounded.
  -- Skip an acknowledgement's job locks rather than waiting with sibling locks.
  with expired as (select id from public.notification_jobs where status='claimed' and claimed_until<=now() for update skip locked)
  update public.notification_jobs recovered set status=case when expires_at<=now() or attempts>=5 then 'failed' else 'pending' end,claim_token=null,claimed_until=null,updated_at=now()
    from expired where recovered.id=expired.id;
  for j in select nj.* from public.notification_jobs nj join public.notification_devices nd on nd.id=nj.device_id
    where nj.status='pending' and nj.due_at<=now() and (nd.transport<>'fcm' or (p_native_ready and (select native_ready from public.notification_settings where singleton)))
    -- Recovered rows can recheck their device FK when claimed again in this
    -- transaction. Lock both targets nonblockingly before that update.
    order by nj.due_at,nj.id limit p_limit for update of nd,nj skip locked loop
    if not public.notification_job_eligible(j) then update public.notification_jobs set status='cancelled',updated_at=now() where id=j.id; continue; end if;
    select * into d from public.notification_devices where id=j.device_id;
    if d.foreground_until>now() then update public.notification_jobs set due_at=d.foreground_until,updated_at=now() where id=j.id; continue; end if;
    allowed_at:=public.notification_allowed_at(d.preferences,d.timezone,now());
    if allowed_at>now() then update public.notification_jobs set due_at=allowed_at,status=case when allowed_at>=expires_at then 'cancelled' else 'pending' end,updated_at=now() where id=j.id; continue; end if;
    token:=gen_random_uuid();
    update public.notification_jobs set status='claimed',claim_token=token,claimed_until=now()+interval '120 seconds',attempts=attempts+1,updated_at=now() where id=j.id;
    result:=result||jsonb_build_array(jsonb_build_object('id',j.id,'claimToken',token,'deviceId',d.id,'ownerId',d.owner_id,'deviceKey',d.device_key,'subscription',d.subscription,'subscriptionRevision',j.subscription_revision,'kind',j.kind,'expiresAt',j.expires_at,'href',j.href,'lang',d.lang));
  end loop;
  return result;
end $$;
create function public.notification_job_is_current(p_job_id uuid,p_claim_token uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
select exists(select 1 from public.notification_jobs j join public.notification_devices d on d.id=j.device_id
  where j.id=p_job_id and j.claim_token=p_claim_token and j.status='claimed' and j.claimed_until>now()
    and public.notification_job_eligible(j) and coalesce(d.foreground_until,'-infinity'::timestamptz)<=now()
    and (d.transport<>'fcm' or (select native_ready from public.notification_settings where singleton))
    and public.notification_allowed_at(d.preferences,d.timezone,now())<=now())
$$;
create function public.confirm_notification_job(p_job_id uuid,p_claim_token uuid,p_outcome text,p_status integer default null) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.notification_jobs; d public.notification_devices; retry_at timestamptz; selected_device uuid;
begin
  if p_outcome is null or p_outcome not in ('sent','retry','invalid','failed','cancelled','expired') or (p_status is not null and p_status not between 100 and 599) then raise exception 'invalid notification outcome' using errcode='22023'; end if;
  -- All mutations lock device before jobs, including simultaneous 410 acknowledgements.
  select device_id into selected_device from public.notification_jobs where id=p_job_id and claim_token=p_claim_token and status='claimed' and claimed_until>now();
  if not found then return false; end if;
  select * into d from public.notification_devices where id=selected_device for update;
  if not found then return false; end if;
  select * into j from public.notification_jobs where id=p_job_id and device_id=selected_device and claim_token=p_claim_token and status='claimed' and claimed_until>now() for update;
  if not found then return false; end if;
  if d.owner_id<>j.owner_id or d.subscription_revision<>j.subscription_revision or not d.enabled then
    update public.notification_jobs set status='cancelled',claim_token=null,claimed_until=null,updated_at=now() where id=j.id; return false;
  end if;
  if p_outcome='invalid' and (p_status in (404,410) or (d.transport='fcm' and p_status=400)) then
    update public.notification_devices set enabled=false,foreground_until=null,subscription_revision=subscription_revision+1,updated_at=now() where id=d.id and subscription_revision=j.subscription_revision;
    update public.notification_jobs set status='cancelled',claim_token=null,claimed_until=null,last_status=p_status,updated_at=now() where device_id=d.id and status in ('pending','claimed');
    return true;
  elsif p_outcome='retry' and (p_status is null or p_status=429 or p_status>=500 or (d.transport='fcm' and p_status=401)) and j.attempts<5 and j.expires_at>now() then
    retry_at:=now()+make_interval(secs=>least(60,5*(2^(j.attempts-1))::integer));
    update public.notification_jobs set status=case when retry_at<expires_at then 'pending' else 'failed' end,due_at=retry_at,claim_token=null,claimed_until=null,last_status=p_status,updated_at=now() where id=j.id;
  else
    update public.notification_jobs set status=case when p_outcome='sent' then 'sent' when p_outcome in ('cancelled','expired') then 'cancelled' else 'failed' end,claim_token=null,claimed_until=null,last_status=p_status,updated_at=now() where id=j.id;
  end if;
  return true;
end $$;

create function public.notification_emit_event(p_owner uuid,p_key text,p_kind text,p_href text,p_relationship uuid default null,p_assignment uuid default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.notification_devices; e public.notification_events; due timestamptz;
begin
  if p_owner is null or p_owner=auth.uid() then return; end if;
  for d in select * from public.notification_devices where owner_id=p_owner and enabled and (preferences->>'professional')::boolean order by id for update loop
    insert into public.notification_events(device_id,owner_id,event_key,kind,href,relationship_id,assignment_id)
    values(d.id,p_owner,p_key,p_kind,p_href,p_relationship,p_assignment) on conflict(device_id,event_key) do nothing returning * into e;
    if not found then continue; end if;
    due:=public.notification_allowed_at(d.preferences,d.timezone,now());
    insert into public.notification_jobs(device_id,owner_id,subscription_revision,event_id,event_key,kind,href,local_due_at,due_at,expires_at)
    values(d.id,p_owner,d.subscription_revision,e.id,p_key,p_kind,p_href,due,due,e.expires_at) on conflict(device_id,event_key) do nothing;
  end loop;
end $$;
create function public.notification_relationship_event() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare kind text; key text;
begin
  if tg_op='INSERT' then if new.status<>'active' then return new; end if; kind:='relationship_accepted';
  elsif new.status is not distinct from old.status then return new;
  elsif new.status='active' then kind:='relationship_accepted';
  elsif new.status='revoked' then kind:='relationship_ended';
  else return new; end if;
  key:=kind||':'||new.id||':'||coalesce(new.accepted_at,new.revoked_at,new.created_at)::text;
  -- Both counterpart deliveries share a transaction; acquire their devices in
  -- one order before any event or job mutation, including revocation cancellation.
  perform 1 from public.notification_devices where owner_id in (new.student_user_id,new.professional_user_id) order by id for update;
  if kind='relationship_ended' then
    update public.notification_jobs j set status='cancelled',claim_token=null,claimed_until=null,updated_at=now() from public.notification_events e
      where j.event_id=e.id and e.relationship_id=new.id and e.kind<>'relationship_ended' and j.status in ('pending','claimed');
    update public.notification_events e set consumed_at=now() where e.relationship_id=new.id and e.kind<>'relationship_ended' and e.consumed_at is null;
  end if;
  perform public.notification_emit_event(new.student_user_id,key,kind,'/#/student/professionals',new.id);
  perform public.notification_emit_event(new.professional_user_id,key,kind,'/#/professional/students',new.id);
  return new;
end $$;
create trigger notification_relationship_changed after insert or update of status on public.professional_student_relationships for each row execute function public.notification_relationship_event();
create function public.notification_assignment_event() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare relation uuid;
begin
  select id into relation from public.professional_student_relationships where professional_user_id=new.professional_user_id and student_user_id=new.student_user_id and status='active';
  if relation is null then return new; end if;
  if tg_op='INSERT' and new.status='active' then
    perform public.notification_emit_event(new.student_user_id,'program_updated:'||new.id,'program_updated','/#/student/professionals',relation,new.id);
  elsif tg_op='UPDATE' and old.status='active' and new.status='revoked'
    and not exists(select 1 from public.program_assignments a where a.student_user_id=new.student_user_id and a.status='active') then
    perform public.notification_emit_event(new.student_user_id,'program_removed:'||new.id,'program_removed','/#/student/professionals',relation,new.id);
  end if;
  return new;
end $$;
create trigger notification_program_assigned after insert on public.program_assignments for each row execute function public.notification_assignment_event();
-- Check the final transaction state: assignment replacement produces one update, no removal.
create constraint trigger notification_program_revoked after update on public.program_assignments deferrable initially deferred for each row execute function public.notification_assignment_event();
create function public.notification_execution_event() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare assignment public.program_assignments; relation uuid; kind text;
begin
  if old.status<>'in_progress' or new.status not in ('completed','abandoned') or new.assignment_id is null then return new; end if;
  select * into assignment from public.program_assignments where id=new.assignment_id;
  select id into relation from public.professional_student_relationships where professional_user_id=assignment.professional_user_id and student_user_id=new.student_user_id and status='active';
  if relation is null then return new; end if;
  kind:=case when new.status='completed' then 'student_workout_completed' else 'student_workout_abandoned' end;
  perform public.notification_emit_event(assignment.professional_user_id,kind||':'||new.id,kind,'/#/professional/students/'||new.student_user_id,relation,new.assignment_id);
  return new;
end $$;
create trigger notification_execution_finished after update of status on public.workout_executions for each row execute function public.notification_execution_event();
create function public.notification_verification_event() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.verification_status is distinct from old.verification_status then
    perform public.notification_emit_event(new.user_id,'verification_changed:'||new.user_id||':'||new.verification_status||':'||txid_current(),'verification_changed','/#/professional/profile');
  end if;
  return new;
end $$;
create trigger notification_verification_changed after update of verification_status on public.professional_profiles for each row execute function public.notification_verification_event();

-- A SECURITY DEFINER function sees its owner as current_user. The selected DB
-- role is the server capability; a client-controlled JWT role claim cannot grant it.
create or replace function public.protect_professional_profile_fields() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if current_setting('role',true) is distinct from 'service_role' and tg_op='UPDATE' and (
    new.user_id is distinct from old.user_id or new.created_at is distinct from old.created_at
    or new.verification_status is distinct from old.verification_status
  ) then raise exception 'professional profile server-managed fields cannot be changed' using errcode='42501'; end if;
  if tg_op='INSERT' and new.verification_status is distinct from 'unverified'::public.professional_verification_status
    and current_setting('role',true) is distinct from 'service_role' then
    raise exception 'professional profile verification is server-controlled' using errcode='42501';
  end if;
  new.updated_at:=clock_timestamp();
  return new;
end $$;
grant execute on function public.valid_professional_specialties(text[]) to service_role;

create function public.notification_maintenance() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare d record;
begin
  -- Per-device local date makes refilling correct across timezones and DST boundaries.
  for d in select id from public.notification_devices where enabled and expanded_local_date is distinct from (now() at time zone timezone)::date order by id loop perform public.notification_expand_device(d.id); end loop;
  -- A provider acknowledgement can hold one job while cancelling its siblings.
  -- Cleanup skips locked jobs; the next tick can expire them after that commit.
  with expired as (select id from public.notification_jobs where status in ('pending','claimed') and expires_at<=now() for update skip locked)
  update public.notification_jobs j set status='cancelled',claim_token=null,claimed_until=null,updated_at=now() from expired where j.id=expired.id;
  with retained as (select id from public.notification_jobs where updated_at<now()-interval '7 days' and status in ('sent','delivered_local','cancelled','failed') for update skip locked)
  delete from public.notification_jobs j using retained where j.id=retained.id;
  -- Events are removed after their jobs. Never cascade into a job that expiry or
  -- terminal retention skipped because another transaction still owns its lock.
  with retained as (select e.id from public.notification_events e where e.expires_at<now()-interval '7 days'
    and not exists(select 1 from public.notification_jobs j where j.event_id=e.id) for update of e skip locked)
  delete from public.notification_events e using retained where e.id=retained.id;
end $$;

-- No client can inspect subscriptions or manually enqueue a professional event.
revoke all on function public.notification_config(),public.notification_valid_subscription(jsonb),public.notification_subscription_endpoint(jsonb),public.notification_preferences(jsonb),
  public.notification_valid_date(text),public.notification_schedule(jsonb),public.notification_category_enabled(jsonb,text),
  public.notification_effective_routine(jsonb,date),public.notification_allowed_at(jsonb,text,timestamptz),
  public.notification_event_is_current(public.notification_events),public.notification_expand_device(uuid),
  public.register_notification_device(uuid,jsonb,jsonb,text,text,jsonb),
  public.read_notification_events(uuid),public.set_notification_presence(uuid,boolean),public.consume_notification_events(uuid,uuid[]),public.disable_notification_device(uuid),
  public.notification_job_eligible(public.notification_jobs),public.claim_notification_jobs(integer,boolean),public.notification_job_is_current(uuid,uuid),
  public.confirm_notification_job(uuid,uuid,text,integer),public.notification_emit_event(uuid,text,text,text,uuid,uuid),
  public.notification_relationship_event(),public.notification_assignment_event(),public.notification_execution_event(),public.notification_verification_event(),public.notification_maintenance()
  from public,anon,authenticated;
grant execute on function public.notification_config(),public.register_notification_device(uuid,jsonb,jsonb,text,text,jsonb),
  public.read_notification_events(uuid),public.set_notification_presence(uuid,boolean),
  public.consume_notification_events(uuid,uuid[]),public.disable_notification_device(uuid) to authenticated;
grant execute on function public.claim_notification_jobs(integer,boolean),public.notification_job_is_current(uuid,uuid),public.confirm_notification_job(uuid,uuid,text,integer),public.notification_maintenance() to service_role;
