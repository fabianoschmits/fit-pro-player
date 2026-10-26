begin;

create table public.community_message_conversation_states (
  user_id uuid not null references public.profiles(id) on delete cascade,
  peer_id uuid not null references public.profiles(id) on delete cascade,
  hidden_at timestamptz,
  force_unread boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, peer_id),
  check (user_id <> peer_id)
);
alter table public.community_message_conversation_states enable row level security;
revoke all on public.community_message_conversation_states from anon, authenticated;
grant select on public.community_message_conversation_states to authenticated;
create policy community_message_state_read_own on public.community_message_conversation_states
  for select to authenticated using (user_id = auth.uid());

create or replace function public.community_send_message(p_peer uuid, p_body text, p_nonce uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_id bigint;
begin
  if v_user is null then raise exception 'Autenticação necessária'; end if;
  if p_peer is null or p_peer = v_user or not exists(select 1 from public.profiles where id = p_peer) then
    raise exception 'Destinatário inválido';
  end if;
  if p_nonce is null or p_body is null or char_length(btrim(p_body)) not between 1 and 3000 then
    raise exception 'A mensagem deve ter entre 1 e 3000 caracteres';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 250001));
  select id into v_id from public.community_direct_messages where sender_id = v_user and client_nonce = p_nonce;
  if found then return v_id::text; end if;
  if (select count(*) from public.community_direct_messages where sender_id = v_user and created_at > clock_timestamp() - interval '1 minute') >= 30 then
    raise exception 'Muitas mensagens. Aguarde um minuto e tente novamente.';
  end if;
  insert into public.community_direct_messages(sender_id,recipient_id,body,client_nonce)
  values(v_user,p_peer,btrim(p_body),p_nonce) returning id into v_id;
  update public.community_message_conversation_states
    set hidden_at = null, force_unread = false, updated_at = clock_timestamp()
    where (user_id = v_user and peer_id = p_peer) or (user_id = p_peer and peer_id = v_user);
  insert into public.community_notifications(recipient_id, actor_id, type, message_count, created_at, read_at)
  values(p_peer, v_user, 'message', 1, clock_timestamp(), null)
  on conflict (recipient_id, actor_id) where type = 'message' do update
  set message_count = case when public.community_notifications.read_at is null then public.community_notifications.message_count + 1 else 1 end,
      created_at = excluded.created_at,
      read_at = null;
  return v_id::text;
end;
$$;

create or replace function public.community_message_inbox(p_offset integer default 0, p_query text default '')
returns jsonb language sql stable security invoker set search_path = '' as $$
  with mine as (
    select *, case when sender_id = auth.uid() then recipient_id else sender_id end as peer_id
    from public.community_direct_messages where auth.uid() in (sender_id,recipient_id)
  ), latest as (
    select distinct on (peer_id) * from mine order by peer_id,id desc
  ), unread as (
    select sender_id as peer_id, count(*)::bigint as unread_count
    from public.community_direct_messages where recipient_id = auth.uid() and read_at is null group by sender_id
  )
  select coalesce(jsonb_agg(to_jsonb(t) order by t.last_id desc), '[]'::jsonb) from (
    select l.peer_id,p.display_name,p.avatar_ref,l.body,l.created_at,l.sender_id,l.read_at,l.id as last_id,
      greatest(coalesce(u.unread_count, 0::bigint), case when coalesce(s.force_unread, false) then 1::bigint else 0::bigint end) as unread_count
    from latest l join public.profiles p on p.id=l.peer_id
    left join unread u on u.peer_id = l.peer_id
    left join public.community_message_conversation_states s on s.user_id = auth.uid() and s.peer_id = l.peer_id
    where (s.hidden_at is null or l.created_at > s.hidden_at)
      and coalesce(p.display_name,'Usuário') ilike '%' || left(coalesce(p_query,''),100) || '%'
    order by l.id desc limit 50 offset greatest(0,least(coalesce(p_offset,0),100000))
  ) t;
$$;

create or replace function public.community_message_unread_count()
returns bigint language sql stable security invoker set search_path = '' as $$
  with direct_unread as (
    select sender_id as peer_id, count(*)::bigint as unread_count
    from public.community_direct_messages where recipient_id=auth.uid() and read_at is null group by sender_id
  ), forced_unread as (
    select s.peer_id from public.community_message_conversation_states s
    where s.user_id=auth.uid() and s.force_unread and not exists (select 1 from direct_unread u where u.peer_id=s.peer_id)
  )
  select coalesce((select sum(unread_count) from direct_unread),0::bigint) + (select count(*) from forced_unread);
$$;

create or replace function public.community_read_messages(p_peer uuid, p_through bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  update public.community_direct_messages set read_at=clock_timestamp()
    where recipient_id=auth.uid() and sender_id=p_peer and id<=p_through and read_at is null;
  update public.community_message_conversation_states
    set force_unread = false, updated_at = clock_timestamp()
    where user_id = auth.uid() and peer_id = p_peer and force_unread;
end;
$$;

create function public.community_mark_conversation_unread(p_peer uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  if p_peer is null or p_peer = auth.uid() or not exists (
    select 1 from public.community_direct_messages
    where (sender_id = auth.uid() and recipient_id = p_peer) or (sender_id = p_peer and recipient_id = auth.uid())
  ) then raise exception 'Conversa indisponível'; end if;
  insert into public.community_message_conversation_states(user_id,peer_id,hidden_at,force_unread,updated_at)
  values(auth.uid(),p_peer,null,true,clock_timestamp())
  on conflict (user_id,peer_id) do update set hidden_at=null, force_unread=true, updated_at=excluded.updated_at;
end;
$$;

create function public.community_hide_conversation(p_peer uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  if p_peer is null or p_peer = auth.uid() or not exists (
    select 1 from public.community_direct_messages
    where (sender_id = auth.uid() and recipient_id = p_peer) or (sender_id = p_peer and recipient_id = auth.uid())
  ) then raise exception 'Conversa indisponível'; end if;
  insert into public.community_message_conversation_states(user_id,peer_id,hidden_at,force_unread,updated_at)
  values(auth.uid(),p_peer,clock_timestamp(),false,clock_timestamp())
  on conflict (user_id,peer_id) do update set hidden_at=excluded.hidden_at, force_unread=false, updated_at=excluded.updated_at;
end;
$$;

create function public.community_delete_message(p_message_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare v_peer uuid; v_remaining bigint;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  delete from public.community_direct_messages where id = p_message_id and sender_id = auth.uid() returning recipient_id into v_peer;
  if not found then raise exception 'Mensagem indisponível'; end if;
  select count(*) into v_remaining from public.community_direct_messages where sender_id=auth.uid() and recipient_id=v_peer and read_at is null;
  if v_remaining = 0 then
    delete from public.community_notifications where recipient_id=v_peer and actor_id=auth.uid() and type='message';
  else
    update public.community_notifications set message_count=v_remaining::integer, created_at=clock_timestamp(), read_at=null
      where recipient_id=v_peer and actor_id=auth.uid() and type='message';
  end if;
end;
$$;

revoke all on function public.community_mark_conversation_unread(uuid) from public,anon;
revoke all on function public.community_hide_conversation(uuid) from public,anon;
revoke all on function public.community_delete_message(bigint) from public,anon;
grant execute on function public.community_mark_conversation_unread(uuid) to authenticated;
grant execute on function public.community_hide_conversation(uuid) to authenticated;
grant execute on function public.community_delete_message(bigint) to authenticated;

notify pgrst, 'reload schema';
commit;
