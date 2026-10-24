-- Run inside a transaction and roll back: fixtures never become visible to users.
begin;

do $$
declare actor uuid; other_user uuid; post_a uuid; post_b uuid; parent_id uuid; child_id uuid; grandchild_id uuid; value text;
begin
  actor := gen_random_uuid(); other_user := gen_random_uuid();
  insert into auth.users(id) values(actor),(other_user);
  insert into public.account_preferences(user_id,preferences) values(actor,'{"profile":{"name":"Test fixture","avatarId":"avatar-01"}}');
  perform set_config('test.community_actor',actor::text,true);
  perform set_config('test.community_other',other_user::text,true);
  update public.account_preferences set preferences=jsonb_set(jsonb_set(preferences,'{profile,name}','"Community QA"'),'{profile,avatarId}','"avatar-80"') where user_id=actor;
  select avatar_ref into value from public.profiles where id=actor;
  if value <> 'avatar-80' then raise exception 'Avatar did not persist'; end if;
  select display_name into value from public.profiles where id=actor;
  if value <> 'Community QA' then raise exception 'Name did not persist'; end if;
  if has_column_privilege('authenticated','public.profiles','suspended_at','select') then raise exception 'Private column exposed'; end if;
  if has_function_privilege('authenticated','public.sync_community_public_identity()','execute') then raise exception 'Private sync function exposed'; end if;
  insert into public.community_posts(author_id,image_path) values(actor,actor||'/qa.jpg') returning id into post_a;
  insert into public.community_posts(author_id,image_path,comments_disabled) values(other_user,other_user||'/qa.jpg',true) returning id into post_b;
  insert into public.community_comments(post_id,author_id,body) values(post_a,actor,'QA root') returning id into parent_id;
  insert into public.community_comments(post_id,author_id,body,parent_comment_id) values(post_a,other_user,'QA reply',parent_id) returning id into child_id;
  insert into public.community_comments(post_id,author_id,body,parent_comment_id) values(post_a,actor,'QA nested',child_id) returning id into grandchild_id;
  begin
    insert into public.community_comments(post_id,author_id,body) values(post_b,actor,'Should fail');
    raise exception 'Blocked post accepted comment';
  exception when check_violation then null; end;
  update public.community_posts set comments_disabled=false where id=post_b;
  begin
    insert into public.community_comments(post_id,author_id,body,parent_comment_id) values(post_b,actor,'Should fail',parent_id);
    raise exception 'Cross-post reply accepted';
  exception when check_violation then null; end;
  begin
    update public.community_comments set author_id=other_user where id=parent_id;
    raise exception 'Comment owner changed';
  exception when check_violation then null; end;
  delete from public.community_comments where id=parent_id;
  if exists(select 1 from public.community_comments where id in(child_id,grandchild_id)) then raise exception 'Cascade failed'; end if;
  if has_column_privilege('authenticated','public.community_notifications','actor_id','update') then raise exception 'Notification actor can be changed'; end if;
end $$;
select 'Community identity, nested replies, ownership and comment lock passed' as result;
do $$
declare actor uuid; other_user uuid; post_id uuid; comment_id uuid; affected integer;
begin
  actor := current_setting('test.community_actor')::uuid;
  other_user := current_setting('test.community_other')::uuid;
  insert into public.community_posts(author_id,image_path) values(other_user,other_user||'/qa-rls.jpg') returning id into post_id;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  set local role authenticated;
  perform id,display_name,avatar_ref from public.profiles where id=other_user;
  insert into public.community_comments(post_id,author_id,body) values(post_id,actor,'QA authenticated') returning id into comment_id;
  insert into public.community_likes(post_id,user_id) values(post_id,actor);
  insert into public.community_notifications(recipient_id,actor_id,type,post_id,comment_id) values(other_user,actor,'comment',post_id,comment_id);
  insert into public.community_notifications(recipient_id,actor_id,type,post_id) values(other_user,actor,'like',post_id);
  begin
    insert into public.community_comments(post_id,author_id,body) values(post_id,other_user,'Spoofed');
    raise exception 'Spoofed identity accepted';
  exception when insufficient_privilege then null; end;
  delete from public.community_posts p where p.id=post_id;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Deleted another author post'; end if;
  update public.community_comments c set body='QA edited' where c.id=comment_id;
  delete from public.community_comments c where c.id=comment_id;
  reset role;
end $$;
select 'Authenticated comments, likes, notifications and RLS passed' as result;

rollback;
