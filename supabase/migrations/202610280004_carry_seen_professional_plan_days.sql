-- Carry a per-day acknowledgement forward only when that day's prescription and
-- title are byte-for-byte unchanged in the newly published version.
create function public.carry_seen_professional_plan_days() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare current public.program_versions;
begin
 select * into current from public.program_versions where id=new.version_id;
 update public.professional_plan_update_day_views view set seen_version_id=new.version_id,seen_at=now()
 from public.program_versions seen
 where view.student_user_id=new.student_user_id and view.program_id=new.program_id and seen.id=view.seen_version_id
  and coalesce(current.weekly_plan->view.day_key,'[]'::jsonb) is not distinct from coalesce(seen.weekly_plan->view.day_key,'[]'::jsonb)
  and coalesce(current.workout_titles->view.day_key,'null'::jsonb) is not distinct from coalesce(seen.workout_titles->view.day_key,'null'::jsonb);
 return new;
end $$;
create trigger professional_plan_day_view_carry after insert on public.program_assignments for each row execute function public.carry_seen_professional_plan_days();
