-- New advanced metrics for the operations dashboard

create or replace function public.ops_advanced_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  perform public.ops_require_admin();

  with user_growth as (
    select date(created_at) as d, count(*) as c
    from public.profiles
    where created_at >= now() - interval '30 days'
    group by date(created_at)
    order by d asc
  ),
  workout_data as (
    select
      value->>'start' as start_ms,
      value->>'end' as end_ms,
      value->'entries' as entries
    from public.account_snapshots s,
    jsonb_array_elements(s.payload->'workouts') as value
    where s.payload ? 'workouts'
  ),
  exercise_data as (
    select entry->>'id' as ex_id
    from workout_data,
    jsonb_array_elements(entries) as entry
  ),
  top_ex as (
    select ex_id, count(*) as count
    from exercise_data
    group by ex_id
    order by count desc
    limit 15
  ),
  usage_time as (
    select sum(
      case
        when end_ms is not null and start_ms is not null and cast(end_ms as bigint) > cast(start_ms as bigint)
        then cast(end_ms as bigint) - cast(start_ms as bigint)
        else 0
      end
    ) as total_ms
    from workout_data
  )
  select jsonb_build_object(
    'user_growth', coalesce((select jsonb_agg(jsonb_build_object('d', d, 'c', c)) from user_growth), '[]'::jsonb),
    'top_exercises', coalesce((select jsonb_agg(jsonb_build_object('id', ex_id, 'count', count)) from top_ex), '[]'::jsonb),
    'total_usage_seconds', coalesce((select total_ms / 1000 from usage_time), 0)
  ) into result;

  return result;
end;
$$;

revoke all on function public.ops_advanced_metrics() from public, anon, authenticated;
grant execute on function public.ops_advanced_metrics() to authenticated;
