-- A carry advances the comparison baseline without creating a new athlete view.
create or replace function public.carry_seen_professional_plan_days() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare current public.program_versions;
begin
 select * into current from public.program_versions where id=new.version_id;
 update public.professional_plan_update_day_views view set seen_version_id=new.version_id
 from public.program_versions seen
 where view.student_user_id=new.student_user_id and view.program_id=new.program_id and seen.id=view.seen_version_id
  and coalesce(current.weekly_plan->view.day_key,'[]'::jsonb) is not distinct from coalesce(seen.weekly_plan->view.day_key,'[]'::jsonb)
  and coalesce(current.workout_titles->view.day_key,'null'::jsonb) is not distinct from coalesce(seen.workout_titles->view.day_key,'null'::jsonb);
 return new;
end $$;

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
 (to_jsonb(p)-'rank'-'status'-'professional_user_id'-'version_number') || jsonb_build_object('professional_id',p.professional_user_id,'available',p.assignment_id is null or (p.status='active' and exists(select 1 from public.professional_student_relationships r where r.professional_user_id=p.professional_user_id and r.student_user_id=auth.uid() and r.status='active')),'workout_updates',coalesce(changes.pending,'{}'::jsonb),'workout_update_bases',coalesce(changes.bases,'{}'::jsonb),'plan_update',case when changes.changed is null then null else jsonb_build_object('is_first',base.id is null,'previous_version',base.version,'next_version',p.version,'affected_days',changes.changed) end)
 order by p.created_at desc,p.id) from page p
 left join public.professional_plan_update_views seen on seen.student_user_id=auth.uid() and seen.program_id=p.program_id
 left join public.program_versions base_row on base_row.id=seen.seen_version_id
 left join lateral (select base_row.id,to_jsonb(base_row) version) base on true
 left join lateral (select jsonb_object_agg(day,p.version->>'id') filter(where read.seen_version_id is distinct from (p.version->>'id')::uuid) pending,jsonb_object_agg(day,jsonb_build_object('version',coalesce(to_jsonb(day_base),base.version))) filter(where read.seen_version_id is distinct from (p.version->>'id')::uuid) bases,jsonb_agg(day) changed from jsonb_object_keys(coalesce(p.version->'weekly_plan','{}'::jsonb)||coalesce(base.version->'weekly_plan','{}'::jsonb)) day left join public.professional_plan_update_day_views read on read.student_user_id=auth.uid() and read.program_id=p.program_id and read.day_key=day left join public.program_versions day_base on day_base.id=read.seen_version_id where coalesce(p.version->'weekly_plan'->day,'[]'::jsonb) is distinct from coalesce(base.version->'weekly_plan'->day,'[]'::jsonb) or coalesce(p.version->'workout_titles'->day,'null'::jsonb) is distinct from coalesce(base.version->'workout_titles'->day,'null'::jsonb)) changes on true),'[]'::jsonb)) into result;
 return result;
end $$;
