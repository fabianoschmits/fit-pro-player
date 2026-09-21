create type public.user_role as enum ('student', 'professional', 'admin');
create type public.identity_link_status as enum ('active', 'revoked');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length_check check (char_length(display_name) <= 120)
);

create table public.user_roles (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.user_role not null,
  created_at timestamptz not null default now(),
  constraint user_roles_user_id_role_key unique (user_id, role),
  constraint user_roles_role_check check (role in ('student', 'professional', 'admin'))
);

create table public.legacy_identity_links (
  id bigint generated always as identity primary key,
  legacy_user_id text not null,
  supabase_user_id uuid not null references auth.users (id) on delete cascade,
  status public.identity_link_status not null default 'active',
  linked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legacy_identity_links_legacy_user_id_key unique (legacy_user_id),
  constraint legacy_identity_links_supabase_user_id_key unique (supabase_user_id),
  constraint legacy_identity_links_status_check check (status in ('active', 'revoked'))
);

create index user_roles_user_id_idx on public.user_roles (user_id);
create index legacy_identity_links_status_idx on public.legacy_identity_links (status);

create or replace function public.set_identity_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_identity_updated_at();

create trigger legacy_identity_links_set_updated_at
before update on public.legacy_identity_links
for each row execute function public.set_identity_updated_at();

create or replace function public.protect_profile_server_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id is distinct from old.id
    or new.created_at is distinct from old.created_at
    or new.updated_at is distinct from old.updated_at then
    raise exception 'profile server-managed fields cannot be changed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_profile_server_fields() from public;

create trigger profiles_protect_server_fields
before update on public.profiles
for each row execute function public.protect_profile_server_fields();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.legacy_identity_links enable row level security;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy profiles_insert_client_denied
on public.profiles
for insert
to authenticated
with check (false);

create policy profiles_delete_client_denied
on public.profiles
for delete
to authenticated
using (false);

create policy user_roles_select_own
on public.user_roles
for select
to authenticated
using (user_id = auth.uid());

create policy user_roles_insert_client_denied
on public.user_roles
for insert
to authenticated
with check (false);

create policy user_roles_update_client_denied
on public.user_roles
for update
to authenticated
using (false)
with check (false);

create policy user_roles_delete_client_denied
on public.user_roles
for delete
to authenticated
using (false);

create policy legacy_identity_links_select_own
on public.legacy_identity_links
for select
to authenticated
using (supabase_user_id = auth.uid());

create policy legacy_identity_links_insert_client_denied
on public.legacy_identity_links
for insert
to authenticated
with check (false);

create policy legacy_identity_links_update_client_denied
on public.legacy_identity_links
for update
to authenticated
using (false)
with check (false);

create policy legacy_identity_links_delete_client_denied
on public.legacy_identity_links
for delete
to authenticated
using (false);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  bounded_display_name varchar(120);
begin
  bounded_display_name := left(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), 120);

  insert into public.profiles (id, display_name)
  values (new.id, coalesce(bounded_display_name, ''));

  insert into public.user_roles (user_id, role)
  values (new.id, 'student'::public.user_role);

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
