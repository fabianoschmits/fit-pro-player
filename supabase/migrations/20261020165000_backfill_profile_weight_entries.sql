-- Recover first weigh-ins written to preferences before body-domain saves worked.
-- Existing weigh-ins always win; rerunning this migration inserts nothing twice.
insert into public.bodyweight_entries (user_id, measured_on, weight_kg)
select p.user_id,
  case
    when coalesce(p.preferences->'profile'->>'completedAt', '') ~ '^[0-9]{13}$'
      then (to_timestamp((p.preferences->'profile'->>'completedAt')::numeric / 1000) at time zone 'UTC')::date
    else p.updated_at::date
  end,
  (p.preferences->'profile'->>'startWeight')::numeric
from public.account_preferences p
where coalesce(p.preferences->'profile'->>'startWeight', '') ~ '^[0-9]+([.][0-9]+)?$'
  and (p.preferences->'profile'->>'startWeight')::numeric > 0
  and (p.preferences->'profile'->>'startWeight')::numeric <= 1000
  and not exists (select 1 from public.bodyweight_entries b where b.user_id = p.user_id);
