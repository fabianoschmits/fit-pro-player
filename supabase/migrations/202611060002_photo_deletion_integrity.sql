begin;

create function public.community_photo_object_path(value text) returns text
language plpgsql immutable set search_path='' as $$
declare path text=value; bytes bytea=''::bytea; pos integer=1;
begin
 if path like '%/object/public/community-posts/%' then
  path=split_part(split_part(path,'/object/public/community-posts/',2),'?',1);
 elsif path like '%/object/sign/community-posts/%' then
  path=split_part(split_part(path,'/object/sign/community-posts/',2),'?',1);
 else return path;
 end if;
 while pos<=length(path) loop
  if substr(path,pos,1)='%' and substr(path,pos+1,2) ~ '^[0-9a-fA-F]{2}$' then
   bytes=bytes||decode(substr(path,pos+1,2),'hex'); pos=pos+3;
  else
   bytes=bytes||convert_to(substr(path,pos,1),'UTF8'); pos=pos+1;
  end if;
 end loop;
 return convert_from(bytes,'UTF8');
end $$;
revoke all on function public.community_photo_object_path(text) from public,anon,authenticated;

-- Never delete Storage SQL metadata to simulate deletion: the Storage API must
-- remove the physical file before its application reference may disappear.
create function public.guard_community_photo_delete() returns trigger
language plpgsql security definer set search_path='' as $$
declare path text;
begin
 path=public.community_photo_object_path(old.image_path);
 if exists(select 1 from storage.objects where bucket_id='community-posts' and name=path) then
  raise exception 'Remove the photo through Storage API before deleting the post' using errcode='23503';
 end if;
 return old;
end $$;
revoke all on function public.guard_community_photo_delete() from public,anon,authenticated;
create trigger guard_community_photo_delete before delete on public.community_posts
 for each row execute function public.guard_community_photo_delete();

create function public.guard_body_photo_row_delete() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from storage.objects where bucket_id='body-progress-photos' and name=old.storage_path) then
  raise exception 'Remove the photo through Storage API before deleting its record' using errcode='23503';
 end if;
 return old;
end $$;
revoke all on function public.guard_body_photo_row_delete() from public,anon,authenticated;
create trigger guard_body_photo_row_delete before delete on public.body_progress_photos
 for each row execute function public.guard_body_photo_row_delete();

-- A post may edit its caption, never exchange ownership or its physical object.
create function public.guard_community_photo_identity() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.author_id is distinct from old.author_id or new.image_path is distinct from old.image_path then
  raise exception 'Post photo identity cannot change' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function public.guard_community_photo_identity() from public,anon,authenticated;
create trigger guard_community_photo_identity before update on public.community_posts
 for each row execute function public.guard_community_photo_identity();

-- Also protects operator/account cascades, including legacy professional photos.
create or replace function public.guard_body_photo_account_delete() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from storage.objects
  where bucket_id in('body-progress-photos','community-posts','professional-photos')
  and (storage.foldername(name))[1]=old.id::text) then
  raise exception 'Remove account photos through Storage API before deleting the account' using errcode='23503';
 end if;
 return old;
end $$;

create function public.lock_account_photo_owner() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.bucket_id in('community-posts','professional-photos') then
  perform 1 from auth.users where id=((storage.foldername(new.name))[1])::uuid for key share;
  if not found then raise exception 'Photo owner unavailable' using errcode='23503'; end if;
 end if;
 return new;
end $$;
revoke all on function public.lock_account_photo_owner() from public,anon,authenticated;
create trigger lock_account_photo_owner before insert or update on storage.objects
 for each row execute function public.lock_account_photo_owner();
notify pgrst,'reload schema';
commit;
