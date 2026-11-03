-- Actual selection drives trainer status and notifications; delivery never applies a plan.
begin;
alter table public.notification_events drop constraint notification_events_kind_check;
alter table public.notification_events add constraint notification_events_kind_check check(kind in ('program_received','program_updated','program_removed','relationship_accepted','relationship_ended','student_workout_completed','student_workout_abandoned','verification_changed','student_plan_selected','student_plan_left'));
alter table public.notification_jobs drop constraint notification_jobs_kind_check;
alter table public.notification_jobs add constraint notification_jobs_kind_check check(kind in ('workout_reminder','weight_reminder','measurement_reminder','program_received','program_updated','program_removed','relationship_accepted','relationship_ended','student_workout_completed','student_workout_abandoned','verification_changed','student_plan_selected','student_plan_left'));

create function public.notification_plan_selection_event() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare previous_assignment public.program_assignments; next_assignment public.program_assignments; relation uuid; event_revision bigint;
begin
 if tg_op='UPDATE' and old.plan_id=new.plan_id then return new; end if;
 select revision into event_revision from public.athlete_schedules where user_id=new.user_id;
 if tg_op='UPDATE' then
  select a.* into previous_assignment from public.athlete_plan_library l join public.program_assignments a on a.id=l.assignment_id where l.id=old.plan_id and l.user_id=new.user_id and l.source_type='professional';
 end if;
 select a.* into next_assignment from public.athlete_plan_library l join public.program_assignments a on a.id=l.assignment_id where l.id=new.plan_id and l.user_id=new.user_id and l.source_type='professional';
 if previous_assignment.id is not null and previous_assignment.professional_user_id is distinct from next_assignment.professional_user_id then
  select id into relation from public.professional_student_relationships where professional_user_id=previous_assignment.professional_user_id and student_user_id=new.user_id and status='active';
  if relation is not null then
   perform public.notification_emit_event(previous_assignment.professional_user_id,'student_plan_left:'||new.user_id||':'||event_revision,'student_plan_left','/#/professional/students/'||new.user_id,relation,previous_assignment.id);
  end if;
 end if;
 if next_assignment.id is not null then
  select id into relation from public.professional_student_relationships where professional_user_id=next_assignment.professional_user_id and student_user_id=new.user_id and status='active';
  if relation is not null then
   perform public.notification_emit_event(next_assignment.professional_user_id,'student_plan_selected:'||new.user_id||':'||event_revision,'student_plan_selected','/#/professional/students/'||new.user_id,relation,next_assignment.id);
  end if;
 end if;
 return new;
end $$;
revoke all on function public.notification_plan_selection_event() from public,anon,authenticated;
create trigger notification_plan_selection_changed after insert or update of plan_id on public.athlete_plan_selection for each row execute function public.notification_plan_selection_event();

-- A delivered newer version can revoke the assignment while the old version remains selected.
create or replace function public.professional_workspace_students()
returns table (
  student_user_id uuid, display_name text, avatar_ref text, relationship_created_at timestamptz,
  active_assignment_id uuid, program_id uuid, program_title text, version_id uuid, version_number integer,
  last_execution_at timestamptz, last_execution_status public.execution_status,
  current_program jsonb, last_activity_at timestamptz, attention_reasons jsonb
)
language sql security definer set search_path = public, pg_temp
as $$
  with active_assignments as (
    select a.* from public.program_assignments a
    join public.athlete_plan_library l on l.assignment_id=a.id
    join public.athlete_plan_selection selected on selected.plan_id=l.id and selected.user_id=a.student_user_id
    where a.professional_user_id=auth.uid() and (a.status='active' or exists(select 1 from public.program_assignments newer where newer.student_user_id=a.student_user_id and newer.professional_user_id=a.professional_user_id and newer.program_id=a.program_id and newer.status='active'))
  ), latest as (
    select distinct on (e.assignment_id) e.assignment_id,e.started_at,e.status
    from public.workout_executions e join active_assignments a on a.id=e.assignment_id
    where e.student_user_id=a.student_user_id and e.version_id=a.version_id
    order by e.assignment_id,e.started_at desc,e.id desc
  )
  select r.student_user_id, coalesce(p.display_name,''), p.avatar_ref, r.created_at,
    a.id,a.program_id,pr.title,a.version_id,v.version_number,e.started_at,e.status,
    case when a.id is not null then jsonb_build_object('id',pr.id,'title',pr.title,'assignment_id',a.id,'version_id',v.id,'version_number',v.version_number,'assigned_at',a.created_at) end,
    e.started_at,
    to_jsonb(array_remove(array[
      case when a.id is null then 'without_program' end,
      case when exists(select 1 from public.professional_plan_drafts d where d.professional_id=auth.uid() and d.student_id=r.student_user_id and d.revision is distinct from d.sent_revision) then 'draft' end,
      case when e.status='abandoned' then 'abandoned' end,
      case when e.status='in_progress' and e.started_at < now()-interval '24 hours' then 'stale_in_progress' end,
      case when a.id is not null and coalesce(e.started_at,a.created_at) <= now()-interval '7 days' then 'inactive_7_days' end
    ],null))
  from public.professional_student_relationships r
  left join public.profiles p on p.id=r.student_user_id
  left join active_assignments a on a.student_user_id=r.student_user_id
  left join public.programs pr on pr.id=a.program_id and pr.professional_user_id=auth.uid()
  left join public.program_versions v on v.id=a.version_id and v.program_id=pr.id
  left join latest e on e.assignment_id=a.id
  where r.professional_user_id=auth.uid() and r.status='active';
$$;

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
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_account_active();
  return query select
    r.student_user_id,
    coalesce(p.display_name, '') as display_name,
    p.avatar_ref,
    r.created_at,
    coalesce((
      select jsonb_agg(to_jsonb(a_row) order by a_row.created_at desc)
      from (
        select a.*, pr.title as program_title, pv.version_number, exists(select 1 from public.athlete_plan_selection sel join public.athlete_plan_library lib on lib.id=sel.plan_id and lib.user_id=sel.user_id where sel.user_id=r.student_user_id and lib.assignment_id=a.id) as is_selected
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
end;
$$;


revoke all on function public.professional_client_detail(uuid) from public, anon;
grant execute on function public.professional_client_detail(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
