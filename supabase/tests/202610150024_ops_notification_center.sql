-- Run against the linked QA project inside a transaction; never retain read markers.
begin;
do $$
declare admin_id uuid; user_id uuid; first_id text; feed jsonb; before_reads bigint;
begin
  select r.user_id into admin_id from public.user_roles r where r.role = 'admin' limit 1;
  select p.id into user_id from public.profiles p where p.id <> admin_id and not exists (
    select 1 from public.user_roles r where r.user_id = p.id and r.role = 'admin'
  ) limit 1;
  if admin_id is null or user_id is null then raise exception 'QA admin and regular account required'; end if;
  perform set_config('request.jwt.claim.sub', user_id::text, true);
  begin
    perform public.ops_list_notifications();
    raise exception 'FAIL: regular user can read project notifications';
  exception when insufficient_privilege then null; end;
  begin
    perform public.ops_mark_notifications_read(null);
    raise exception 'FAIL: regular user can mark project notifications';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  feed := public.ops_list_notifications(5,0);
  if jsonb_array_length(feed->'items') > 5 then raise exception 'FAIL: pagination limit ignored'; end if;
  if (feed->>'unread_count')::bigint < 1 then raise exception 'QA notifications required'; end if;
  first_id := feed->'items'->0->>'id';
  if feed->'items'->0->>'target_path' not like '/console/%' then raise exception 'FAIL: invalid target'; end if;
  perform public.ops_mark_notifications_read(first_id);
  if not exists (select 1 from public.ops_notification_reads r where r.admin_user_id = admin_id and r.notification_id = first_id) then raise exception 'FAIL: read marker not stored'; end if;
  select count(*) into before_reads from public.ops_notification_reads r where r.admin_user_id = admin_id;
  perform public.ops_mark_notifications_read('not-a-real-notification');
  if (select count(*) from public.ops_notification_reads r where r.admin_user_id = admin_id) <> before_reads then raise exception 'FAIL: arbitrary marker stored'; end if;
  if exists(select 1 from public.ops_notification_reads r where r.admin_user_id = user_id and r.notification_id = first_id) then raise exception 'FAIL: read state crosses accounts'; end if;
  perform public.ops_mark_notifications_read(null);
  feed := public.ops_list_notifications();
  if (feed->>'unread_count')::bigint <> 0 then raise exception 'FAIL: mark all did not clear count'; end if;
end;
$$;
select 'notification access, pagination, routing and read-state checks passed' as result;
rollback;
