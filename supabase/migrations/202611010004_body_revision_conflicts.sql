begin;
-- Existing records are untouched. Revision 1 marks an already-populated domain.
create table public.athlete_body_revisions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null default 0 check(revision>=0)
);
insert into public.athlete_body_revisions(user_id,revision)
 select user_id,1 from (select user_id from public.bodyweight_entries union select user_id from public.body_measurement_checkins) owners;
alter table public.athlete_body_revisions enable row level security;
revoke all on public.athlete_body_revisions from public,anon,authenticated;
grant select on public.athlete_body_revisions to authenticated;
grant select,insert,update,delete on public.athlete_body_revisions to service_role;
create policy body_revision_owner on public.athlete_body_revisions for select to authenticated
 using(user_id=(select auth.uid()) and (select public.account_is_active()));
create trigger enforce_active_account before insert or update or delete on public.athlete_body_revisions
 for each row execute function public.enforce_account_active();
-- Preserve the existing SELECT-only access: authenticated writes must use the CAS RPC.
revoke insert,update,delete on public.bodyweight_entries,public.body_measurement_checkins from authenticated,anon;

-- User RPCs can run concurrently across accounts. Administrative statements take
-- the exclusive writer gate BEFORE locking rows, preventing row/advisory lock inversion.
create function public.lock_athlete_body_writer() returns void
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(nullif(current_setting('role',true),''),'none') in ('none','service_role','supabase_admin') then
  perform pg_advisory_xact_lock(hashtextextended('fitpp.body.writers',0));
 else
  perform pg_advisory_xact_lock_shared(hashtextextended('fitpp.body.writers',0));
 end if;
end $$;
revoke all on function public.lock_athlete_body_writer() from public,anon,authenticated,service_role;
create function public.lock_athlete_body_statement() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform public.assert_account_active();
 perform public.lock_athlete_body_writer();
 return null;
end $$;
revoke all on function public.lock_athlete_body_statement() from public,anon,authenticated,service_role;
create trigger lock_body_writer before insert or update or delete on public.bodyweight_entries
 for each statement execute function public.lock_athlete_body_statement();
create trigger lock_body_writer before insert or update or delete on public.body_measurement_checkins
 for each statement execute function public.lock_athlete_body_statement();

-- Account deletion must acquire the exclusive gate before locking the auth FK
-- parent; waiting until a body cascade would invert that order with CAS inserts.
create function public.lock_athlete_body_account_delete() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('fitpp.body.writers',0));
 return null;
end $$;
revoke all on function public.lock_athlete_body_account_delete() from public,anon,authenticated,service_role;
create trigger lock_body_account_delete before delete on auth.users
 for each statement execute function public.lock_athlete_body_account_delete();

-- Even trusted server-side/direct writes invalidate snapshots held by devices.
create function public.advance_athlete_body_revision() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 perform public.assert_account_active();
 if tg_op='DELETE' then owner_id:=old.user_id; else owner_id:=new.user_id; end if;
 if tg_op='UPDATE' and old.user_id is distinct from new.user_id then
  raise exception 'body ownership is immutable' using errcode='42501';
 end if;
 -- Auth deletion cascades must not recreate the revision row for a deleted user.
 if exists(select 1 from auth.users where id=owner_id) then
  perform pg_advisory_xact_lock(hashtextextended('fitpp.body:'||owner_id::text,0));
  insert into public.athlete_body_revisions(user_id,revision) values(owner_id,1)
   on conflict(user_id) do update set revision=athlete_body_revisions.revision+1;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.advance_athlete_body_revision() from public,anon,authenticated;
create trigger advance_body_revision before insert or update or delete on public.bodyweight_entries
 for each row execute function public.advance_athlete_body_revision();
create trigger advance_body_revision before insert or update or delete on public.body_measurement_checkins
 for each row execute function public.advance_athlete_body_revision();

create function public.load_athlete_body() returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare caller uuid:=auth.uid(); result jsonb;
begin
 perform public.assert_account_active();
 if caller is null then raise exception 'authenticated identity required' using errcode='42501'; end if;
 -- One statement snapshot: rows and revision cannot come from different commits.
 select jsonb_build_object(
  'revision',coalesce((select revision from public.athlete_body_revisions where user_id=caller),0),
  'weights',coalesce((select jsonb_agg(to_jsonb(w) order by w.measured_on,w.id) from public.bodyweight_entries w where user_id=caller),'[]'::jsonb),
  'measurements',coalesce((select jsonb_agg(to_jsonb(m) order by m.measured_on,m.id) from public.body_measurement_checkins m where user_id=caller),'[]'::jsonb)
 ) into result;
 return result;
