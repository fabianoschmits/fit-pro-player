-- Preserve the current profile/location implementation and its edited-field semantics.
-- Newly introduced overloads must retain the existing account suspension boundary.
begin;
do $$
declare signature text; definition text;
begin
 foreach signature in array array[
  'public.provision_professional_profile(text,text,text[],text,text,text,text,text,text)',
  'public.save_professional_profile(uuid,text,text,text[],text,text,text,text,text,text)',
  'public.ops_update_professional_profile(uuid,text,text,text[],text,text,text,text,text,text)'
 ] loop
  if to_regprocedure(signature) is null then raise exception 'missing profile RPC: %',signature; end if;
  definition:=pg_get_functiondef(signature::regprocedure);
  if position('public.assert_account_active()' in definition)=0 then
   definition:=regexp_replace(definition,'\mbegin\M',E'begin\n  perform public.assert_account_active();','i');
   execute definition;
  end if;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
