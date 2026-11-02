-- Runs after a clean reset as well as in the focused PostgreSQL/WASM harness.
begin;
create or replace function pg_temp.assert_true(value boolean,message text) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'assertion failed: %',message; end if; end$$;
insert into auth.users(id) values ('11020500-0000-4000-8000-000000000001'),('11020500-0000-4000-8000-000000000002'),('11020500-0000-4000-8000-000000000003');
insert into public.user_roles(user_id,role) values ('11020500-0000-4000-8000-000000000001','professional');
insert into public.professional_student_relationships(professional_user_id,student_user_id,status) values ('11020500-0000-4000-8000-000000000001','11020500-0000-4000-8000-000000000002','active');
insert into public.athlete_plan_library(id,user_id,source_type,title,personal_plan) values ('11020500-0000-4000-8000-000000000099','11020500-0000-4000-8000-000000000003','self','Foreign','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','11020500-0000-4000-8000-000000000001',true);
select public.save_student_plan_draft('11020500-0000-4000-8000-000000000002','Switch test','{"routines":[{"id":"a","name":"A","ex":[{"id":"0043","sets":3,"reps":10,"weight":20}]}],"week":{"1":"a"}}',0);
select public.send_student_plan('11020500-0000-4000-8000-000000000002',1);
select set_config('request.jwt.claim.sub','11020500-0000-4000-8000-000000000002',true);
select public.save_athlete_plan(0,'daily','{"week":{"2":"11020500-0000-4000-8000-000000000010","3":"11020500-0000-4000-8000-000000000011"},"dayPlan":{"2026-11-02":null,"2026-11-03":"rest","2026-11-04":"11020500-0000-4000-8000-000000000010","2026-11-05":"11020500-0000-4000-8000-000000000011"}}','[{"id":"11020500-0000-4000-8000-000000000010","title":"Edit me","prescription":{"ex":[]}},{"id":"11020500-0000-4000-8000-000000000011","title":"Delete me","prescription":{"ex":[]}}]');
do $$
declare personal uuid; professional uuid; previous bigint; current_rev bigint; live jsonb; sched jsonb; before_state jsonb; newest uuid; item jsonb; i integer;
begin
 select (x->>'id')::uuid into professional from jsonb_array_elements(public.athlete_plan_library_page()->'items') x where x->>'source_type'='professional';
 select revision into previous from public.athlete_schedules where user_id=auth.uid();
 perform public.apply_library_plan(professional,previous);
 personal:=public.save_personal_library_plan('Personal');
 -- Mutate all three personal CRUD cases through the actual save RPC while professional is selected.
 select jsonb_agg(jsonb_build_object('id',id,'title',case when id='11020500-0000-4000-8000-000000000010' then 'Edited live' else title end,'prescription',prescription)) into live from public.athlete_routines where user_id=auth.uid() and id<>'11020500-0000-4000-8000-000000000011';
 live:=live||'[{"id":"11020500-0000-4000-8000-000000000012","title":"Created live","prescription":{"ex":[]}}]'::jsonb;
 select schedule,revision into sched,previous from public.athlete_schedules where user_id=auth.uid();
 perform public.save_athlete_plan(previous,'weekly',sched,live);
 for i in 1..10 loop
  select revision into previous from public.athlete_schedules where user_id=auth.uid();
  perform public.apply_library_plan(case when i%2=1 then personal else professional end,previous);
  select revision into current_rev from public.athlete_schedules where user_id=auth.uid();
  perform pg_temp.assert_true(current_rev>previous,'each actual backend alternation increases revision');
  perform pg_temp.assert_true((select count(*)=1 from public.athlete_routines where user_id=auth.uid() and title='Edited live'),'live edit survives');
  perform pg_temp.assert_true((select count(*)=1 from public.athlete_routines where user_id=auth.uid() and title='Created live'),'live creation survives');
  perform pg_temp.assert_true(not exists(select 1 from public.athlete_routines where user_id=auth.uid() and id='11020500-0000-4000-8000-000000000011'),'deleted routine never resurrects from snapshot');
  if i%2=1 then
   select schedule into sched from public.athlete_schedules where user_id=auth.uid();
   perform pg_temp.assert_true((select mode='daily' from public.athlete_schedules where user_id=auth.uid()),'personal daily mode restored');
   perform pg_temp.assert_true(sched->'week'='{"2":"11020500-0000-4000-8000-000000000010"}'::jsonb,'weekly references filtered to live routines');
   perform pg_temp.assert_true(sched->'dayPlan'='{"2026-11-02":null,"2026-11-03":"rest","2026-11-04":"11020500-0000-4000-8000-000000000010"}'::jsonb,'daily null/rest and valid reference preserved');
   perform pg_temp.assert_true(not sched ? 'assignedProgram','personal schedule removes assignedProgram');
   perform pg_temp.assert_true((select l.source_type='self' from public.athlete_plan_selection s join public.athlete_plan_library l on l.id=s.plan_id where s.user_id=auth.uid()),'selected source is self');
  end if;
 end loop;
 -- Capture the whole execution state so errors must be atomic.
 select jsonb_build_object('schedule',to_jsonb(s),'routines',(select jsonb_agg(to_jsonb(r) order by id) from public.athlete_routines r where r.user_id=auth.uid()),'selection',(select to_jsonb(p) from public.athlete_plan_selection p where p.user_id=auth.uid())) into before_state from public.athlete_schedules s where s.user_id=auth.uid();
 begin perform public.apply_library_plan(personal,current_rev-1); raise exception 'stale revision accepted'; exception when serialization_failure then null; end;
 begin perform public.apply_library_plan('11020500-0000-4000-8000-000000000099',current_rev); raise exception 'foreign plan accepted'; exception when insufficient_privilege then null; end;
 begin perform public.apply_library_plan(personal,null::bigint); raise exception 'explicit null revision accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.apply_library_plan(personal,-1); raise exception 'negative revision accepted'; exception when invalid_parameter_value then null; end;
 perform pg_temp.assert_true(before_state=(select jsonb_build_object('schedule',to_jsonb(s),'routines',(select jsonb_agg(to_jsonb(r) order by id) from public.athlete_routines r where r.user_id=auth.uid()),'selection',(select to_jsonb(p) from public.athlete_plan_selection p where p.user_id=auth.uid())) from public.athlete_schedules s where s.user_id=auth.uid()),'rejected applications preserve all execution state');
