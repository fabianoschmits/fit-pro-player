create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  image_path text not null,
  caption text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_posts_caption_length check (char_length(caption) <= 500)
);

create table if not exists public.community_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint community_comments_body_length check (char_length(btrim(body)) between 1 and 500)
);

create table if not exists public.community_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('like', 'comment')),
  post_id uuid references public.community_posts(id) on delete cascade,
  comment_id uuid references public.community_comments(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists community_posts_created_at_idx on public.community_posts(created_at desc);
create index if not exists community_comments_post_created_at_idx on public.community_comments(post_id, created_at desc);
create index if not exists community_notifications_recipient_idx on public.community_notifications(recipient_id, created_at desc);

alter table public.community_posts enable row level security;
alter table public.community_likes enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_notifications enable row level security;

grant select, insert, update, delete on public.community_posts to authenticated;
grant select, insert, delete on public.community_likes to authenticated;
grant select, insert, update, delete on public.community_comments to authenticated;
grant select, update on public.community_notifications to authenticated;

create policy community_posts_read on public.community_posts for select to authenticated using (true);
create policy community_posts_insert_own on public.community_posts for insert to authenticated with check (author_id = auth.uid());
create policy community_posts_update_own on public.community_posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy community_posts_delete_own on public.community_posts for delete to authenticated using (author_id = auth.uid());

create policy community_likes_read on public.community_likes for select to authenticated using (true);
create policy community_likes_insert_own on public.community_likes for insert to authenticated with check (user_id = auth.uid());
create policy community_likes_delete_own on public.community_likes for delete to authenticated using (user_id = auth.uid());

create policy community_comments_read on public.community_comments for select to authenticated using (true);
create policy community_comments_insert_own on public.community_comments for insert to authenticated with check (author_id = auth.uid());
create policy community_comments_update_own on public.community_comments for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy community_comments_delete_own on public.community_comments for delete to authenticated using (author_id = auth.uid());

create policy community_notifications_read_own on public.community_notifications for select to authenticated using (recipient_id = auth.uid());
create policy community_notifications_update_own on public.community_notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('community-posts', 'community-posts', true)
on conflict (id) do update set public = true;

create policy community_posts_storage_read on storage.objects for select to public using (bucket_id = 'community-posts');
create policy community_posts_storage_insert on storage.objects for insert to authenticated with check (bucket_id = 'community-posts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy community_posts_storage_delete on storage.objects for delete to authenticated using (bucket_id = 'community-posts' and (storage.foldername(name))[1] = auth.uid()::text);
