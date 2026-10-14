-- LGPD control records. All rows are caller-scoped; legal identity remains application configuration.
create table if not exists public.privacy_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('privacy', 'terms')), 
  version text not null,
  published_at timestamptz not null default now(),
  content_hash text not null,
  active boolean not null default true,
  unique (document_type, version)
);

create table if not exists public.privacy_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.privacy_documents(id),
  purpose text not null check (purpose in ('terms', 'privacy', 'communications', 'notifications')),
  granted boolean not null,
  details text not null default '',
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, document_id, purpose)
);

alter table public.privacy_consents add column if not exists details text not null default '';
alter table public.privacy_consents drop constraint if exists privacy_consents_purpose_check;
alter table public.privacy_consents add constraint privacy_consents_purpose_check check (purpose in ('terms', 'privacy', 'communications', 'notifications', 'cookie_preferences'));

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique default ('LGPD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('access', 'correction', 'portability', 'deletion', 'consent_revocation', 'sharing_information')),
  details text not null default '',
  status text not null default 'received' check (status in ('received', 'in_review', 'completed', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.privacy_documents(document_type, version, content_hash)
values ('privacy', '2026-10-13', 'fitproplayer-privacy-2026-10-13'), ('terms', '2026-10-13', 'fitproplayer-terms-2026-10-13')
on conflict (document_type, version) do update set content_hash = excluded.content_hash, active = true;

alter table public.privacy_documents enable row level security;
alter table public.privacy_consents enable row level security;
alter table public.privacy_requests enable row level security;

drop policy if exists privacy_documents_read_active on public.privacy_documents;
create policy privacy_documents_read_active on public.privacy_documents for select to anon, authenticated using (active = true);
drop policy if exists privacy_consents_own on public.privacy_consents;
create policy privacy_consents_own on public.privacy_consents for select to authenticated using (user_id = auth.uid());
drop policy if exists privacy_requests_own on public.privacy_requests;
create policy privacy_requests_own on public.privacy_requests for select to authenticated using (user_id = auth.uid());

create or replace function public.create_privacy_request(p_request_type text, p_details text default '')
returns public.privacy_requests
language plpgsql security definer set search_path = public, pg_temp
as $$
declare result public.privacy_requests;
begin
  if auth.uid() is null then raise exception 'authenticated identity required' using errcode = '42501'; end if;
  if p_request_type not in ('access', 'correction', 'portability', 'deletion', 'consent_revocation', 'sharing_information') then
    raise exception 'unsupported privacy request' using errcode = '22023';
  end if;
  insert into public.privacy_requests(user_id, request_type, details) values (auth.uid(), p_request_type, left(coalesce(p_details, ''), 4000)) returning * into result;
  return result;
end;
$$;

revoke all on function public.create_privacy_request(text, text) from public, anon;
grant execute on function public.create_privacy_request(text, text) to authenticated;

create or replace function public.record_privacy_consent(p_version text, p_purpose text, p_granted boolean, p_details text default '')
returns public.privacy_consents
language plpgsql security definer set search_path = public, pg_temp
as $$
declare result public.privacy_consents; doc uuid;
begin
  if auth.uid() is null then raise exception 'authenticated identity required' using errcode = '42501'; end if;
  if p_purpose not in ('terms', 'privacy', 'communications', 'notifications', 'cookie_preferences') then raise exception 'unsupported consent purpose' using errcode = '22023'; end if;
  select id into doc from public.privacy_documents where version = p_version and document_type = case when p_purpose = 'terms' then 'terms' else 'privacy' end and active = true limit 1;
  if doc is null then raise exception 'privacy document version not found' using errcode = '22023'; end if;
  insert into public.privacy_consents(user_id, document_id, purpose, granted, revoked_at, details)
  values (auth.uid(), doc, p_purpose, p_granted, case when p_granted then null else now() end, left(coalesce(p_details, ''), 4000))
  on conflict (user_id, document_id, purpose) do update set granted = excluded.granted, granted_at = now(), revoked_at = excluded.revoked_at, details = excluded.details
  returning * into result;
  return result;
end;
$$;

revoke all on function public.record_privacy_consent(text, text, boolean, text) from public, anon;
grant execute on function public.record_privacy_consent(text, text, boolean, text) to authenticated;
