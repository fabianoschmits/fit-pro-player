-- Public identity is derived from the account-owned profile, never from a post.
create or replace function public.sync_community_public_identity()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare profile_data jsonb; next_name text; next_avatar text;
begin
  if tg_table_name = 'account_preferences' then profile_data := new.preferences->'profile';
  else
    if exists(select 1 from public.account_preferences where user_id=new.user_id and nullif(btrim(preferences#>>'{profile,name}'),'') is not null) then return new; end if;
    profile_data := new.payload->'profile';
  end if;
  next_name := nullif(left(btrim(profile_data->>'name'),120),'');
  next_avatar := case when profile_data->>'avatarId' ~ '^avatar-(0[1-9]|[1-7][0-9]|80)$' then profile_data->>'avatarId' end;
  -- Blank bootstrap profiles must not reset an established public avatar.
  if next_name is null then return new; end if;
  update public.profiles set display_name=next_name, avatar_ref=coalesce(next_avatar,avatar_ref)
    where id=new.user_id and (display_name is distinct from next_name or (next_avatar is not null and avatar_ref is distinct from next_avatar));
  return new;
end $$;
revoke all on function public.sync_community_public_identity() from public, anon, authenticated;
create trigger community_identity_preferences after insert or update of preferences on public.account_preferences for each row execute function public.sync_community_public_identity();
create trigger community_identity_snapshot after insert or update of payload on public.account_snapshots for each row execute function public.sync_community_public_identity();

with sources as (
  select user_id, preferences->'profile' as profile_data, 1 as priority from public.account_preferences
  union all select user_id, payload->'profile', 2 from public.account_snapshots
), chosen as (
  select distinct on(user_id) user_id, profile_data from sources
  where nullif(btrim(profile_data->>'name'),'') is not null order by user_id, priority
)
update public.profiles p set display_name=left(btrim(c.profile_data->>'name'),120),
  avatar_ref=case when c.profile_data->>'avatarId' ~ '^avatar-(0[1-9]|[1-7][0-9]|80)$' then c.profile_data->>'avatarId' else p.avatar_ref end
from chosen c where p.id=c.user_id;

-- A reply belongs to the same post as its parent. Editing cannot change its owner/thread.
create or replace function public.validate_community_comment()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' and (new.post_id is distinct from old.post_id or new.author_id is distinct from old.author_id or new.parent_comment_id is distinct from old.parent_comment_id) then
    raise exception 'Comment identity and thread cannot be changed' using errcode='23514';
  end if;
  if tg_op='INSERT' and exists(select 1 from public.community_posts where id=new.post_id and comments_disabled) then
    raise exception 'Os comentários estão bloqueados.' using errcode='23514';
  end if;
  if new.parent_comment_id is not null and not exists(select 1 from public.community_comments where id=new.parent_comment_id and post_id=new.post_id) then
    raise exception 'A resposta precisa pertencer à mesma postagem.' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function public.validate_community_comment() from public,anon,authenticated;
create trigger community_comment_validate before insert or update on public.community_comments for each row execute function public.validate_community_comment();
create index if not exists community_posts_author_page_idx on public.community_posts(author_id,created_at desc,id desc);
create index if not exists community_posts_page_idx on public.community_posts(created_at desc,id desc);

-- Users can mark their notifications read; the actor and target stay immutable.
revoke update on public.community_notifications from authenticated;
grant update(read_at) on public.community_notifications to authenticated;
drop policy if exists community_notifications_insert_actor on public.community_notifications;
create policy community_notifications_insert_actor on public.community_notifications for insert to authenticated with check (
  actor_id=auth.uid() and recipient_id<>auth.uid() and (
    (type='like' and exists(select 1 from public.community_posts p join public.community_likes l on l.post_id=p.id where p.id=community_notifications.post_id and p.author_id=recipient_id and l.user_id=auth.uid()))
    or (type='comment' and exists(select 1 from public.community_comments c join public.community_posts p on p.id=c.post_id left join public.community_comments parent on parent.id=c.parent_comment_id where c.id=community_notifications.comment_id and c.post_id=community_notifications.post_id and c.author_id=auth.uid() and (p.author_id=recipient_id or parent.author_id=recipient_id)))
  )
);
notify pgrst, 'reload schema';
