-- Real RPC, table constraints and storage RLS in a disposable PostgreSQL cluster.
\set ON_ERROR_STOP on
begin;
-- Disposable fixture cleanup models Storage API deletion; RLS remains enforced.
set local storage.allow_delete_query = 'true';
create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'assertion failed: %', message; end if; end $$;
create function pg_temp.expect_error(command text, expected text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute command; exception when others then get stacked diagnostics actual = returned_sqlstate; end;
  if actual is distinct from expected then raise exception 'expected SQLSTATE %, got % for %', expected, actual, command; end if;
end $$;
select pg_temp.assert_true((select public and file_size_limit=5242880 and allowed_mime_types @> array['image/jpeg','image/png','image/webp'] and cardinality(allowed_mime_types)=3 from storage.buckets where id='professional-photos'), 'public bucket accepts only supported images up to 5 MiB');
insert into auth.users(id) values
 ('92000000-0000-0000-0000-000000000001'), ('92000000-0000-0000-0000-000000000002'),
 ('92000000-0000-0000-0000-000000000003'), ('92000000-0000-0000-0000-000000000004');
create temp table photo_invite as select * from public.professional_invites with no data;
grant all on photo_invite to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='92000000-0000-0000-0000-000000000001';
select public.provision_professional_profile('Foto profissional um');
insert into photo_invite select * from public.create_professional_invite('code');
select pg_temp.expect_error($q$select public.set_professional_photo('92000000-0000-0000-0000-000000000001/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg')$q$, '22023');
insert into storage.objects(bucket_id,name) values ('professional-photos','92000000-0000-0000-0000-000000000001/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg');
select pg_temp.assert_true((public.set_professional_photo('92000000-0000-0000-0000-000000000001/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg')).photo_path='92000000-0000-0000-0000-000000000001/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg', 'owner can reference uploaded photo');
select pg_temp.assert_true((select photo_path is not null from public.professional_profiles where user_id=auth.uid()), 'owner profile persists photo');
update storage.objects set metadata='{"updated":true}' where bucket_id='professional-photos';
select pg_temp.assert_true((select metadata->>'updated'='true' from storage.objects where bucket_id='professional-photos'), 'owner can select and update own storage object');
select pg_temp.expect_error($q$select public.set_professional_photo('92000000-0000-0000-0000-000000000001/not-a-uuid.jpg')$q$, '22023');
select pg_temp.expect_error($q$select public.set_professional_photo('92000000-0000-0000-0000-000000000001/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.svg')$q$, '22023');
select pg_temp.expect_error($q$select public.set_professional_photo('92000000-0000-0000-0000-000000000002/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg')$q$, '22023');
-- Existing specialties validator denies direct authenticated writes before CHECK evaluation.
select pg_temp.expect_error($q$update public.professional_profiles set photo_path='92000000-0000-0000-0000-000000000002/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg' where user_id=auth.uid()$q$, '42501');
reset role;
select pg_temp.expect_error($q$update public.professional_profiles set photo_path='92000000-0000-0000-0000-000000000002/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg' where user_id='92000000-0000-0000-0000-000000000001'$q$, '23514');
set local role authenticated;
select pg_temp.expect_error($q$insert into storage.objects(bucket_id,name) values ('professional-photos','92000000-0000-0000-0000-000000000002/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg')$q$, '42501');
select pg_temp.expect_error($q$update storage.objects set name='92000000-0000-0000-0000-000000000002/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg' where bucket_id='professional-photos'$q$, '42501');
set local request.jwt.claim.sub='92000000-0000-0000-0000-000000000002';
select public.provision_professional_profile('Foto profissional dois');
select pg_temp.assert_true((select count(*)=0 from storage.objects where bucket_id='professional-photos'), 'other professional cannot list owner photos');
update storage.objects set metadata='{"intruder":true}' where bucket_id='professional-photos';
delete from storage.objects where bucket_id='professional-photos';
set local request.jwt.claim.sub='92000000-0000-0000-0000-000000000003';
select pg_temp.expect_error($q$select public.set_professional_photo(null)$q$, '42501');
select pg_temp.expect_error($q$insert into storage.objects(bucket_id,name) values ('professional-photos','92000000-0000-0000-0000-000000000003/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg')$q$, '42501');
select pg_temp.assert_true((select photo_path='92000000-0000-0000-0000-000000000001/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg' from public.preview_professional_invite(lower((select code from photo_invite)))), 'invited client sees professional photo with normalized code');
select public.accept_professional_invite((select code from photo_invite));
select pg_temp.assert_true((select photo_path is not null from public.student_professional_summaries()), 'linked client summary includes photo');
select pg_temp.assert_true((select professional->>'photo_path'='92000000-0000-0000-0000-000000000001/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg' from public.student_professional_detail('92000000-0000-0000-0000-000000000001')), 'linked client detail inherits photo');
select pg_temp.assert_true((select count(*)=0 from public.professional_profiles), 'client cannot query professional private profile directly');
set local request.jwt.claim.sub='92000000-0000-0000-0000-000000000004';
select pg_temp.assert_true((select count(*)=0 from public.student_professional_summaries()), 'unrelated client cannot read summaries');
set local request.jwt.claim.sub='92000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select count(*)=1 and bool_and(metadata->>'updated'='true') from storage.objects where bucket_id='professional-photos'), 'unauthorized mutations leave owner photo intact');
select pg_temp.assert_true((public.set_professional_photo(null)).photo_path is null, 'owner removes photo reference');
delete from storage.objects where bucket_id='professional-photos';
select pg_temp.assert_true((select count(*)=0 from storage.objects where bucket_id='professional-photos'), 'owner deletes own photo');
set local request.jwt.claim.sub='';
select pg_temp.expect_error($q$select public.set_professional_photo(null)$q$, '42501');
set local role anon;
select pg_temp.expect_error($q$select public.set_professional_photo(null)$q$, '42501');
select pg_temp.expect_error($q$select * from public.preview_professional_invite('ANY')$q$, '42501');
select pg_temp.expect_error($q$select * from public.student_professional_summaries()$q$, '42501');
rollback;
