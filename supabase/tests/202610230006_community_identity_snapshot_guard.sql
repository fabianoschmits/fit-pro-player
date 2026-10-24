begin;

do $$
declare actor uuid; snapshot_row public.account_snapshots; result record; value text; saved_payload jsonb;
begin
  actor := gen_random_uuid();
  insert into auth.users(id) values(actor);
  insert into public.account_preferences(user_id,preferences) values(actor,'{"profile":{"name":"Test fixture","avatarId":"avatar-01"}}');
  update public.account_preferences
  set preferences=jsonb_set(jsonb_set(preferences,'{profile,name}','"Current Community QA"'),'{profile,avatarId}','"avatar-80"')
  where user_id=actor;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  select * into snapshot_row from public.account_snapshots where user_id=actor;
  saved_payload := coalesce(snapshot_row.payload, '{}'::jsonb)
    || jsonb_build_object('profile', jsonb_build_object('name','Stale Snapshot QA','avatarId','avatar-01'));
  select * into result from public.save_own_account_snapshot(coalesce(snapshot_row.revision,0),coalesce(snapshot_row.state_schema_version,2),saved_payload);
  if result.status <> 'APPLIED' then raise exception 'Snapshot save failed'; end if;
  select display_name into value from public.profiles where id=actor;
  if value <> 'Current Community QA' then raise exception 'Legacy snapshot overwrote current public name'; end if;
  select avatar_ref into value from public.profiles where id=actor;
  if value <> 'avatar-80' then raise exception 'Legacy snapshot overwrote current public avatar'; end if;

  -- Legacy accounts without a populated domain profile must retain their save flow.
  update public.account_preferences set preferences=preferences-'profile' where user_id=actor;
  select * into snapshot_row from public.account_snapshots where user_id=actor;
  select * into result from public.save_own_account_snapshot(snapshot_row.revision,snapshot_row.state_schema_version,saved_payload);
  if result.status <> 'APPLIED' then raise exception 'Legacy-only snapshot save failed'; end if;
  select display_name into value from public.profiles where id=actor;
  if value <> 'Stale Snapshot QA' then raise exception 'Legacy-only public name did not synchronize'; end if;
  select avatar_ref into value from public.profiles where id=actor;
  if value <> 'avatar-01' then raise exception 'Legacy-only public avatar did not synchronize'; end if;
end $$;
select 'Snapshot clients preserve current account identity and legacy-only identity still syncs' as result;

rollback;
