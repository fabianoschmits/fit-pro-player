begin;

alter table public.community_notifications
  add column if not exists message_count integer not null default 1;
alter table public.community_notifications
  drop constraint if exists community_notifications_message_count_check;
alter table public.community_notifications
  add constraint community_notifications_message_count_check check (message_count >= 1);
alter table public.community_notifications
  drop constraint if exists community_notifications_type_check;
alter table public.community_notifications
  add constraint community_notifications_type_check check (type in ('like', 'comment', 'message'));
create unique index if not exists community_message_notification_per_sender_idx
  on public.community_notifications(recipient_id, actor_id) where type = 'message';

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
  insert into public.community_notifications(recipient_id, actor_id, type, message_count, created_at, read_at)
  values(p_peer, v_user, 'message', 1, clock_timestamp(), null)
  on conflict (recipient_id, actor_id) where type = 'message' do update
  set message_count = case when public.community_notifications.read_at is null then public.community_notifications.message_count + 1 else 1 end,
      created_at = excluded.created_at,
      read_at = null;
  return v_id::text;
end;
$$;

notify pgrst, 'reload schema';
commit;
