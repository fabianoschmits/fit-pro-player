-- Enable administrators to dismiss/delete notifications from their ops feed
create table if not exists public.ops_notification_dismissals (
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  notification_id text not null check (char_length(notification_id) between 1 and 300),
  dismissed_at timestamptz not null default now(),
  primary key (admin_user_id, notification_id)
);

alter table public.ops_notification_dismissals enable row level security;
revoke all on table public.ops_notification_dismissals from public, anon, authenticated;
create policy ops_notification_dismissals_owner on public.ops_notification_dismissals
  for select to authenticated using (admin_user_id = auth.uid());

create or replace function public.ops_delete_notifications(p_notification_ids text[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := public.ops_require_admin();
begin
  if p_notification_ids is null or cardinality(p_notification_ids) = 0 then
    return;
  end if;

  insert into public.ops_notification_dismissals(admin_user_id, notification_id)
  select caller, unnest(p_notification_ids)
  on conflict (admin_user_id, notification_id) do update set dismissed_at = now();
end;
$$;

revoke all on function public.ops_delete_notifications(text[]) from public, anon, authenticated;
grant execute on function public.ops_delete_notifications(text[]) to authenticated;

-- Update ops_list_notifications to filter out dismissed notifications
create or replace function public.ops_list_notifications(p_limit integer default 25, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  caller uuid := public.ops_require_admin();
  lim integer := greatest(1, least(coalesce(p_limit, 25), 100));
  off_count integer := greatest(0, coalesce(p_offset, 0));
  result jsonb;
begin
  with feed as materialized (
    select f.*, r.read_at from public.ops_notification_feed() f
    left join public.ops_notification_reads r on r.notification_id = f.id and r.admin_user_id = caller
    where not exists (
      select 1 from public.ops_notification_dismissals d
      where d.notification_id = f.id and d.admin_user_id = caller
    )
  ), page as (
    select f.* from feed f order by f.created_at desc, f.id limit lim offset off_count
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc, p.id) from page p), '[]'::jsonb),
    'unread_count', (select count(*) from feed f where f.read_at is null),
    'has_more', (select count(*) > off_count + lim from feed)
  ) into result;
  return result;
end;
$$;
