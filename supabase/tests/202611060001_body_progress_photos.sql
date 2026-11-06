begin;
select plan(1);
-- Isolated test identities, rolled back at the end.
insert into auth.users(id) values('f0000000-0000-4000-8000-000000000001'),('f0000000-0000-4000-8000-000000000002');
insert into public.body_progress_photos(id,user_id,photo_date,angle,storage_path,width,height,file_size,mime_type)
values('f1000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','2026-11-06','front','f0000000-0000-4000-8000-000000000001/f1000000-0000-4000-8000-000000000001/original.webp',900,1600,40000,'image/webp');

do $$ begin
 begin
  update public.body_progress_photos set upload_pending=false where id='f1000000-0000-4000-8000-000000000001';
  raise exception 'test: allowed completion without Storage object';
 exception when check_violation then null; end;
 begin
  insert into storage.objects(bucket_id,name) values('body-progress-photos','f0000000-0000-4000-8000-000000000001/f1000000-0000-4000-8000-000000000099/original.webp');
  raise exception 'test: allowed unreserved upload';
 exception when foreign_key_violation then null; end;
 begin
  update public.body_progress_photos set manual_transform='{"scale":1,"x":0,"y":0,"face":[]}' where id='f1000000-0000-4000-8000-000000000001';
  raise exception 'test: accepted unexpected biometric fields';
 exception when check_violation then null; end;
end $$;

insert into storage.objects(bucket_id,name) values('body-progress-photos','f0000000-0000-4000-8000-000000000001/f1000000-0000-4000-8000-000000000001/original.webp');
update public.body_progress_photos set upload_pending=false where id='f1000000-0000-4000-8000-000000000001';
do $$ begin
 begin
  delete from auth.users where id='f0000000-0000-4000-8000-000000000001';
  raise exception 'test: allowed account deletion leaving Storage orphan';
 exception when foreign_key_violation then null; end;
 if (select public from storage.buckets where id='body-progress-photos') then raise exception 'test: public bucket'; end if;
end $$;

-- Run ownership checks with an ordinary authenticated JWT, never table-owner privileges.
set local role authenticated;
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"f0000000-0000-4000-8000-000000000001","is_anonymous":false}',true);
do $$ begin
 if not exists(select 1 from public.body_progress_photos where id='f1000000-0000-4000-8000-000000000001') then raise exception 'test: owner cannot read photo'; end if;
 if not exists(select 1 from storage.objects where bucket_id='body-progress-photos') then raise exception 'test: owner cannot read own Storage'; end if;
 update public.body_progress_photos set manual_transform='{"scale":0.9,"x":0.1,"y":0.1}' where id='f1000000-0000-4000-8000-000000000001';
end $$;
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"f0000000-0000-4000-8000-000000000002","is_anonymous":false}',true);
do $$ begin
 if exists(select 1 from public.body_progress_photos) then raise exception 'test: cross-account photo read'; end if;
 if exists(select 1 from storage.objects where bucket_id='body-progress-photos') then raise exception 'test: cross-account Storage read'; end if;
 begin
  insert into public.body_progress_photos(id,user_id,photo_date,angle,storage_path,width,height,file_size,mime_type)
  values('f1000000-0000-4000-8000-000000000002','f0000000-0000-4000-8000-000000000001','2026-11-06','front','f0000000-0000-4000-8000-000000000001/f1000000-0000-4000-8000-000000000002/original.webp',900,1600,40000,'image/webp');
  raise exception 'test: cross-account photo insert';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select pass('private photos enforce reservation, transform validation, account cleanup and owner isolation');
select finish();
rollback;
