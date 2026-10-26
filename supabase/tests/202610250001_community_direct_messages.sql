-- Isolated fixtures; rollback guarantees no test messages become visible.
begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
 n uuid:=gen_random_uuid(); first_id text; repeated_id text; history jsonb; inbox jsonb;
begin
 insert into auth.users(id) values(a),(b),(c);
 perform set_config('request.jwt.claim.sub',a::text,true);
 set local role authenticated;
 first_id:=public.community_send_message(b,'Olá',n);
 repeated_id:=public.community_send_message(b,'Olá',n);
 if first_id<>repeated_id then raise exception 'Retry duplicated message'; end if;
 history:=public.community_message_history(b);
 if jsonb_array_length(history)<>1 then raise exception 'Sender history failed'; end if;
 if (history->0->>'sender_id')<>a::text then raise exception 'Incorrect sender'; end if;
 begin
   insert into public.community_direct_messages(sender_id,recipient_id,body,client_nonce) values(b,a,'Spoof',gen_random_uuid());
   raise exception 'Direct insertion allowed';
 exception when insufficient_privilege then null; end;
 begin
   perform public.community_send_message(a,'Self',gen_random_uuid());
   raise exception 'Self message allowed';
 exception when raise_exception then if sqlerrm<>'Destinatário inválido' then raise; end if; end;
 begin
   perform public.community_send_message(b,' ',gen_random_uuid());
   raise exception 'Empty message allowed';
 exception when raise_exception then if sqlerrm<>'A mensagem deve ter entre 1 e 3000 caracteres' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',c::text,true);
 if exists(select 1 from public.community_direct_messages where id=first_id::bigint) then raise exception 'Third party can read message'; end if;
 if public.community_message_history(a)<>'[]'::jsonb then raise exception 'Third party history leak'; end if;
 if public.community_message_inbox()<>'[]'::jsonb then raise exception 'Third party inbox leak'; end if;
 perform public.community_read_messages(a,first_id::bigint);
 perform set_config('request.jwt.claim.sub',b::text,true);
 if public.community_message_unread_count()<>1 then raise exception 'Unread count failed'; end if;
 inbox:=public.community_message_inbox();
 if jsonb_array_length(inbox)<>1 or inbox->0->>'body'<>'Olá' then raise exception 'Inbox failed'; end if;
 perform public.community_read_messages(a,first_id::bigint);
 if public.community_message_unread_count()<>0 then raise exception 'Read failed'; end if;
 perform set_config('request.jwt.claim.sub',a::text,true);
 if public.community_message_history(b)->0->>'read_at' is null then raise exception 'Read receipt failed'; end if;
 for i in 1..29 loop perform public.community_send_message(b,'Rate test',gen_random_uuid()); end loop;
 begin
   perform public.community_send_message(b,'Rate overflow',gen_random_uuid());
   raise exception 'Rate limit missing';
 exception when raise_exception then if sqlerrm<>'Muitas mensagens. Aguarde um minuto e tente novamente.' then raise; end if; end;
 reset role;
 insert into public.community_direct_messages(sender_id,recipient_id,body,client_nonce)
 select b,a,'Pagination fixture',gen_random_uuid() from generate_series(1,55);
 set local role authenticated;
 history:=public.community_message_history(b);
 if jsonb_array_length(history)<>50 then raise exception 'History page limit failed'; end if;
 if jsonb_array_length(public.community_message_history(b,(history->0->>'id')::bigint))<>35 then raise exception 'History cursor failed'; end if;
 reset role;
 if has_function_privilege('anon','public.community_send_message(uuid,text,uuid)','execute') then raise exception 'Anonymous send allowed'; end if;
 if has_table_privilege('authenticated','public.community_direct_messages','UPDATE') then raise exception 'Arbitrary updates allowed'; end if;
end $$;
select 'PASS: private messaging, idempotency, validation, RLS, inbox, read receipts, rate limiting and pagination' as result;
rollback;
