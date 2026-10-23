do $$
begin
  if not exists (
    select 1
    from pg_publication p
    join pg_publication_rel r on r.prpubid = p.oid
    join pg_class c on c.oid = r.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'community_notifications'
  ) then
    alter publication supabase_realtime add table public.community_notifications;
  end if;
end $$;
