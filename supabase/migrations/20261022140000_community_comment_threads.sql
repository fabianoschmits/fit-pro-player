alter table public.community_comments add column if not exists parent_comment_id uuid references public.community_comments(id) on delete cascade;
create index if not exists community_comments_parent_idx on public.community_comments(parent_comment_id, created_at asc);

create table if not exists public.community_comment_likes (
  comment_id uuid not null references public.community_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

grant select, insert, delete on public.community_comment_likes to authenticated;
create policy community_comment_likes_read on public.community_comment_likes for select to authenticated using (true);
create policy community_comment_likes_insert_own on public.community_comment_likes for insert to authenticated with check (user_id = auth.uid());
create policy community_comment_likes_delete_own on public.community_comment_likes for delete to authenticated using (user_id = auth.uid());