end$$;
-- Deliver version two while version one remains active. Reading/acknowledging is not application.
select set_config('request.jwt.claim.sub','11020500-0000-4000-8000-000000000001',true);
select public.save_student_plan_draft('11020500-0000-4000-8000-000000000002','Switch test','{"routines":[{"id":"a","name":"B","ex":[{"id":"0043","sets":4,"reps":8,"weight":22}]}],"week":{"1":"a"}}',1);
select public.send_student_plan('11020500-0000-4000-8000-000000000002',2);
select set_config('request.jwt.claim.sub','11020500-0000-4000-8000-000000000002',true);
do $$ declare page jsonb; selected uuid; latest uuid; version uuid; before_state jsonb; begin
 select to_jsonb(s) into before_state from public.athlete_schedules s where user_id=auth.uid();
 page:=public.athlete_plan_library_page(); selected:=(page->>'selectedId')::uuid;
 perform pg_temp.assert_true(exists(select 1 from jsonb_array_elements(page->'items') x where x->>'id'=selected::text and x->'version'->>'version_number'='1'),'older active delivery remains identifiable');
 select (x->>'id')::uuid,(x->'version'->>'id')::uuid into latest,version from jsonb_array_elements(page->'items') x where x->'version'->>'version_number'='2';
 perform public.mark_professional_plan_update_seen(latest,version);
 perform pg_temp.assert_true(before_state=(select to_jsonb(s) from public.athlete_schedules s where user_id=auth.uid()),'delivery preview and seen do not auto apply');
end$$;
reset role;
update public.professional_student_relationships set status='revoked' where student_user_id='11020500-0000-4000-8000-000000000002';
set local role authenticated;
do $$ declare target uuid; rev bigint; begin
 select l.id into target from public.athlete_plan_library l where user_id=auth.uid() and source_type='professional' limit 1;
 select revision into rev from public.athlete_schedules where user_id=auth.uid();
 begin perform public.apply_library_plan(target,rev); raise exception 'inactive relationship accepted'; exception when insufficient_privilege then null; end;
end$$;
reset role;
update public.professional_student_relationships set status='active' where student_user_id='11020500-0000-4000-8000-000000000002';
update public.program_assignments set status='revoked' where student_user_id='11020500-0000-4000-8000-000000000002';
set local role authenticated;
do $$ declare target uuid; rev bigint; begin
 select id into target from public.athlete_plan_library where user_id=auth.uid() and source_type='professional' limit 1;
 select revision into rev from public.athlete_schedules where user_id=auth.uid();
 begin perform public.apply_library_plan(target,rev); raise exception 'inactive assignment accepted'; exception when insufficient_privilege then null; end;
end$$;
-- An empty current personal workspace must never fall back to saved routine copies.
do $$ declare personal uuid; rev bigint; sched jsonb; begin
 select id into personal from public.athlete_plan_library where user_id=auth.uid() and source_type='self' limit 1;
 select revision into rev from public.athlete_schedules where user_id=auth.uid();
 perform public.apply_library_plan(personal,rev);
 select schedule,revision into sched,rev from public.athlete_schedules where user_id=auth.uid();
 perform public.save_athlete_plan(rev,'weekly',sched,'[]');
 select revision into rev from public.athlete_schedules where user_id=auth.uid();
 perform public.apply_library_plan(personal,rev);
 perform pg_temp.assert_true((select mode='weekly' from public.athlete_schedules where user_id=auth.uid()),'personal weekly mode restored');
 perform pg_temp.assert_true(not exists(select 1 from public.athlete_routines where user_id=auth.uid()),'empty live routines do not use snapshot fallback');
 perform pg_temp.assert_true((select schedule->'week'='{}'::jsonb and schedule->'dayPlan'='{"2026-11-02":null,"2026-11-03":"rest"}'::jsonb from public.athlete_schedules where user_id=auth.uid()),'empty personal calendar keeps only rest overrides');
 select revision into rev from public.athlete_schedules where user_id=auth.uid();
 perform public.apply_library_plan(personal);
 perform pg_temp.assert_true((select revision=rev+1 from public.athlete_schedules where user_id=auth.uid()),'legacy one-argument wrapper resolves revision and still applies');
end$$;
rollback;
