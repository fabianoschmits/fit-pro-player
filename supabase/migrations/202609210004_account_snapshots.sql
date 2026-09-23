create table public.account_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  revision bigint not null default 0,
  state_schema_version integer not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_snapshots_revision_check check (revision > 0),
  constraint account_snapshots_schema_version_check check (state_schema_version > 0),
  constraint account_snapshots_payload_object_check check (jsonb_typeof(payload) = 'object')
);

create index account_snapshots_updated_at_idx on public.account_snapshots (updated_at);

revoke all on table public.account_snapshots from public, anon, authenticated;
grant select on table public.account_snapshots to authenticated;
grant select, insert, update, delete on table public.account_snapshots to service_role;

alter table public.account_snapshots enable row level security;

create policy account_snapshots_select_own
on public.account_snapshots
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.save_own_account_snapshot(
  p_expected_revision bigint,
  p_state_schema_version integer,
  p_payload jsonb
)
returns table (
  status text,
  revision bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_row public.account_snapshots;
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'authenticated identity required' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'invalid expected revision' using errcode = '22023';
  end if;
  if p_state_schema_version is null or p_state_schema_version <= 0 then
    raise exception 'invalid state schema version' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'snapshot payload must be a JSON object' using errcode = '22023';
  end if;

  select * into current_row
  from public.account_snapshots
  where user_id = caller
  for update;

  if not found then
    if p_expected_revision <> 0 then
      return query select 'CONFLICT'::text, null::bigint, null::timestamptz;
      return;
    end if;

    insert into public.account_snapshots (
      user_id, revision, state_schema_version, payload
    ) values (
      caller, 1, p_state_schema_version, p_payload
    )
    returning account_snapshots.revision, account_snapshots.updated_at
    into current_row.revision, current_row.updated_at;

    return query select 'APPLIED'::text, current_row.revision, current_row.updated_at;
    return;
  end if;

  if current_row.revision <> p_expected_revision then
    return query select 'CONFLICT'::text, current_row.revision, current_row.updated_at;
    return;
  end if;

  update public.account_snapshots
  set revision = current_row.revision + 1,
      state_schema_version = p_state_schema_version,
      payload = p_payload,
      updated_at = now()
  where user_id = caller
  returning account_snapshots.revision, account_snapshots.updated_at
  into current_row.revision, current_row.updated_at;

  return query select 'APPLIED'::text, current_row.revision, current_row.updated_at;
end;
$$;

revoke all on function public.save_own_account_snapshot(bigint, integer, jsonb) from public, anon;
grant execute on function public.save_own_account_snapshot(bigint, integer, jsonb) to authenticated;
