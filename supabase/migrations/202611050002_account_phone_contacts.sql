-- Contacts are deliberately separate from community/public profiles.
create table public.account_phone_contacts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
 updated_at timestamptz not null default now()
);
alter table public.account_phone_contacts enable row level security;
revoke all on public.account_phone_contacts from public, anon, authenticated;

create function public.account_contact_phone(p_user_id uuid)
returns text language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 perform public.assert_account_active();
 if p_user_id = auth.uid() or exists (
  select 1 from public.professional_student_relationships r
  where r.status='active' and ((r.professional_user_id=auth.uid() and r.student_user_id=p_user_id)
   or (r.student_user_id=auth.uid() and r.professional_user_id=p_user_id))
 ) then
  return (select phone_e164 from public.account_phone_contacts where user_id=p_user_id);
 end if;
 return null;
end $$;

create function public.save_account_phone(p_phone text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.assert_account_active();
 if nullif(btrim(p_phone),'') is null then
  delete from public.account_phone_contacts where user_id=auth.uid();
  return null;
 end if;
 if p_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'invalid-phone' using errcode='22023'; end if;
 insert into public.account_phone_contacts(user_id,phone_e164) values(auth.uid(),p_phone)
 on conflict(user_id) do update set phone_e164=excluded.phone_e164,updated_at=now();
 return p_phone;
end $$;
revoke all on function public.account_contact_phone(uuid),public.save_account_phone(text) from public,anon;
grant execute on function public.account_contact_phone(uuid),public.save_account_phone(text) to authenticated;

-- Signup also covers anonymous-account conversion (metadata UPDATE).
-- Invalid optional metadata must never break account creation.
create function public.capture_signup_phone() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare phone text := new.raw_user_meta_data->>'phone_e164';
begin
 if tg_op='UPDATE' and old.raw_user_meta_data->>'phone_e164' is not distinct from phone then return new; end if;
 if phone ~ '^\+[1-9][0-9]{7,14}$' then
  insert into public.account_phone_contacts(user_id,phone_e164) values(new.id,phone)
  on conflict(user_id) do nothing;
 end if;
 return new;
end $$;
revoke all on function public.capture_signup_phone() from public,anon,authenticated;
create trigger capture_signup_phone after insert or update of raw_user_meta_data on auth.users
 for each row execute function public.capture_signup_phone();
notify pgrst,'reload schema';
