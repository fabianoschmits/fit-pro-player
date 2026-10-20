-- Standard SQL strings preserve backslashes. The previous \\d pattern matched a
-- literal backslash instead of ISO dates, rejecting every body save.
create or replace function public.save_athlete_body(
  p_weights jsonb,
  p_measurements jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare caller uuid := auth.uid();
begin
  if caller is null then raise exception 'authenticated identity required' using errcode = '42501'; end if;
  if p_weights is null or jsonb_typeof(p_weights) <> 'array' or jsonb_array_length(p_weights) > 2000
    or p_measurements is null or jsonb_typeof(p_measurements) <> 'array' or jsonb_array_length(p_measurements) > 1000
    or exists (select 1 from jsonb_array_elements(p_weights) item where jsonb_typeof(item) <> 'object' or coalesce(item->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or coalesce(item->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or coalesce((item->>'weightKg')::numeric,0) <= 0)
    or exists (select 1 from jsonb_array_elements(p_measurements) item where jsonb_typeof(item) <> 'object' or coalesce(item->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or coalesce(item->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or jsonb_typeof(coalesce(item->'valuesCm','null'::jsonb)) <> 'object')
  then raise exception 'invalid athlete body' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('fitpp.body:' || caller::text, 0));
  delete from public.bodyweight_entries where user_id = caller;
  insert into public.bodyweight_entries(id,user_id,measured_on,weight_kg)
    select (item->>'id')::uuid, caller, (item->>'date')::date, (item->>'weightKg')::numeric from jsonb_array_elements(p_weights) item;
  delete from public.body_measurement_checkins where user_id = caller;
  insert into public.body_measurement_checkins(id,user_id,measured_on,measurements_cm,note)
    select (item->>'id')::uuid, caller, (item->>'date')::date, item->'valuesCm', nullif(item->>'note','') from jsonb_array_elements(p_measurements) item;
  return jsonb_build_object('weights', coalesce((select jsonb_agg(to_jsonb(w) order by w.measured_on) from public.bodyweight_entries w where w.user_id = caller), '[]'::jsonb), 'measurements', coalesce((select jsonb_agg(to_jsonb(m) order by m.measured_on) from public.body_measurement_checkins m where m.user_id = caller), '[]'::jsonb));
end;
$$;

revoke all on function public.save_athlete_body(jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.save_athlete_body(jsonb,jsonb) to authenticated;
