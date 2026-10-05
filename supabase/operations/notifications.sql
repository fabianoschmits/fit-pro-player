-- Run AFTER the portable migration and deployed push-dispatch worker, using an
-- administrator connection. Provide psql variables through private stdin:
-- push_dispatch_secret, push_project_url, push_vapid_public_key.
-- These values must match the Edge Function environment; never commit them.
-- Cron, pg_net and Vault must already be enabled by the Supabase administrator.
\set ON_ERROR_STOP on
begin;
do $$begin
  if to_regnamespace('cron') is null or to_regnamespace('net') is null or to_regnamespace('vault') is null then
    raise exception 'Enable pg_cron, pg_net and Supabase Vault before provisioning notifications';
  end if;
end$$;

create or replace function public.notification_provision(p_secret text,p_url text,p_public_key text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare secret_id uuid;
begin
  if p_secret is null or p_secret !~ '^[A-Za-z0-9_-]{43,128}$' or p_url is null or p_url !~ '^https://[a-z0-9]+\.supabase\.co$'
    or p_public_key is null or p_public_key !~ '^[A-Za-z0-9_-]{87}$' then raise exception 'Invalid notification provisioning parameters'; end if;
  select id into secret_id from vault.secrets where name='PUSH_DISPATCH_SECRET';
  if secret_id is null then perform vault.create_secret(p_secret,'PUSH_DISPATCH_SECRET','Dedicated notification dispatcher authorization');
  else perform vault.update_secret(secret_id,p_secret,'PUSH_DISPATCH_SECRET','Dedicated notification dispatcher authorization'); end if;
  select id into secret_id from vault.secrets where name='PUSH_PROJECT_URL';
  if secret_id is null then perform vault.create_secret(p_url,'PUSH_PROJECT_URL','Notification dispatcher project endpoint');
  else perform vault.update_secret(secret_id,p_url,'PUSH_PROJECT_URL','Notification dispatcher project endpoint'); end if;
  update public.notification_settings set ready=false,vapid_public_key=p_public_key where singleton;
end $$;
revoke all on function public.notification_provision(text,text,text) from public,anon,authenticated,service_role;
select public.notification_provision(:'push_dispatch_secret',:'push_project_url',:'push_vapid_public_key');
drop function public.notification_provision(text,text,text);

create or replace function public.notification_dispatch_tick() returns bigint
language plpgsql security definer set search_path=public,pg_temp as $$
declare config public.notification_settings; secret text; project_url text; request_id bigint;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('fitpp.notifications.dispatch',0)) then return null; end if;
  select * into config from public.notification_settings where singleton for update;
  if not config.ready or config.dispatcher_until>now() then return null; end if;
  -- Recover expired claims without calling an Edge Function while idle.
  -- Provider acknowledgements may hold sibling job locks; defer those rows.
  with expired as (select id from public.notification_jobs where status='claimed' and claimed_until<=now() for update skip locked)
  update public.notification_jobs j set status=case when expires_at<=now() or attempts>=5 then 'failed' else 'pending' end,claim_token=null,claimed_until=null,updated_at=now()
    from expired where j.id=expired.id;
  if not exists(select 1 from public.notification_jobs j join public.notification_devices d on d.id=j.device_id
    where j.status='pending' and j.due_at<=now() and j.expires_at>now() and d.enabled
      and coalesce(d.foreground_until,'-infinity'::timestamptz)<=now() and public.notification_job_eligible(j)
      and (d.transport<>'fcm' or config.native_ready)
      and public.notification_allowed_at(d.preferences,d.timezone,now())<=now() limit 1) then return null; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name='PUSH_DISPATCH_SECRET';
  select decrypted_secret into project_url from vault.decrypted_secrets where name='PUSH_PROJECT_URL';
  if secret is null or project_url is null then return null; end if;
  update public.notification_settings set dispatcher_until=now()+interval '10 seconds' where singleton;
  select net.http_post(url:=project_url||'/functions/v1/push-dispatch',
    headers:=jsonb_build_object('Content-Type','application/json','x-push-dispatch-secret',secret),body:='{}'::jsonb,timeout_milliseconds:=90000) into request_id;
  return request_id;
end $$;
revoke all on function public.notification_dispatch_tick() from public,anon,authenticated,service_role;

do $$declare job record; new_job_id bigint; begin
  for job in select jobid from cron.job where jobname in ('fitpp-notifications-dispatch','fitpp-notifications-maintenance') loop
    update public.notification_settings set scheduler_job_ids=case when job.jobid=any(scheduler_job_ids) then scheduler_job_ids else array_append(scheduler_job_ids,job.jobid) end where singleton;
    perform cron.unschedule(job.jobid);
  end loop;
  select cron.schedule('fitpp-notifications-dispatch','5 seconds','select public.notification_dispatch_tick()') into new_job_id;
  update public.notification_settings set scheduler_job_ids=array_append(scheduler_job_ids,new_job_id) where singleton;
  select cron.schedule('fitpp-notifications-maintenance','0 * * * *',
    $cron$select public.notification_maintenance(); delete from cron.job_run_details where jobid in (select unnest(scheduler_job_ids) from public.notification_settings where singleton) and end_time<now()-interval '3 days';$cron$) into new_job_id;
  update public.notification_settings set scheduler_job_ids=array_append(scheduler_job_ids,new_job_id) where singleton;
end $$;
-- Refill is checked hourly but writes only when each device's local date changes.
-- Activation is the last operation; partial provisioning rolls back to not ready.
update public.notification_settings set ready=true,dispatcher_until=null where singleton;
commit;
