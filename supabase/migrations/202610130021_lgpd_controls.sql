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
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, document_id, purpose)
);

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
