-- Explicit rest overrides are part of the personal calendar, not routine references.
begin;
do $migration$
declare definition text; original text := 'where e.value=''null''::jsonb or exists';
begin
 definition:=pg_get_functiondef('public.apply_library_plan(uuid,bigint)'::regprocedure);
 if strpos(definition,original)=0 then raise exception 'personal dayPlan restoration filter missing'; end if;
 execute replace(definition,original,'where e.value in (''null''::jsonb,''"rest"''::jsonb) or exists');
end $migration$;
notify pgrst,'reload schema';
commit;
