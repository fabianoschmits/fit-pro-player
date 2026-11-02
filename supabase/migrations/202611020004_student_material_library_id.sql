-- Expose the exact library row; delivery and activation behavior stay unchanged.
create or replace function public.student_professional_detail(p_professional_user_id uuid)
returns table (professional jsonb, relationship jsonb, materials jsonb, executions jsonb)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_account_active();
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  return query
  select
    (select to_jsonb(s) from public.student_professional_summaries() s where s.professional_user_id = r.professional_user_id),
    jsonb_build_object('id', r.id, 'status', r.status, 'linked_at', coalesce(r.accepted_at, r.created_at)),
    coalesce((
      select jsonb_agg(m.item order by m.assigned_at desc, m.assignment_id desc)
      from (
        select a.id as assignment_id, a.created_at as assigned_at,
          jsonb_build_object(
            'library_plan_id', l.id, 'assignment_id', a.id, 'program_id', a.program_id, 'version_id', a.version_id,
            'title', p.title, 'description', p.description, 'objective', p.objective, 'status', a.status,
            'version_number', v.version_number, 'published_at', v.published_at,
            'assigned_at', a.created_at, 'weekly_plan', v.weekly_plan, 'workout_titles', v.workout_titles
          ) as item
        from public.program_assignments a
        left join public.athlete_plan_library l on l.assignment_id = a.id and l.user_id = r.student_user_id and l.source_type = 'professional'
        join public.programs p on p.id = a.program_id and p.professional_user_id = a.professional_user_id
        join public.program_versions v on v.id = a.version_id and v.program_id = p.id
        where a.professional_user_id = r.professional_user_id
          and a.student_user_id = r.student_user_id and v.published_at is not null
        order by a.created_at desc, a.id desc limit 100
      ) m
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(to_jsonb(e_row) order by e_row.started_at desc, e_row.id desc)
      from (
        select e.*, p.title as program_title, v.version_number
        from public.workout_executions e
        join public.program_assignments a on a.id = e.assignment_id
          and a.version_id = e.version_id and a.student_user_id = e.student_user_id
        join public.programs p on p.id = a.program_id and p.professional_user_id = a.professional_user_id
        join public.program_versions v on v.id = a.version_id and v.program_id = p.id
        where a.professional_user_id = r.professional_user_id
          and a.student_user_id = r.student_user_id and e.student_user_id = r.student_user_id
          and v.published_at is not null
        order by e.started_at desc, e.id desc limit 100
      ) e_row
    ), '[]'::jsonb)
  from public.professional_student_relationships r
  where r.student_user_id = auth.uid() and r.status = 'active'
    and r.professional_user_id = p_professional_user_id;
end
$$;
