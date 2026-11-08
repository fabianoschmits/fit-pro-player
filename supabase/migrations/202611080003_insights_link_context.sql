begin;
-- Correlate only the current relationship cycle, without exposing profile or prescription data.
create or replace function public.insights_link_context(p_kind text,p_id uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare caller uuid:=auth.uid(); cycle uuid; journey uuid;
begin
 perform public.assert_account_active();
 if not public.insights_has_consent(caller) then return null; end if;
 if p_kind='request' then
  select id into journey from public.professional_link_requests where id=p_id and caller in (student_user_id,professional_user_id);
  return journey;
 elsif p_kind='relationship' then
  select id into cycle from public.professional_student_relationships where id=p_id and caller in (student_user_id,professional_user_id);
 elsif p_kind='plan' then
  select a.relationship_id into cycle from public.athlete_plan_library l join public.program_assignments a on a.id=l.assignment_id where l.id=p_id and l.user_id=caller;
 elsif p_kind='session' then
  select a.relationship_id into cycle from public.workout_sessions w join public.program_assignments a on a.id=w.assignment_id where w.id=p_id and w.user_id=caller;
 end if;
 if cycle is null then return null; end if;
 select id into journey from public.professional_link_requests where relationship_id=cycle order by created_at limit 1;
 return coalesce(journey,cycle);
end $$;
revoke all on function public.insights_link_context(text,uuid) from public,anon,authenticated;
grant execute on function public.insights_link_context(text,uuid) to authenticated;
commit;
