-- A pending day is always compared with the last version the athlete saw for
-- that particular day, falling back to the program-level acknowledgement.
create or replace function public.athlete_plan_library_page(p_offset integer default 0,p_limit integer default 30) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
 with ranked as (
  select l.*,a.professional_user_id,a.program_id,a.status,v.version_number,to_jsonb(v) version,pp.professional_name,row_number() over(partition by coalesce(a.program_id,l.id) order by v.version_number desc nulls last,l.created_at desc,l.id) rank
  from public.athlete_plan_library l left join public.program_assignments a on a.id=l.assignment_id left join public.program_versions v on v.id=a.version_id left join public.professional_profiles pp on pp.user_id=a.professional_user_id where l.user_id=auth.uid()
 ), latest as (select * from ranked where rank=1), page as (select * from latest order by created_at desc,id offset greatest(0,p_offset) limit least(50,greatest(1,p_limit)))
 select jsonb_build_object('selectedId',(select plan_id from public.athlete_plan_selection where user_id=auth.uid()),'total',(select count(*) from latest),'items',coalesce((select jsonb_agg(
 (to_jsonb(p)-'rank'-'status'-'professional_user_id'-'version_number') || jsonb_build_object('professional_id',p.professional_user_id,'available',p.assignment_id is null or (p.status='active' and exists(select 1 from public.professional_student_relationships r where r.professional_user_id=p.professional_user_id and r.student_user_id=auth.uid() and r.status='active')),'workout_updates',coalesce(changes.pending,'{}'::jsonb),'workout_update_bases',coalesce(changes.bases,'{}'::jsonb),'plan_update',case when changes.changed is null then null else jsonb_build_object('is_first',global_base.id is null,'previous_version',global_base.version,'next_version',p.version,'affected_days',changes.changed) end)
 order by p.created_at desc,p.id) from page p
 left join public.professional_plan_update_views seen on seen.student_user_id=auth.uid() and seen.program_id=p.program_id
 left join public.program_versions global_base_row on global_base_row.id=seen.seen_version_id
 left join lateral (select global_base_row.id,to_jsonb(global_base_row) version) global_base on true
 left join lateral (
  select jsonb_object_agg(day,p.version->>'id') filter(where changed) pending,
   jsonb_object_agg(day,jsonb_build_object('version',coalesce(to_jsonb(day_base),global_base.version))) filter(where changed) bases,
   jsonb_agg(day) filter(where changed) changed
  from unnest(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday']) as days(day)
  left join public.professional_plan_update_day_views read on read.student_user_id=auth.uid() and read.program_id=p.program_id and read.day_key=day
  left join public.program_versions day_base on day_base.id=coalesce(read.seen_version_id,global_base_row.id)
  cross join lateral (select coalesce(p.version->'weekly_plan'->day,'[]'::jsonb) is distinct from coalesce(to_jsonb(day_base)->'weekly_plan'->day,'[]'::jsonb) or coalesce(p.version->'workout_titles'->day,'null'::jsonb) is distinct from coalesce(to_jsonb(day_base)->'workout_titles'->day,'null'::jsonb) changed) comparison
 ) changes on true),'[]'::jsonb)) into result;
 return result;
end $$;

create or replace function public.mark_professional_plan_update_day_seen(p_plan_id uuid,p_version_id uuid,p_day text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare assignment public.program_assignments; global_base_id uuid; day_base_id uuid; current public.program_versions; pending boolean;
begin
 select a.* into assignment from public.athlete_plan_library l join public.program_assignments a on a.id=l.assignment_id where l.id=p_plan_id and l.user_id=auth.uid();
 if not found or assignment.version_id<>p_version_id or p_day not in ('sunday','monday','tuesday','wednesday','thursday','friday','saturday') then raise exception 'plan ownership required' using errcode='42501'; end if;
 select seen_version_id into global_base_id from public.professional_plan_update_views where student_user_id=auth.uid() and program_id=assignment.program_id;
 select seen_version_id into day_base_id from public.professional_plan_update_day_views where student_user_id=auth.uid() and program_id=assignment.program_id and day_key=p_day;
 select * into current from public.program_versions where id=p_version_id;
 insert into public.professional_plan_update_day_views(student_user_id,program_id,day_key,seen_version_id) values(auth.uid(),assignment.program_id,p_day,p_version_id)
 on conflict(student_user_id,program_id,day_key) do update set seen_version_id=excluded.seen_version_id,seen_at=now();
 select exists(select 1 from unnest(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday']) as days(day)
  left join public.professional_plan_update_day_views read on read.student_user_id=auth.uid() and read.program_id=assignment.program_id and read.day_key=day
  left join public.program_versions base on base.id=coalesce(read.seen_version_id,global_base_id)
  where coalesce(current.weekly_plan->day,'[]'::jsonb) is distinct from coalesce(base.weekly_plan->day,'[]'::jsonb)
     or coalesce(current.workout_titles->day,'null'::jsonb) is distinct from coalesce(base.workout_titles->day,'null'::jsonb)) into pending;
 if not pending then insert into public.professional_plan_update_views(student_user_id,program_id,seen_version_id) values(auth.uid(),assignment.program_id,p_version_id)
  on conflict(student_user_id,program_id) do update set seen_version_id=excluded.seen_version_id,seen_at=now(); end if;
end $$;
