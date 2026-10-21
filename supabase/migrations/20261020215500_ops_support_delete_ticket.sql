-- Migration to support bulk actions and deleting support tickets in ops console
create or replace function public.ops_support_delete_ticket(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.ops_require_admin();
  if not exists (select 1 from public.support_tickets where id = p_ticket_id) then
    raise exception 'ticket not found' using errcode = 'P0002';
  end if;

  -- Associated messages and events are deleted via foreign key on delete cascade
  delete from public.support_tickets where id = p_ticket_id;
end;
$$;

revoke all on function public.ops_support_delete_ticket(uuid) from public, anon, authenticated;
grant execute on function public.ops_support_delete_ticket(uuid) to authenticated;
