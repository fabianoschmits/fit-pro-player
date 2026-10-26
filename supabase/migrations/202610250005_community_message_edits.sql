begin;

create function public.community_update_message(p_message_id bigint, p_body text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_message jsonb;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária'; end if;
  if p_body is null or char_length(btrim(p_body)) not between 1 and 3000 then
    raise exception 'A mensagem deve ter entre 1 e 3000 caracteres';
  end if;
  update public.community_direct_messages
    set body = btrim(p_body)
    where id = p_message_id and sender_id = auth.uid()
    returning to_jsonb(community_direct_messages) into v_message;
  if not found then raise exception 'Mensagem indisponível'; end if;
  return v_message || jsonb_build_object('id', p_message_id::text);
end;
$$;

revoke all on function public.community_update_message(bigint,text) from public,anon;
grant execute on function public.community_update_message(bigint,text) to authenticated;
notify pgrst, 'reload schema';
commit;
