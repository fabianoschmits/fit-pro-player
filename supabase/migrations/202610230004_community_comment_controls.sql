alter table public.community_posts
  add column if not exists comments_disabled boolean not null default false;
