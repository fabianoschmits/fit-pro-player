create or replace function public.create_professional_invite(p_kind public.invite_kind default 'code')
returns public.professional_invites
language plpgsql security definer set search_path = public, pg_temp
as $$
declare result public.professional_invites; caller uuid := auth.uid(); raw_token text := md5(gen_random_uuid()::text || clock_timestamp()::text); invite_code text := upper(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 10));
begin
  if caller is null or not exists (select 1 from public.user_roles where user_id = caller and role = 'professional') then raise exception 'professional capability required' using errcode = '42501'; end if;
  insert into public.professional_invites(professional_user_id, kind, code, token_hash)
  values (caller, p_kind, invite_code, raw_token) returning * into result;
  result.token_hash := raw_token;
  return result;
end;
$$;
revoke all on function public.create_professional_invite(public.invite_kind) from public, anon;
grant execute on function public.create_professional_invite(public.invite_kind) to authenticated;
