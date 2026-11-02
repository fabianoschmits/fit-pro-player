begin;
create or replace function public.community_enforce_block() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid; peer uuid; parent_author uuid;
begin
 perform public.assert_account_active();
 if tg_table_name='community_direct_messages' then actor:=new.sender_id; peer:=new.recipient_id;
 elsif tg_table_name='community_comments' then actor:=new.author_id; select author_id into peer from public.community_posts where id=new.post_id;
 elsif tg_table_name='community_likes' then actor:=new.user_id; select author_id into peer from public.community_posts where id=new.post_id;
 elsif tg_table_name='community_comment_likes' then actor:=new.user_id; select author_id into peer from public.community_comments where id=new.comment_id;
 end if;
 perform public.community_assert_can_interact(actor,peer);
 if tg_table_name='community_comments' then
  if new.parent_comment_id is not null then
  select c.author_id into parent_author from public.community_comments c
   where c.id=new.parent_comment_id;
  perform public.community_assert_can_interact(actor,parent_author);
  end if;
 end if;
 return new;
end $$;
revoke all on function public.community_enforce_block() from public,anon,authenticated;
commit;
