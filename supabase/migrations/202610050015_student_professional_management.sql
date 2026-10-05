-- Narrow student read boundary: profile RLS remains owner-only.
create or replace function public.student_professional_summaries()
returns table (
  professional_user_id uuid,
  relationship_id uuid,
  professional_name text,
  bio text,
  specialties text[],
  city_region text,
  registration_type text,
  registration_number text,
  verification_status public.professional_verification_status,
  linked_at timestamptz,
  active_program_title text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  return query
  select r.professional_user_id, r.id, pp.professional_name, pp.bio,
    coalesce(pp.specialties, '{}'::text[]), pp.city_region, pp.registration_type,
    pp.registration_number, coalesce(pp.verification_status, 'unverified'::public.professional_verification_status),
    coalesce(r.accepted_at, r.created_at), active_program.title
  from public.professional_student_relationships r
  left join public.professional_profiles pp on pp.user_id = r.professional_user_id
  left join lateral (
    select p.title
    from public.program_assignments a
    join public.programs p on p.id = a.program_id and p.professional_user_id = a.professional_user_id
    join public.program_versions v on v.id = a.version_id and v.program_id = p.id
    where a.professional_user_id = r.professional_user_id
      and a.student_user_id = r.student_user_id and a.status = 'active'
      and v.published_at is not null
    order by a.created_at desc, a.id desc limit 1
  ) active_program on true
  where r.student_user_id = auth.uid() and r.status = 'active'
  order by coalesce(r.accepted_at, r.created_at) desc, r.id desc;
end
$$;

create or replace function public.student_professional_detail(p_professional_user_id uuid)
returns table (professional jsonb, relationship jsonb, materials jsonb, executions jsonb)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
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
            'assignment_id', a.id, 'program_id', a.program_id, 'version_id', a.version_id,
            'title', p.title, 'description', p.description, 'status', a.status,
            'version_number', v.version_number, 'published_at', v.published_at,
            'assigned_at', a.created_at, 'weekly_plan', v.weekly_plan
          ) as item
        from public.program_assignments a
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

revoke all on function public.student_professional_summaries() from public, anon, authenticated;
revoke all on function public.student_professional_detail(uuid) from public, anon, authenticated;
grant execute on function public.student_professional_summaries() to authenticated;
grant execute on function public.student_professional_detail(uuid) to authenticated;
