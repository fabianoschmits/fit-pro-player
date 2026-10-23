-- Security hardening for community data.

-- Comment likes must never be reachable through the anonymous role.
alter table public.community_comment_likes enable row level security;
revoke all on table public.community_comment_likes from public, anon;
grant select, insert, delete on table public.community_comment_likes to authenticated;

-- Notifications are created by the signed-in actor.  The policy prevents
-- forging the actor and prevents self-notification spam through this path.
grant insert on table public.community_notifications to authenticated;
drop policy if exists community_notifications_insert_actor on public.community_notifications;
create policy community_notifications_insert_actor
  on public.community_notifications
  for insert to authenticated
  with check (
    actor_id = auth.uid()
    and recipient_id <> auth.uid()
    and type in ('like', 'comment')
  );

-- Community joins need only these public profile fields. Keep private/account
-- state columns available to trusted server-side functions only.
revoke select on table public.profiles from authenticated;
grant select (id, display_name, avatar_ref) on table public.profiles to authenticated;

create or replace function public.is_current_user_suspended()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select suspended_at is not null from public.profiles where id = auth.uid()), false);
$$;
revoke all on function public.is_current_user_suspended() from public, anon;
grant execute on function public.is_current_user_suspended() to authenticated;

-- Enforce upload constraints server-side as well as in the client.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'community-posts';

-- Supabase installs pg_stat_statements in the extensions schema. Include it in
-- the function search path so the admin health query resolves at runtime.
alter function public.ops_system_health()
  set search_path = public, extensions, pg_temp;
