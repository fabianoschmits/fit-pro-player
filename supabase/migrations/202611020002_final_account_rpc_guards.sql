begin;
-- Guard authenticated entry points while preserving signatures, defaults,
-- volatility, security mode and ACLs, including already guarded remote variants.
do $guard$
declare item record; definition text; body text; guarded text;
begin
 for item in select p.* from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('abandon_workout_execution','complete_workout_execution','notification_config','preview_professional_invite','support_list_categories','support_list_faq') loop
  if item.prosrc ~ 'public\.assert_account_active[[:space:]]*\(' then continue; end if;
  definition:=pg_get_functiondef(item.oid);
  if (select lanname from pg_language where oid=item.prolang)='plpgsql' then
   guarded:=regexp_replace(item.prosrc,'\mBEGIN\M','BEGIN PERFORM public.assert_account_active();','i');
   if guarded=item.prosrc then raise exception 'missing guard insertion point: %',item.proname; end if;
   execute replace(definition,item.prosrc,guarded);
   continue;
  end if;
  if (select lanname from pg_language where oid=item.prolang)<>'sql' then raise exception 'unexpected guard target language: %',item.proname; end if;
  body:=regexp_replace(btrim(item.prosrc),';[[:space:]]*$','');
  -- SQL output names refer to table columns, not PL/pgSQL OUT variables.
  guarded:=E'#variable_conflict use_column\nBEGIN PERFORM public.assert_account_active(); ';
  if item.proretset then guarded:=guarded||'RETURN QUERY '||body||'; END';
  else guarded:=guarded||'RETURN ('||body||'); END'; end if;
  execute replace(replace(definition,item.prosrc,guarded),'LANGUAGE sql','LANGUAGE plpgsql');
 end loop;
end $guard$;
notify pgrst,'reload schema';
commit;
