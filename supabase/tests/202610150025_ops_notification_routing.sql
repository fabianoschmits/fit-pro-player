begin;
do $$
declare admin_id uuid; fixture record; device_id uuid; notification_key text; actual_target text;
begin
  select r.user_id into admin_id from public.user_roles r where r.role='admin' limit 1;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  select w.id, w.student_user_id, a.professional_user_id into fixture
  from public.workout_executions w join public.program_assignments a on a.id=w.assignment_id limit 1;
  if fixture.id is null then raise exception 'QA workout required'; end if;
  insert into public.notification_devices(device_key,owner_id,endpoint,transport,subscription,enabled,preferences,timezone,lang,schedule)
  values(gen_random_uuid(),fixture.professional_user_id,'https://qa.invalid/console-routing/'||gen_random_uuid(),'webpush','{}',false,'{}','America/Sao_Paulo','pt','{}') returning id into device_id;
  notification_key := 'student_workout_completed:'||fixture.id;
  insert into public.notification_events(device_id,owner_id,event_key,kind,href)
  values(device_id,fixture.professional_user_id,notification_key,'student_workout_completed','/#/professional/students/'||fixture.student_user_id);
  select f.target_path into actual_target from public.ops_notification_feed() f
  where f.id='event:'||fixture.professional_user_id||':'||notification_key;
  if actual_target is distinct from '/console/users/'||fixture.student_user_id||'?section=training' then
    raise exception 'FAIL: workout notification opens %, expected student %', actual_target, fixture.student_user_id;
  end if;
  if has_function_privilege('authenticated','public.ops_notification_feed()','execute') then raise exception 'FAIL: private feed exposed'; end if;
end;
$$;
select 'workout notifications open the student training section' as result;
rollback;
