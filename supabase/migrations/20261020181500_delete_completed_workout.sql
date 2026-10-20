-- Keep the history deletion authoritative and idempotent across offline retries.
create or replace function public.delete_completed_workout(p_session_id uuid)
returns boolean
language plpgsql security definer set search_path = public, pg_temp
as $$
declare caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'authenticated identity required' using errcode = '42501';
  end if;
  if p_session_id is null then
    raise exception 'invalid workout deletion' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.workout_sessions
    where id = p_session_id and user_id = caller and status <> 'completed'
  ) then
    raise exception 'workout session is not completed' using errcode = '55000';
  end if;
  delete from public.workout_sessions
  where id = p_session_id and user_id = caller and status = 'completed';
  return true;
end;
$$;

revoke all on function public.delete_completed_workout(uuid) from public, anon, authenticated;
grant execute on function public.delete_completed_workout(uuid) to authenticated;
