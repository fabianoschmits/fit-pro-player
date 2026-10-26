begin;

create table public.community_direct_messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  client_nonce uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  read_at timestamptz,
  check (sender_id <> recipient_id),
  unique (sender_id, client_nonce)
);
create index community_dm_pair_idx on public.community_direct_messages (sender_id, recipient_id, id desc);
create index community_dm_recipient_idx on public.community_direct_messages (recipient_id, id desc);
create index community_dm_unread_idx on public.community_direct_messages (recipient_id, sender_id) where read_at is null;
alter table public.community_direct_messages enable row level security;
revoke all on public.community_direct_messages from anon, authenticated;
grant select on public.community_direct_messages to authenticated;
create policy community_dm_participants on public.community_direct_messages for select to authenticated
using ((select auth.uid()) in (sender_id, recipient_id));

create function public.community_send_message(p_peer uuid, p_body text, p_nonce uuid)
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
  return v_id::text;
end;
$$;

create function public.community_message_history(p_peer uuid, p_before bigint default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(m) || jsonb_build_object('id',m.id::text) order by m.id), '[]'::jsonb)
  from (select id,sender_id,recipient_id,body,created_at,read_at from public.community_direct_messages
    where ((sender_id = auth.uid() and recipient_id = p_peer) or (recipient_id = auth.uid() and sender_id = p_peer))
      and (p_before is null or id < p_before)
    order by id desc limit 50) m;
$$;

create function public.community_message_inbox(p_offset integer default 0, p_query text default '')
returns jsonb language sql stable security invoker set search_path = '' as $$
  with mine as (
    select *, case when sender_id = auth.uid() then recipient_id else sender_id end as peer_id
    from public.community_direct_messages where auth.uid() in (sender_id,recipient_id)
  ), latest as (
    select distinct on (peer_id) * from mine order by peer_id,id desc
  )
  select coalesce(jsonb_agg(to_jsonb(t) order by t.last_id desc), '[]'::jsonb) from (
    select l.peer_id,p.display_name,p.avatar_ref,l.body,l.created_at,l.sender_id,l.read_at,l.id as last_id,
      (select count(*) from mine u where u.peer_id=l.peer_id and u.recipient_id=auth.uid() and u.read_at is null) as unread_count
    from latest l join public.profiles p on p.id=l.peer_id
    where coalesce(p.display_name,'Usuário') ilike '%' || left(coalesce(p_query,''),100) || '%'
    order by l.id desc limit 50 offset greatest(0,least(coalesce(p_offset,0),100000))
  ) t;
$$;

create function public.community_message_unread_count()
returns bigint language sql stable security invoker set search_path = '' as $$
 select count(*) from public.community_direct_messages where recipient_id=auth.uid() and read_at is null;
$$;

create function public.community_read_messages(p_peer uuid, p_through bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  update public.community_direct_messages set read_at=clock_timestamp()
    where recipient_id=auth.uid() and sender_id=p_peer and id<=p_through and read_at is null;
end;
$$;

revoke all on function public.community_send_message(uuid,text,uuid) from public,anon;
revoke all on function public.community_message_history(uuid,bigint) from public,anon;
revoke all on function public.community_message_inbox(integer,text) from public,anon;
revoke all on function public.community_message_unread_count() from public,anon;
revoke all on function public.community_read_messages(uuid,bigint) from public,anon;
grant execute on function public.community_send_message(uuid,text,uuid) to authenticated;
grant execute on function public.community_message_history(uuid,bigint) to authenticated;
grant execute on function public.community_message_inbox(integer,text) to authenticated;
grant execute on function public.community_message_unread_count() to authenticated;
grant execute on function public.community_read_messages(uuid,bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
