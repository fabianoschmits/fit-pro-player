begin;
insert into auth.users(id) values('61103000-0000-4000-8000-000000000001'),('61103000-0000-4000-8000-000000000002');
insert into public.user_roles(user_id,role) values('61103000-0000-4000-8000-000000000001','admin'),('61103000-0000-4000-8000-000000000001','professional');
insert into public.professional_student_relationships(professional_user_id,student_user_id,status) values('61103000-0000-4000-8000-000000000001','61103000-0000-4000-8000-000000000002','active');
insert into public.programs(id,professional_user_id,title) values('61103010-0000-4000-8000-000000000001','61103000-0000-4000-8000-000000000001','Fixture');
insert into public.program_versions(id,program_id,version_number,weekly_plan,published_at) values('61103020-0000-4000-8000-000000000001','61103010-0000-4000-8000-000000000001',1,'{"monday":[{"exerciseId":"0043","sets":1,"reps":1}]}',now());
insert into public.program_assignments(id,program_id,version_id,professional_user_id,student_user_id) values('61103030-0000-4000-8000-000000000001','61103010-0000-4000-8000-000000000001','61103020-0000-4000-8000-000000000001','61103000-0000-4000-8000-000000000001','61103000-0000-4000-8000-000000000002');
insert into public.workout_executions(assignment_id,version_id,student_user_id,day_key) values('61103030-0000-4000-8000-000000000001','61103020-0000-4000-8000-000000000001','61103000-0000-4000-8000-000000000002','monday');

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
