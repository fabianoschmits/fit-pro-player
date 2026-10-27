-- A missing note and an explicit JSON null both mean that the workout has no note.
create or replace function public.complete_workout_session(
  p_session_id uuid,
  p_writer_token uuid,
  p_expected_revision bigint,
  p_operation_id uuid,
  p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  result public.workout_sessions;
  existing public.workout_session_operations;
  v_note text;
begin
  if caller is null then raise exception 'authenticated identity required' using errcode = '42501'; end if;
  if p_session_id is null or p_writer_token is null or p_operation_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 262144
    or (p_payload ? 'note' and jsonb_typeof(p_payload->'note') not in ('string', 'null')) then
    raise exception 'invalid workout completion' using errcode = '22023';
  end if;

  v_note := nullif(btrim(coalesce(p_payload->>'note', '')), '');
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'invalid workout note' using errcode = '22023';
  end if;

  select * into result from public.workout_sessions where id = p_session_id and user_id = caller for update;
  if not found then raise exception 'workout session not found' using errcode = '42501'; end if;
  select * into existing from public.workout_session_operations where session_id = result.id and operation_id = p_operation_id;
  if found then
    if existing.kind <> 'session_completed' or existing.payload <> p_payload then raise exception 'operation id payload mismatch' using errcode = '22023'; end if;
    return to_jsonb(result);
  end if;
  if result.status <> 'active' then raise exception 'workout session already finalized' using errcode = '55000'; end if;
  if result.writer_token <> p_writer_token then raise exception 'stale workout writer' using errcode = '40001'; end if;
  if result.revision <> p_expected_revision then raise exception 'workout revision conflict' using errcode = '40001'; end if;

  insert into public.workout_session_operations(session_id,user_id,operation_id,session_revision,kind,payload)
  values(result.id,caller,p_operation_id,result.revision + 1,'session_completed',p_payload);
  update public.workout_sessions
  set status = 'completed',
      revision = revision + 1,
      completed_at = now(),
      updated_at = now(),
      note = v_note
  where id = result.id
  returning * into result;
  return to_jsonb(result);
end;
$$;