end $$;
revoke all on function public.load_athlete_body() from public,anon;
grant execute on function public.load_athlete_body() to authenticated,service_role;

-- Retain the existing validation/writer as an internal primitive, inaccessible to clients.
alter function public.save_athlete_body(jsonb,jsonb) rename to write_athlete_body_snapshot;
alter function public.write_athlete_body_snapshot(jsonb,jsonb) set search_path='';
revoke all on function public.write_athlete_body_snapshot(jsonb,jsonb) from public,anon,authenticated,service_role;

create function public.save_athlete_body(p_expected_revision bigint,p_weights jsonb,p_measurements jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); actual_revision bigint;
begin
 perform public.assert_account_active();
 if caller is null then raise exception 'authenticated identity required' using errcode='42501'; end if;
 if p_expected_revision is null or p_expected_revision<0 then raise exception 'invalid body revision' using errcode='22023'; end if;
 perform public.lock_athlete_body_writer();
 perform pg_advisory_xact_lock(hashtextextended('fitpp.body:'||caller::text,0));
 select coalesce((select revision from public.athlete_body_revisions where user_id=caller),0) into actual_revision;
 if actual_revision<>p_expected_revision then raise exception 'body revision conflict' using errcode='40001'; end if;
 perform public.write_athlete_body_snapshot(p_weights,p_measurements);
 -- Empty -> empty is still an acknowledged commit, including for a new account.
 insert into public.athlete_body_revisions(user_id,revision) values(caller,1)
  on conflict(user_id) do update set revision=athlete_body_revisions.revision+1;
 return public.load_athlete_body();
end $$;
revoke all on function public.save_athlete_body(bigint,jsonb,jsonb) from public,anon;
grant execute on function public.save_athlete_body(bigint,jsonb,jsonb) to authenticated,service_role;

-- Older app versions may append, but cannot erase omitted rows or overwrite an
-- existing ID without a base revision. Incompatible edits fail closed with 40001.
create function public.save_athlete_body(p_weights jsonb,p_measurements jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); weights jsonb; measurements jsonb; actual_revision bigint;
begin
 perform public.assert_account_active();
 if caller is null then raise exception 'authenticated identity required' using errcode='42501'; end if;
 if jsonb_typeof(p_weights) is distinct from 'array' or jsonb_typeof(p_measurements) is distinct from 'array' then
  raise exception 'invalid athlete body' using errcode='22023';
 end if;
 perform public.lock_athlete_body_writer();
 perform pg_advisory_xact_lock(hashtextextended('fitpp.body:'||caller::text,0));
 if exists(select 1 from jsonb_array_elements(p_weights) item join public.bodyweight_entries w on w.id=(item->>'id')::uuid
  where w.user_id=caller and (w.measured_on is distinct from (item->>'date')::date or w.weight_kg is distinct from (item->>'weightKg')::numeric))
 or exists(select 1 from jsonb_array_elements(p_measurements) item join public.body_measurement_checkins m on m.id=(item->>'id')::uuid
  where m.user_id=caller and (m.measured_on is distinct from (item->>'date')::date or m.measurements_cm is distinct from item->'valuesCm' or coalesce(m.note,'') is distinct from coalesce(item->>'note',''))) then
  raise exception 'body revision required for existing record changes' using errcode='40001';
 end if;
 select coalesce(jsonb_agg(item),'[]'::jsonb) into weights from (
  select jsonb_build_object('id',id,'date',measured_on,'weightKg',weight_kg) item from public.bodyweight_entries where user_id=caller
  union all select item from jsonb_array_elements(p_weights) item where not exists(select 1 from public.bodyweight_entries w where w.id=(item->>'id')::uuid and w.user_id=caller)
 ) merged;
 select coalesce(jsonb_agg(item),'[]'::jsonb) into measurements from (
  select jsonb_build_object('id',id,'date',measured_on,'valuesCm',measurements_cm,'note',note) item from public.body_measurement_checkins where user_id=caller
  union all select item from jsonb_array_elements(p_measurements) item where not exists(select 1 from public.body_measurement_checkins m where m.id=(item->>'id')::uuid and m.user_id=caller)
 ) merged;
 select coalesce((select revision from public.athlete_body_revisions where user_id=caller),0) into actual_revision;
 return public.save_athlete_body(actual_revision,weights,measurements);
end $$;
revoke all on function public.save_athlete_body(jsonb,jsonb) from public,anon;
grant execute on function public.save_athlete_body(jsonb,jsonb) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
