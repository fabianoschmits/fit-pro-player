begin;

create table public.body_progress_photos (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 photo_date date not null check(photo_date between date '1900-01-01' and date '2200-01-01'),
 angle text not null check(angle in ('front','back','left','right')),
 storage_path text not null unique,
 width integer not null check(width between 1 and 1920),
 height integer not null check(height between 1 and 1920),
 file_size integer not null check(file_size between 1 and 6291456),
 mime_type text not null check(mime_type in ('image/webp','image/jpeg')),
 auto_transform jsonb,
 manual_transform jsonb,
 deleting boolean not null default false,
 upload_pending boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint body_photo_path check(storage_path = user_id::text||'/'||id::text||'/original.'||case mime_type when 'image/webp' then 'webp' else 'jpg' end)
);
create index body_progress_photos_history on public.body_progress_photos(user_id,angle,photo_date,created_at);
alter table public.body_progress_photos enable row level security;
revoke all on public.body_progress_photos from anon,authenticated;
grant select,insert,delete on public.body_progress_photos to authenticated;
grant update(manual_transform,upload_pending) on public.body_progress_photos to authenticated;
grant all on public.body_progress_photos to service_role;

create policy own_photos on public.body_progress_photos for all to authenticated
 using(user_id=(select auth.uid()))
 with check(user_id=(select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,true));
create policy active_account_required on public.body_progress_photos as restrictive for all to authenticated
 using((select public.account_is_active())) with check((select public.account_is_active()));
create trigger enforce_active_account before insert or update or delete on public.body_progress_photos
 for each row execute function public.enforce_account_active();

create function public.validate_body_photo() returns trigger language plpgsql set search_path='' as $$
declare value jsonb;
begin
 if tg_op='INSERT' and new.upload_pending and exists(
   select 1 from storage.objects where bucket_id='body-progress-photos' and name=new.storage_path
 ) then raise exception 'Photo path already exists' using errcode='23514'; end if;
 if not new.upload_pending and not new.deleting and not exists(
   select 1 from storage.objects where bucket_id='body-progress-photos' and name=new.storage_path
 ) then raise exception 'Photo upload is not complete' using errcode='23514'; end if;
 if tg_op='UPDATE' and old.deleting and not new.deleting then
  raise exception 'Photo deletion is pending' using errcode='23514';
 end if;
 foreach value in array array[new.auto_transform,new.manual_transform] loop
  if value is not null and (jsonb_typeof(value)<>'object' or
    not (value ?& array['scale','x','y']) or value - array['scale','x','y'] <> '{}'::jsonb or
    jsonb_typeof(value->'scale')<>'number' or jsonb_typeof(value->'x')<>'number' or jsonb_typeof(value->'y')<>'number' or
    not ((value->>'scale')::numeric between .1 and 4) or
    not ((value->>'x')::numeric between -2 and 2) or not ((value->>'y')::numeric between -2 and 2)) then
    raise exception 'Invalid photo transform' using errcode='23514';
  end if;
 end loop;
 new.updated_at=now();
 return new;
end $$;
revoke all on function public.validate_body_photo() from public,anon,authenticated;
create trigger validate_body_photo before insert or update on public.body_progress_photos
 for each row execute function public.validate_body_photo();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('body-progress-photos','body-progress-photos',false,6291456,array['image/webp','image/jpeg']);
create policy body_photo_read on storage.objects for select to authenticated using(
 bucket_id='body-progress-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy body_photo_insert on storage.objects for insert to authenticated with check(
 bucket_id='body-progress-photos' and not coalesce((select auth.jwt()->>'is_anonymous')::boolean,true)
 and name ~ ('^'||(select auth.uid())::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/original\.(webp|jpg)$')
 and exists(select 1 from public.body_progress_photos p where p.user_id=(select auth.uid()) and p.storage_path=name and p.upload_pending and not p.deleting));
create policy body_photo_delete on storage.objects for delete to authenticated using(
 bucket_id='body-progress-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
 and not exists(select 1 from public.body_progress_photos p where p.storage_path=name));

-- Deletion of Storage metadata is NOT deletion of physical files. Require cleanup via
-- Storage API first. A row lock on auth.users serializes this with upload inserts.
create function public.guard_body_photo_account_delete() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from storage.objects where bucket_id='body-progress-photos' and (storage.foldername(name))[1]=old.id::text) then
  raise exception 'Remove private body photos through Storage API before deleting the account' using errcode='23503';
 end if;
 return old;
end $$;
revoke all on function public.guard_body_photo_account_delete() from public,anon,authenticated;
create trigger guard_body_photo_account_delete before delete on auth.users for each row execute function public.guard_body_photo_account_delete();

-- Lock owner while adding photo objects: deletion cannot race a new upload.
create function public.lock_body_photo_owner() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.bucket_id='body-progress-photos' then
  perform 1 from auth.users where id=((storage.foldername(new.name))[1])::uuid for key share;
  if not found then raise exception 'Photo owner unavailable' using errcode='23503'; end if;
  -- Reservations serialize new objects with cleanup, including uploads in another tab.
  perform 1 from public.body_progress_photos p where p.storage_path=new.name and p.upload_pending and not p.deleting for update;
  if not found then raise exception 'Photo reservation unavailable' using errcode='23503'; end if;
 end if;
 return new;
end $$;
revoke all on function public.lock_body_photo_owner() from public,anon,authenticated;
create trigger lock_body_photo_owner before insert on storage.objects for each row execute function public.lock_body_photo_owner();
notify pgrst,'reload schema';
commit;
