-- Recognition is per workout day. A plan version is globally seen only after every
-- day that still differs from the last globally seen version has been opened.
create table public.professional_plan_update_day_views (
 student_user_id uuid not null references auth.users(id) on delete cascade,
 program_id uuid not null references public.programs(id) on delete cascade,
 day_key text not null check(day_key in ('sunday','monday','tuesday','wednesday','thursday','friday','saturday')),
 seen_version_id uuid not null references public.program_versions(id) on delete restrict,
 seen_at timestamptz not null default now(),
 primary key(student_user_id,program_id,day_key)
);
alter table public.professional_plan_update_day_views enable row level security;
revoke all on public.professional_plan_update_day_views from public,anon,authenticated;
grant select on public.professional_plan_update_day_views to authenticated;
create policy professional_plan_update_day_views_student_read on public.professional_plan_update_day_views for select to authenticated using(student_user_id=auth.uid());

-- The previous migration optimistically marked first deliveries as seen. They are
-- now intentionally unread so the athlete receives the "Novo plano" experience.
delete from public.professional_plan_update_views view
using public.professional_plan_update_events event
where event.student_user_id=view.student_user_id and event.program_id=view.program_id
 and event.previous_version_id is null and event.new_version_id=view.seen_version_id;

create function public.prevent_initial_plan_auto_view() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if exists(select 1 from public.professional_plan_update_events e where e.student_user_id=new.student_user_id and e.program_id=new.program_id and e.new_version_id=new.seen_version_id and e.previous_version_id is null)
  and not exists(select 1 from public.professional_plan_update_day_views d where d.student_user_id=new.student_user_id and d.program_id=new.program_id and d.seen_version_id=new.seen_version_id)
 then return null; end if;
 return new;
end $$;
create trigger professional_plan_initial_view_guard before insert or update on public.professional_plan_update_views for each row execute function public.prevent_initial_plan_auto_view();

create or replace function public.mark_professional_plan_update_day_seen(p_plan_id uuid,p_version_id uuid,p_day text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare assignment public.program_assignments; base_id uuid; base public.program_versions; current public.program_versions; changed boolean; pending boolean;
begin
 select a.* into assignment from public.athlete_plan_library l join public.program_assignments a on a.id=l.assignment_id where l.id=p_plan_id and l.user_id=auth.uid();
 if not found or assignment.version_id<>p_version_id or p_day not in ('sunday','monday','tuesday','wednesday','thursday','friday','saturday') then raise exception 'plan ownership required' using errcode='42501'; end if;
 select seen_version_id into base_id from public.professional_plan_update_views where student_user_id=auth.uid() and program_id=assignment.program_id;
 select * into current from public.program_versions where id=p_version_id;
 if base_id is not null then select * into base from public.program_versions where id=base_id; end if;
 changed := coalesce(current.weekly_plan->p_day,'[]'::jsonb) is distinct from coalesce(base.weekly_plan->p_day,'[]'::jsonb)
   or coalesce(current.workout_titles->p_day,'null'::jsonb) is distinct from coalesce(base.workout_titles->p_day,'null'::jsonb);
 if not changed then return; end if;
 insert into public.professional_plan_update_day_views(student_user_id,program_id,day_key,seen_version_id) values(auth.uid(),assignment.program_id,p_day,p_version_id)
 on conflict(student_user_id,program_id,day_key) do update set seen_version_id=excluded.seen_version_id,seen_at=now();
 select exists(select 1 from jsonb_object_keys(coalesce(current.weekly_plan,'{}'::jsonb)||coalesce(base.weekly_plan,'{}'::jsonb)) day
  left join public.professional_plan_update_day_views read on read.student_user_id=auth.uid() and read.program_id=assignment.program_id and read.day_key=day
  where (coalesce(current.weekly_plan->day,'[]'::jsonb) is distinct from coalesce(base.weekly_plan->day,'[]'::jsonb)
     or coalesce(current.workout_titles->day,'null'::jsonb) is distinct from coalesce(base.workout_titles->day,'null'::jsonb))
    and read.seen_version_id is distinct from p_version_id) into pending;
 if not pending then insert into public.professional_plan_update_views(student_user_id,program_id,seen_version_id) values(auth.uid(),assignment.program_id,p_version_id)
  on conflict(student_user_id,program_id) do update set seen_version_id=excluded.seen_version_id,seen_at=now(); end if;
end $$;
revoke all on function public.mark_professional_plan_update_day_seen(uuid,uuid,text) from public,anon;
grant execute on function public.mark_professional_plan_update_day_seen(uuid,uuid,text) to authenticated;

create or replace function public.mark_library_workout_seen(p_plan_id uuid,p_day text,p_change_version_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$ begin perform public.mark_professional_plan_update_day_seen(p_plan_id,p_change_version_id,p_day); end $$;

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
 (to_jsonb(p)-'rank'-'status'-'professional_user_id'-'version_number') || jsonb_build_object('professional_id',p.professional_user_id,'available',p.assignment_id is null or (p.status='active' and exists(select 1 from public.professional_student_relationships r where r.professional_user_id=p.professional_user_id and r.student_user_id=auth.uid() and r.status='active')),'workout_updates',coalesce(changes.pending,'{}'::jsonb),'plan_update',case when changes.changed is null then null else jsonb_build_object('is_first',base.id is null,'previous_version',base.version,'next_version',p.version,'affected_days',changes.changed) end)
 order by p.created_at desc,p.id) from page p
 left join public.professional_plan_update_views seen on seen.student_user_id=auth.uid() and seen.program_id=p.program_id
 left join public.program_versions base_row on base_row.id=seen.seen_version_id
 left join lateral (select base_row.id,to_jsonb(base_row) version) base on true
 left join lateral (select jsonb_object_agg(day,p.version->>'id') filter(where read.seen_version_id is distinct from (p.version->>'id')::uuid) pending,jsonb_agg(day) changed from jsonb_object_keys(coalesce(p.version->'weekly_plan','{}'::jsonb)||coalesce(base.version->'weekly_plan','{}'::jsonb)) day left join public.professional_plan_update_day_views read on read.student_user_id=auth.uid() and read.program_id=p.program_id and read.day_key=day where coalesce(p.version->'weekly_plan'->day,'[]'::jsonb) is distinct from coalesce(base.version->'weekly_plan'->day,'[]'::jsonb) or coalesce(p.version->'workout_titles'->day,'null'::jsonb) is distinct from coalesce(base.version->'workout_titles'->day,'null'::jsonb)) changes on true),'[]'::jsonb)) into result;
 return result;
end $$;
