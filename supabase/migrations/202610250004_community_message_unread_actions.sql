begin;

create or replace function public.community_message_unread_count()
returns bigint language sql stable security invoker set search_path = '' as $$
  with direct_unread as (
    select sender_id as peer_id, count(*)::bigint as unread_count
    from public.community_direct_messages where recipient_id=auth.uid() and read_at is null group by sender_id
  ), forced_unread as (
    select s.peer_id from public.community_message_conversation_states s
    where s.user_id=auth.uid() and s.force_unread
      and not exists (select 1 from direct_unread u where u.peer_id=s.peer_id)
  )
  select coalesce((select sum(unread_count) from direct_unread),0::bigint) + (select count(*) from forced_unread);
$$;

notify pgrst, 'reload schema';
commit;
