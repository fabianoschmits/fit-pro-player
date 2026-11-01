begin;
create or replace function pg_temp.assert_true(value boolean,message text) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'assertion failed: %',message; end if; end $$;
select pg_temp.assert_true((select body='' from public.professional_student_notes where professional_id='10290100-0000-0000-0000-000000000001' and student_id='10290100-0000-0000-0000-000000000002'),'legacy mutable slot is cleared after migration');
set local role authenticated;
set local request.jwt.claim.sub='10290100-0000-0000-0000-000000000001';
select pg_temp.assert_true(public.list_professional_student_notes('10290100-0000-0000-0000-000000000002')->0->>'body'='Nota antiga','legacy private note remains visible after migration');
select pg_temp.assert_true((public.list_professional_student_notes('10290100-0000-0000-0000-000000000002')->0->>'created_at')::timestamptz='2026-10-20 12:30:00+00'::timestamptz,'legacy timestamp remains unchanged');
rollback;
