-- Owner-scoped history covers both direct acceptance and approved link requests.
create index if not exists professional_link_requests_accepted_invite_idx
  on public.professional_link_requests(source_invite_id, resolved_at, id) where status='accepted';

-- No enum or relationship state changes are needed for presentation.
create or replace function public.professional_generated_invites()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  perform public.assert_account_active();
  if auth.uid() is null or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then
    raise exception 'professional capability required' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(items) order by items.created_at desc, items.id), '[]'::jsonb) into result
  from (
    select i.id, i.kind, i.code, i.status, i.created_at, i.accepted_at, i.accepted_by,
      i.is_personal, i.is_custom,
      (i.status='active' or i.accepted_by is not null or i.accepted_at is not null or used.student_user_id is not null) as is_used,
      coalesce(i.accepted_by, used.student_user_id) as used_by,
      p.display_name as used_by_name,
      coalesce(i.accepted_at, used.resolved_at) as used_at
    from public.professional_invites i
    left join lateral (
      select r.student_user_id, r.resolved_at
      from public.professional_link_requests r
      where r.source_invite_id=i.id and r.professional_user_id=i.professional_user_id and r.status='accepted'
      order by r.resolved_at, r.id limit 1
    ) used on true
    left join public.profiles p on p.id=coalesce(i.accepted_by,used.student_user_id)
    where i.professional_user_id=auth.uid() and not i.is_personal
    order by i.created_at desc, i.id limit 500
  ) items;
  return result;
end;
$$;

create or replace function public.delete_revoked_professional_invite(p_invite_id uuid)
returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform public.assert_account_active();
  if auth.uid() is null or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then
    raise exception 'professional capability required' using errcode='42501';
  end if;
  -- Lock the owner invitation first, preventing new FK references while deleting.
  perform 1 from public.professional_invites
  where id=p_invite_id and professional_user_id=auth.uid() and not is_personal and status='revoked'
  for update;
  if not found then raise exception 'unused revoked invite required' using errcode='42501'; end if;
  -- Approval locks the request row. Wait for in-flight decisions, then recheck
  -- usage in the following statement's fresh READ COMMITTED snapshot.
  perform 1 from public.professional_link_requests
  where source_invite_id=p_invite_id order by id for update;
  delete from public.professional_invites i
  where i.id=p_invite_id and i.professional_user_id=auth.uid() and not i.is_personal
    and i.status='revoked' and i.accepted_by is null and i.accepted_at is null
    and not exists(select 1 from public.professional_link_requests r where r.source_invite_id=i.id and r.status='accepted');
  if not found then raise exception 'unused revoked invite required' using errcode='42501'; end if;
  -- source_invite_id uses ON DELETE SET NULL; requests and relationships survive.
  return true;
end;
$$;

revoke all on function public.professional_generated_invites() from public, anon;
revoke all on function public.delete_revoked_professional_invite(uuid) from public, anon;
grant execute on function public.professional_generated_invites() to authenticated;
grant execute on function public.delete_revoked_professional_invite(uuid) to authenticated;
notify pgrst, 'reload schema';
