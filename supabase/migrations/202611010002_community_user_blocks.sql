begin;
create table public.community_user_blocks (
 blocker_id uuid not null references public.profiles(id) on delete cascade,
 blocked_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(blocker_id,blocked_id), check(blocker_id<>blocked_id)
);
create index community_user_blocks_reverse_idx on public.community_user_blocks(blocked_id,blocker_id);
alter table public.community_user_blocks enable row level security;
revoke all on public.community_user_blocks from public,anon,authenticated;
grant select,insert,delete on public.community_user_blocks to authenticated;
create policy own_blocks on public.community_user_blocks to authenticated
 using(blocker_id=(select auth.uid()) and (select public.account_is_active()))
 with check(blocker_id=(select auth.uid()) and (select public.account_is_active()));
create trigger enforce_active_account before insert or update or delete on public.community_user_blocks for each row execute function public.enforce_account_active();
create function public.community_has_block(p_peer uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 perform public.assert_account_active();
 return exists(select 1 from public.community_user_blocks where blocker_id=auth.uid() and blocked_id=p_peer);
end $$;
create function public.community_block_user(p_peer uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.assert_account_active();
 insert into public.community_user_blocks(blocker_id,blocked_id) values(auth.uid(),p_peer) on conflict do nothing;
end $$;
create function public.community_unblock_user(p_peer uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.assert_account_active();
 delete from public.community_user_blocks where blocker_id=auth.uid() and blocked_id=p_peer;
end $$;
create function public.community_list_blocks() returns setof public.community_user_blocks
language plpgsql stable security definer set search_path='' as $$
begin
 perform public.assert_account_active();
 return query select * from public.community_user_blocks where blocker_id=auth.uid() order by created_at desc;
end $$;
-- Internal predicate does not expose another user's block relationships.
create function public.community_assert_can_interact(p_actor uuid,p_peer uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.community_user_blocks where
  (blocker_id=p_actor and blocked_id=p_peer) or (blocker_id=p_peer and blocked_id=p_actor)) then
  raise exception 'interaction-unavailable' using errcode='42501';
 end if;
end $$;
revoke all on function public.community_assert_can_interact(uuid,uuid) from public,anon,authenticated;
create function public.community_enforce_block() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid; peer uuid;
begin
 perform public.assert_account_active();
 if tg_table_name='community_direct_messages' then actor:=new.sender_id; peer:=new.recipient_id;
 elsif tg_table_name='community_comments' then actor:=new.author_id; select author_id into peer from public.community_posts where id=new.post_id;
 elsif tg_table_name='community_likes' then actor:=new.user_id; select author_id into peer from public.community_posts where id=new.post_id;
 elsif tg_table_name='community_comment_likes' then actor:=new.user_id; select author_id into peer from public.community_comments where id=new.comment_id;
 end if;
 perform public.community_assert_can_interact(actor,peer);
 return new;
end $$;
revoke all on function public.community_enforce_block() from public,anon,authenticated;
create trigger respect_community_blocks before insert or update of body on public.community_direct_messages for each row execute function public.community_enforce_block();
create trigger respect_community_blocks before insert or update on public.community_comments for each row execute function public.community_enforce_block();
create trigger respect_community_blocks before insert on public.community_likes for each row execute function public.community_enforce_block();
create trigger respect_community_blocks before insert on public.community_comment_likes for each row execute function public.community_enforce_block();
-- Check before nonce-idempotency as well as at the write boundary.
do $$ declare definition text; begin
 definition:=pg_get_functiondef('public.community_send_message(uuid,text,uuid)'::regprocedure);
 definition:=regexp_replace(definition,'\m[Bb][Ee][Gg][Ii][Nn]\M','BEGIN PERFORM public.assert_account_active(); PERFORM public.community_assert_can_interact(auth.uid(),p_peer);');
 execute definition;
end $$;
revoke all on function public.community_has_block(uuid), public.community_block_user(uuid),public.community_unblock_user(uuid),public.community_list_blocks() from public,anon;
grant execute on function public.community_has_block(uuid), public.community_block_user(uuid),public.community_unblock_user(uuid),public.community_list_blocks() to authenticated;
notify pgrst,'reload schema';
commit;
