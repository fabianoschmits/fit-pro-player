-- Caller-scoped set projections. No reads of personal account snapshots.
create index if not exists executions_assignment_started_id_idx on public.workout_executions(assignment_id, started_at desc, id desc);

-- Internal projection shared by counts and student pages; never callable by clients.
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
    where a.professional_user_id=auth.uid() and a.status='active'
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
revoke all on function public.professional_workspace_students() from public, anon, authenticated;

create or replace function public.professional_students_page(p_search text default '',p_status text default 'all',p_offset int default 0,p_limit int default 30)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then
    raise exception 'professional capability required' using errcode='42501';
  end if;
  if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100
    or p_status is null or p_status not in ('all','with_program','without_program','attention') then
    raise exception 'invalid page parameters' using errcode='22023';
  end if;
  with filtered as materialized (
    select s.* from public.professional_workspace_students() s
    where strpos(lower(s.display_name),lower(btrim(coalesce(p_search,''))))>0
      and (p_status='all' or (p_status='with_program' and s.active_assignment_id is not null)
        or (p_status='without_program' and s.active_assignment_id is null)
        or (p_status='attention' and jsonb_array_length(s.attention_reasons)>0))
  ), page as (
    select * from filtered order by relationship_created_at desc, student_user_id desc offset p_offset limit p_limit
  )
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p.relationship_created_at desc,p.student_user_id desc) from page p),'[]'::jsonb),
    'total',(select count(*) from filtered),'offset',p_offset,'has_more',(select count(*) from filtered)>p_offset::bigint+p_limit)
  into result;
  return result;
end;
$$;

create or replace function public.professional_programs_page(p_search text default '',p_archived bool default null,p_offset int default 0,p_limit int default 20)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then
    raise exception 'professional capability required' using errcode='42501';
  end if;
  if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 then
    raise exception 'invalid page parameters' using errcode='22023';
  end if;
  with owned as materialized (
    select p.* from public.programs p where p.professional_user_id=auth.uid()
      and (p_archived is null or p.archived=p_archived)
      and strpos(lower(p.title || ' ' || coalesce(p.objective,'') || ' ' || coalesce(p.description,'')),lower(btrim(coalesce(p_search,''))))>0
  ), latest as (
    select distinct on (v.program_id) v.program_id,v.weekly_plan,max(v.published_at) over (partition by v.program_id) as published_at
    from public.program_versions v join owned p on p.id=v.program_id
    where v.published_at is not null
    order by v.program_id,v.version_number desc,v.id desc
  ), counts as (
    select a.program_id,count(distinct a.student_user_id) as student_count
    from public.program_assignments a join owned p on p.id=a.program_id
    join public.professional_student_relationships r on r.professional_user_id=auth.uid() and r.student_user_id=a.student_user_id and r.status='active'
    where a.professional_user_id=auth.uid() and a.status='active' group by a.program_id
  ), projected as materialized (
    select p.id,p.title,p.description,p.objective,p.archived,
      (select count(*) from jsonb_each(coalesce(v.weekly_plan,'{}'::jsonb)) d where jsonb_typeof(d.value)='array' and jsonb_array_length(d.value)>0) as workout_count,
      coalesce(c.student_count,0) as student_count,greatest(p.updated_at,v.published_at) as last_changed_at
    from owned p left join latest v on v.program_id=p.id left join counts c on c.program_id=p.id
  ), page as (
    select * from projected order by last_changed_at desc,id desc offset p_offset limit p_limit
  )
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p.last_changed_at desc,p.id desc) from page p),'[]'::jsonb),
    'total',(select count(*) from projected),'offset',p_offset,'has_more',(select count(*) from projected)>p_offset::bigint+p_limit)
  into result;
  return result;
end;
$$;

create or replace function public.professional_executions_page(p_student_id uuid default null,p_search text default '',p_status text default 'all',p_from timestamptz default null,p_to timestamptz default null,p_offset int default 0,p_limit int default 20)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then
    raise exception 'professional capability required' using errcode='42501';
  end if;
  if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100
    or p_status is null or p_status not in ('all','in_progress','completed','abandoned')
    or (p_from is not null and p_to is not null and p_from>=p_to) then
    raise exception 'invalid page parameters' using errcode='22023';
  end if;
  with filtered as materialized (
    select e.*,coalesce(p.display_name,'') as display_name,p.avatar_ref,pr.title as program_title,v.version_number
    from public.workout_executions e join public.program_assignments a on a.id=e.assignment_id
    join public.programs pr on pr.id=a.program_id and pr.professional_user_id=auth.uid()
    join public.program_versions v on v.id=e.version_id and v.program_id=pr.id
    left join public.profiles p on p.id=e.student_user_id
    where a.professional_user_id=auth.uid() and e.student_user_id=a.student_user_id
      and (p_student_id is null or e.student_user_id=p_student_id)
      and (p_status='all' or e.status::text=p_status)
      and (p_from is null or e.started_at>=p_from) and (p_to is null or e.started_at<p_to)
      and strpos(lower(coalesce(p.display_name,'') || ' ' || pr.title || ' ' || e.day_key || ' ' || coalesce(e.prescription_snapshot->>'workoutTitle','')),lower(btrim(coalesce(p_search,''))))>0
  ), page as (
    select * from filtered order by started_at desc,id desc offset p_offset limit p_limit
  )
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p.started_at desc,p.id desc) from page p),'[]'::jsonb),
    'total',(select count(*) from filtered),'offset',p_offset,'has_more',(select count(*) from filtered)>p_offset::bigint+p_limit)
  into result;
  return result;
