-- Legacy accounts retain their snapshot until domain sync. Prefer current data.
create or replace function public.professional_client_detail(p_student_user_id uuid)
returns table (
  student_user_id uuid,
  display_name text,
  avatar_ref text,
  relationship_created_at timestamptz,
  assignments jsonb,
  executions jsonb,
  profile jsonb, weight_history jsonb, measurements jsonb
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    r.student_user_id,
    coalesce(p.display_name, '') as display_name,
    p.avatar_ref,
    r.created_at,
    coalesce((
      select jsonb_agg(to_jsonb(a_row) order by a_row.created_at desc)
      from (
        select a.*, pr.title as program_title, pv.version_number
        from public.program_assignments a
        join public.programs pr on pr.id = a.program_id
        join public.program_versions pv on pv.id = a.version_id
        where a.professional_user_id = auth.uid()
          and a.student_user_id = r.student_user_id
      ) a_row
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(to_jsonb(e_row) order by e_row.started_at desc)
      from (
        select e.*, pr.title as program_title, pv.version_number
        from public.workout_executions e
        join public.program_assignments a on a.id = e.assignment_id
        join public.programs pr on pr.id = a.program_id
        join public.program_versions pv on pv.id = e.version_id
        where a.professional_user_id = auth.uid()
          and e.student_user_id = r.student_user_id
      ) e_row
    ), '[]'::jsonb),
    jsonb_build_object('birthDate', source.profile->'birthDate', 'sex', source.profile->'sex', 'heightCm', source.profile->'heightCm', 'startWeight', source.profile->'startWeight', 'goal', source.profile->'goal', 'experience', source.profile->'experience'),
    coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'measured_on',w.measured_on,'weight_kg',w.weight_kg,'created_at',w.created_at) order by w.measured_on desc,w.created_at desc) from public.bodyweight_entries w where w.user_id=r.student_user_id),
      (select jsonb_agg(jsonb_build_object(
        'id', 'legacy-weight-' || entry.ordinality,
        'measured_on', entry.item->>'d', 'weight_kg', entry.item->'w',
        'created_at', case when entry.item->>'t' ~ '^[0-9]{13}$' then to_timestamp((entry.item->>'t')::numeric / 1000) end
      ) order by entry.item->>'d' desc, entry.item->>'t' desc)
      from jsonb_array_elements(case when jsonb_typeof(legacy.payload->'bodyweight')='array' then legacy.payload->'bodyweight' else '[]'::jsonb end) with ordinality entry(item,ordinality)
      where jsonb_typeof(entry.item->'w')='number' and entry.item->>'d' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'measured_on',m.measured_on,'measurements_cm',m.measurements_cm,'note',m.note) order by m.measured_on desc,m.created_at desc) from public.body_measurement_checkins m where m.user_id=r.student_user_id),
      (select jsonb_agg(jsonb_build_object(
        'id', 'legacy-measurement-' || entry.ordinality,
        'measured_on', entry.item->>'date', 'measurements_cm', entry.item->'values', 'note', entry.item->>'notes'
      ) order by entry.item->>'date' desc, entry.ordinality desc)
      from jsonb_array_elements(case when jsonb_typeof(legacy.payload->'bodyMeasurements')='array' then legacy.payload->'bodyMeasurements' else '[]'::jsonb end) with ordinality entry(item,ordinality)
      where jsonb_typeof(entry.item->'values')='object' and entry.item->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'), '[]'::jsonb)
  from public.professional_student_relationships r
  left join public.profiles p on p.id = r.student_user_id
  left join public.account_preferences prefs on prefs.user_id = r.student_user_id
  left join public.account_snapshots legacy on legacy.user_id=r.student_user_id and prefs.user_id is null
  cross join lateral (select case when prefs.user_id is not null then prefs.preferences->'profile' else legacy.payload->'profile' end as profile) source
  where r.professional_user_id = auth.uid()
    and r.student_user_id = p_student_user_id
    and r.status = 'active';
$$;


revoke all on function public.professional_client_detail(uuid) from public, anon;
grant execute on function public.professional_client_detail(uuid) to authenticated;
