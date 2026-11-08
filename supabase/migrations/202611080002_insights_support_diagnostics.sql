begin;
create table if not exists public.support_technical_diagnostics (
 ticket_id uuid primary key references public.support_tickets(id) on delete cascade,
 diagnostics jsonb not null, shared_at timestamptz not null default now()
);
alter table public.support_technical_diagnostics enable row level security;
revoke all on public.support_technical_diagnostics from public,anon,authenticated;
create or replace function public.support_share_diagnostics(p_ticket_id uuid,p_diagnostics jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb; clean jsonb:='[]';
begin
 perform public.assert_account_active();
 if not exists(select 1 from public.support_tickets where id=p_ticket_id and user_id=auth.uid()) then raise exception 'ticket unavailable' using errcode='42501'; end if;
 if jsonb_typeof(p_diagnostics)<>'array' or jsonb_array_length(p_diagnostics)>20 or octet_length(p_diagnostics::text)>8192 then raise exception 'invalid diagnostics' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(p_diagnostics) loop
  if item->>'type' not in ('runtime-error','asset-error','unhandled-rejection','navigation','long-task','storage-error','sync-error') then raise exception 'invalid type' using errcode='22023'; end if;
  clean:=clean||jsonb_build_array(jsonb_build_object('type',item->>'type','duration',least(3600000,greatest(0,coalesce((item->>'duration')::integer,0))),'count',least(1000,greatest(0,coalesce((item->>'count')::integer,0)))));
 end loop;
 insert into public.support_technical_diagnostics(ticket_id,diagnostics) values(p_ticket_id,clean) on conflict(ticket_id) do update set diagnostics=excluded.diagnostics,shared_at=now();
end $$;
create or replace function public.ops_support_diagnostics(p_ticket_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare caller uuid:=public.ops_require_admin(); result jsonb;
begin
 insert into public.insights_admin_access(admin_id,resource) values(caller,'support_diagnostics');
 select diagnostics into result from public.support_technical_diagnostics where ticket_id=p_ticket_id and shared_at>now()-interval '30 days';
 return result;
end $$;
revoke all on function public.support_share_diagnostics(uuid,jsonb),public.ops_support_diagnostics(uuid) from public,anon,authenticated;
grant execute on function public.support_share_diagnostics(uuid,jsonb),public.ops_support_diagnostics(uuid) to authenticated;
create or replace function public.insights_cleanup() returns void language sql security definer set search_path=public,pg_temp as $$
 delete from public.insights_events where occurred_at<now()-interval '90 days';
 delete from public.insights_admin_access where created_at<now()-interval '180 days';
 delete from public.insights_alerts where last_seen<now()-interval '90 days';
 delete from public.support_technical_diagnostics where shared_at<now()-interval '30 days';
$$;
commit;
