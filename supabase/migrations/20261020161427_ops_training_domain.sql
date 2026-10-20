-- Read the server-owned training domains in Operations. Keep the old snapshot
-- only as a fallback for accounts that have not yet been migrated.
create or replace function public.ops_user_training(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  legacy_payload jsonb;
  legacy_updated timestamptz;
  prefs public.account_preferences;
  athlete_schedule public.athlete_schedules;
  has_domain_data boolean;
begin
  perform public.ops_require_admin();
  if p_user_id is null then
    raise exception 'user id required' using errcode = '22023';
  end if;

  select * into prefs from public.account_preferences where user_id = p_user_id;
  select * into athlete_schedule from public.athlete_schedules where user_id = p_user_id;
  has_domain_data := prefs.user_id is not null
    or athlete_schedule.user_id is not null
    or exists (select 1 from public.athlete_routines where user_id = p_user_id)
    or exists (select 1 from public.workout_sessions where user_id = p_user_id)
    or exists (select 1 from public.bodyweight_entries where user_id = p_user_id)
    or exists (select 1 from public.body_measurement_checkins where user_id = p_user_id);

  if has_domain_data then
    return jsonb_build_object(
      'has_snapshot', true,
      'profile', coalesce(prefs.preferences -> 'profile', '{}'::jsonb),
      'plan_mode', athlete_schedule.mode,
      'week', coalesce(athlete_schedule.schedule -> 'week', '{}'::jsonb),
      'day_plan', coalesce(athlete_schedule.schedule -> 'dayPlan', '{}'::jsonb),
      'routines', coalesce((
        select jsonb_agg(r.prescription || jsonb_build_object('id', r.id, 'name', r.title)
          order by r.position, r.created_at, r.id)
        from public.athlete_routines r where r.user_id = p_user_id
      ), '[]'::jsonb),
      'workout_count', (select count(*) from public.workout_sessions s
        where s.user_id = p_user_id and s.status = 'completed'),
      'recent_workouts', coalesce((
        select jsonb_agg(recent.workout order by recent.started_at desc, recent.operation_id desc)
        from (
          select o.payload -> 'workout' as workout, s.started_at, o.id as operation_id
          from public.workout_session_operations o
          join public.workout_sessions s on s.id = o.session_id and s.user_id = o.user_id
          where o.user_id = p_user_id and o.kind = 'session_completed'
            and s.status = 'completed' and jsonb_typeof(o.payload -> 'workout') = 'object'
          order by s.started_at desc, o.id desc limit 40
        ) recent
      ), '[]'::jsonb),
      'bodyweight', coalesce((
        select jsonb_agg(jsonb_build_object('id', b.id, 'd', b.measured_on,
          'w', b.weight_kg) order by b.measured_on, b.created_at, b.id)
        from public.bodyweight_entries b where b.user_id = p_user_id
      ), '[]'::jsonb),
      'body_measurements', coalesce((
        select jsonb_agg(jsonb_build_object('id', m.id, 'date', m.measured_on,
          'values', m.measurements_cm, 'notes', m.note)
          order by m.measured_on, m.created_at, m.id)
        from public.body_measurement_checkins m where m.user_id = p_user_id
      ), '[]'::jsonb),
      'snapshot_updated_at', greatest(
        prefs.updated_at, athlete_schedule.updated_at,
        (select max(r.updated_at) from public.athlete_routines r where r.user_id = p_user_id),
        (select max(s.updated_at) from public.workout_sessions s where s.user_id = p_user_id),
        (select max(b.updated_at) from public.bodyweight_entries b where b.user_id = p_user_id),
        (select max(m.updated_at) from public.body_measurement_checkins m where m.user_id = p_user_id)
      )
    );
  end if;

  select s.payload, s.updated_at into legacy_payload, legacy_updated
  from public.account_snapshots s where s.user_id = p_user_id;
  if legacy_payload is null then
    return jsonb_build_object('has_snapshot', false, 'profile', '{}'::jsonb,
      'plan_mode', null, 'week', '{}'::jsonb, 'day_plan', '{}'::jsonb,
      'routines', '[]'::jsonb, 'workout_count', 0, 'recent_workouts', '[]'::jsonb,
      'bodyweight', '[]'::jsonb, 'body_measurements', '[]'::jsonb,
      'snapshot_updated_at', null);
  end if;
  return jsonb_build_object(
    'has_snapshot', true,
    'profile', coalesce(legacy_payload -> 'profile', '{}'::jsonb),
    'plan_mode', legacy_payload ->> 'planMode',
    'week', coalesce(legacy_payload -> 'week', '{}'::jsonb),
    'day_plan', coalesce(legacy_payload -> 'dayPlan', '{}'::jsonb),
    'routines', coalesce(legacy_payload -> 'routines', '[]'::jsonb),
    'workout_count', coalesce(jsonb_array_length(legacy_payload -> 'workouts'), 0),
    'recent_workouts', coalesce((
      select jsonb_agg(item order by item ->> 'd' desc)
      from (
        select value as item
        from jsonb_array_elements(coalesce(legacy_payload -> 'workouts', '[]'::jsonb))
        order by value ->> 'd' desc limit 40
      ) recent
    ), '[]'::jsonb),
    'bodyweight', coalesce(legacy_payload -> 'bodyweight', '[]'::jsonb),
    'body_measurements', coalesce(legacy_payload -> 'bodyMeasurements', '[]'::jsonb),
    'snapshot_updated_at', legacy_updated
  );
end;
$$;

revoke all on function public.ops_user_training(uuid) from public, anon, authenticated;
grant execute on function public.ops_user_training(uuid) to authenticated;