end;
$$;

create or replace function public.professional_dashboard_summary(p_local_date date,p_timezone text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare result jsonb; local_day_key text; day_start timestamptz; day_end timestamptz;
begin
  if auth.uid() is null or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='professional') then
    raise exception 'professional capability required' using errcode='42501';
  end if;
  if p_local_date is null or not isfinite(p_local_date) or p_timezone is null or not exists(select 1 from pg_timezone_names where name=p_timezone) then
    raise exception 'valid local date and timezone required' using errcode='22023';
  end if;
  local_day_key := (array['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])[extract(dow from p_local_date)::int+1];
  day_start := p_local_date::timestamp at time zone p_timezone;
  day_end := (p_local_date+1)::timestamp at time zone p_timezone;
  with students as materialized (
    select * from public.professional_workspace_students()
  ), today_executions as (
    select distinct on (e.assignment_id) e.assignment_id,e.id,e.status
    from public.workout_executions e join students s on s.active_assignment_id=e.assignment_id
    where e.student_user_id=s.student_user_id and e.version_id=s.version_id and e.day_key=local_day_key
      and e.started_at>=day_start and e.started_at<day_end
    order by e.assignment_id,case e.status when 'completed' then 0 when 'in_progress' then 1 else 2 end,e.started_at desc,e.id desc
  ), agenda as materialized (
    select s.*,local_day_key as day_key,coalesce(nullif(btrim(v.workout_titles->>local_day_key),''),local_day_key) as workout_title,
      case when e.status in ('completed','in_progress') then e.status::text else 'scheduled' end as status,e.id as execution_id
    from students s join public.program_versions v on v.id=s.version_id
    left join today_executions e on e.assignment_id=s.active_assignment_id
    where jsonb_typeof(v.weekly_plan->local_day_key)='array' and jsonb_array_length(v.weekly_plan->local_day_key)>0
  ), recent as (
    select e.*,coalesce(p.display_name,'') as display_name,p.avatar_ref,pr.title as program_title,v.version_number
    from public.workout_executions e join public.program_assignments a on a.id=e.assignment_id
    join public.programs pr on pr.id=a.program_id and pr.professional_user_id=auth.uid()
    join public.program_versions v on v.id=e.version_id and v.program_id=pr.id
    left join public.profiles p on p.id=e.student_user_id
    where a.professional_user_id=auth.uid() and e.student_user_id=a.student_user_id
    order by e.started_at desc,e.id desc limit 10
  )
  select jsonb_build_object('active_students',(select count(*) from students),
    'attention_students',(select count(*) from students where jsonb_array_length(attention_reasons)>0),
    'today_workouts',(select count(*) from agenda),
    'active_programs',(select count(distinct s.program_id) from students s join public.programs p on p.id=s.program_id where not p.archived),
    'pending_invites',(select count(*) from public.professional_invites where professional_user_id=auth.uid() and status='pending' and (expires_at is null or expires_at>now())),
    'today',coalesce((select jsonb_agg(to_jsonb(a) order by a.relationship_created_at desc,a.student_user_id desc) from (select * from agenda order by relationship_created_at desc,student_user_id desc limit 10) a),'[]'::jsonb),
    'recent_activity',coalesce((select jsonb_agg(to_jsonb(e) order by e.started_at desc,e.id desc) from recent e),'[]'::jsonb))
  into result;
  return result;
end;
$$;

revoke all on function public.professional_students_page(text,text,int,int) from public, anon, authenticated;
revoke all on function public.professional_programs_page(text,bool,int,int) from public, anon, authenticated;
revoke all on function public.professional_executions_page(uuid,text,text,timestamptz,timestamptz,int,int) from public, anon, authenticated;
revoke all on function public.professional_dashboard_summary(date,text) from public, anon, authenticated;
grant execute on function public.professional_students_page(text,text,int,int) to authenticated;
grant execute on function public.professional_programs_page(text,bool,int,int) to authenticated;
grant execute on function public.professional_executions_page(uuid,text,text,timestamptz,timestamptz,int,int) to authenticated;
grant execute on function public.professional_dashboard_summary(date,text) to authenticated;
