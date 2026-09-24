create or replace function public.revoke_professional_invite(p_invite_id uuid)
returns public.professional_invites
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.professional_invites;
begin
  update public.professional_invites
  set status = 'revoked', accepted_at = null
  where id = p_invite_id
    and professional_user_id = auth.uid()
    and status = 'pending'
  returning * into result;
  if not found then
    raise exception 'pending invite not found' using errcode = '42501';
  end if;
  return result;
end;
$$;

revoke all on function public.revoke_professional_invite(uuid) from public, anon;
grant execute on function public.revoke_professional_invite(uuid) to authenticated;
