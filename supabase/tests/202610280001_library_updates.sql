begin;
create function pg_temp.assert_true(value boolean,message text) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'assertion failed: %',message; end if; end $$;
insert into auth.users(id) values('28120000-0000-4000-8000-000000000001'),('28120000-0000-4000-8000-000000000002'),('28120000-0000-4000-8000-000000000003');
insert into public.user_roles(user_id,role) values('28120000-0000-4000-8000-000000000001','professional') on conflict do nothing;
insert into public.professional_student_relationships(professional_user_id,student_user_id,status) values('28120000-0000-4000-8000-000000000001','28120000-0000-4000-8000-000000000002','active');
set local role authenticated;
select set_config('request.jwt.claim.sub','28120000-0000-4000-8000-000000000001',true);
select public.save_student_plan_draft('28120000-0000-4000-8000-000000000002','Plano','{"routines":[{"id":"a","name":"A","ex":[{"id":"0043","sets":3,"reps":10,"weight":20}]},{"id":"b","name":"B","ex":[{"id":"0043","sets":4,"reps":10,"weight":30}]}],"week":{"1":"a","3":"b"}}',0);
select public.send_student_plan('28120000-0000-4000-8000-000000000002',1);
select set_config('request.jwt.claim.sub','28120000-0000-4000-8000-000000000002',true);
select pg_temp.assert_true(public.athlete_plan_library_page()->'items'->0->'workout_updates'='{}','first delivery has no update badge');
select public.apply_library_plan((public.athlete_plan_library_page()->'items'->0->>'id')::uuid);
-- Personal routines can be saved alongside an unchanged professional prescription.
select public.save_athlete_plan(s.revision,s.mode,s.schedule,
 (select jsonb_agg(jsonb_build_object('id',id,'title',title,'prescription',prescription)) from public.athlete_routines)
 || '[{"id":"28120000-0000-4000-8000-000000000010","title":"Meu treino","prescription":{"ex":[]}}]'::jsonb)
from public.athlete_schedules s;
select pg_temp.assert_true((select count(*)=3 from public.athlete_routines),'personal routine persisted beside professional routines');
do $$begin
 begin
 perform public.save_athlete_plan(s.revision,s.mode,s.schedule,
 (select jsonb_agg(jsonb_build_object('id',id,'title','Forged','prescription',prescription)) from public.athlete_routines)) from public.athlete_schedules s;
 raise exception 'professional edit was accepted';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','28120000-0000-4000-8000-000000000001',true);
select public.save_student_plan_draft('28120000-0000-4000-8000-000000000002','Plano','{"routines":[{"id":"a","name":"A atualizado","ex":[{"id":"0043","sets":3,"reps":10,"weight":25}]},{"id":"b","name":"B","ex":[{"id":"0043","sets":4,"reps":10,"weight":30}]}],"week":{"1":"a","3":"b"}}',1);
select public.send_student_plan('28120000-0000-4000-8000-000000000002',2);
select set_config('request.jwt.claim.sub','28120000-0000-4000-8000-000000000002',true);
select pg_temp.assert_true((select count(*)=2 from jsonb_array_elements(public.athlete_plan_library_page()->'items')),'one professional plan plus personal snapshot, no duplicate versions');
select pg_temp.assert_true((select count(*)=1 from jsonb_array_elements(public.athlete_plan_library_page()->'items') i where i->>'source_type'='professional'),'one delivery per program');
select pg_temp.assert_true((select i->'workout_updates' ? 'monday' and not (i->'workout_updates' ? 'wednesday') from jsonb_array_elements(public.athlete_plan_library_page()->'items') i where i->>'source_type'='professional'),'only changed workout is marked');
select public.mark_library_workout_seen((i->>'id')::uuid,'monday',(i->'workout_updates'->>'monday')::uuid) from jsonb_array_elements(public.athlete_plan_library_page()->'items') i where i->>'source_type'='professional';
select pg_temp.assert_true((select i->'workout_updates'='{}' from jsonb_array_elements(public.athlete_plan_library_page()->'items') i where i->>'source_type'='professional'),'opening clears the update persistently');
select public.apply_library_plan((i->>'id')::uuid) from jsonb_array_elements(public.athlete_plan_library_page()->'items') i where i->>'source_type'='professional';
select pg_temp.assert_true((select count(*)=3 from public.athlete_routines),'applying update replaces professional workouts and keeps personal workout');
select pg_temp.assert_true((select title='Meu treino' from public.athlete_routines where id='28120000-0000-4000-8000-000000000010'),'personal workout survives applying update');
select pg_temp.assert_true(jsonb_array_length(public.athlete_plan_library_page(0,1)->'items')=1 and (public.athlete_plan_library_page(0,1)->>'total')::int=2,'pagination counts latest plans only');
select set_config('request.jwt.claim.sub','28120000-0000-4000-8000-000000000001',true);
select public.save_student_plan_draft(student_id,title,workspace,revision) from public.professional_plan_drafts;
select public.send_student_plan('28120000-0000-4000-8000-000000000002',3);
select set_config('request.jwt.claim.sub','28120000-0000-4000-8000-000000000002',true);
select pg_temp.assert_true((select i->'workout_updates'='{}' from jsonb_array_elements(public.athlete_plan_library_page()->'items') i where i->>'source_type'='professional'),'unchanged resend does not restore read badges');
select set_config('request.jwt.claim.sub','28120000-0000-4000-8000-000000000001',true);
select public.save_student_plan_draft(student_id,title,jsonb_set(workspace,'{routines,1,ex,0,weight}','40'),revision) from public.professional_plan_drafts;
select public.send_student_plan('28120000-0000-4000-8000-000000000002',4);
select set_config('request.jwt.claim.sub','28120000-0000-4000-8000-000000000002',true);
select pg_temp.assert_true((select i->'workout_updates' ? 'wednesday' and not(i->'workout_updates' ? 'monday') from jsonb_array_elements(public.athlete_plan_library_page()->'items') i where i->>'source_type'='professional'),'later update marks only its changed workout');
select set_config('test.other_plan',(select i->>'id' from jsonb_array_elements(public.athlete_plan_library_page()->'items') i where i->>'source_type'='professional'),true);
select set_config('request.jwt.claim.sub','28120000-0000-4000-8000-000000000003',true);
select pg_temp.assert_true((public.athlete_plan_library_page()->>'total')::int=0,'other account sees no deliveries');
do $$begin
 begin
 perform public.mark_library_workout_seen(current_setting('test.other_plan')::uuid,'wednesday','28120000-0000-4000-8000-000000000003');
 raise exception 'other account could acknowledge the update';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
