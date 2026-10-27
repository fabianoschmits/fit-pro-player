insert into public.support_categories (slug, label, description, sort_order)
values ('community_report', 'Denúncia de comunidade', 'Conteúdo da Comunidade para revisão', 90)
on conflict (slug) do update set label = excluded.label, description = excluded.description, sort_order = excluded.sort_order;

create table if not exists public.community_report_context (
  ticket_id uuid primary key references public.support_tickets(id) on delete cascade,
  target_kind text not null check (target_kind in ('post', 'comment')),
  post_id uuid not null,
  comment_id uuid,
  reported_user_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'misinformation', 'other')),
  description text check (description is null or char_length(btrim(description)) between 3 and 1000),
  verification_link text not null check (verification_link like '/community?post=%'),
  content_excerpt text not null check (char_length(content_excerpt) <= 500),
  created_at timestamptz not null default now(),
  check ((target_kind = 'post' and comment_id is null) or (target_kind = 'comment' and comment_id is not null))
);

create index if not exists community_report_context_target_idx on public.community_report_context(post_id, comment_id, created_at desc);
alter table public.community_report_context enable row level security;
revoke all on table public.community_report_context from public, anon, authenticated;

create or replace function public.community_report_content(
  p_target_kind text,
  p_post_id uuid,
  p_comment_id uuid,
  p_reason text,
  p_description text default null
)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_category_id uuid; v_ticket_id uuid; v_author_id uuid; v_excerpt text; v_reason text := lower(btrim(coalesce(p_reason, ''))); v_description text := nullif(btrim(coalesce(p_description, '')), '');
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_target_kind not in ('post', 'comment') or p_post_id is null or (p_target_kind = 'post' and p_comment_id is not null) or (p_target_kind = 'comment' and p_comment_id is null) then raise exception 'Conteúdo indisponível' using errcode='22023'; end if;
  if v_reason not in ('spam', 'harassment', 'inappropriate', 'misinformation', 'other') then raise exception 'Motivo de denúncia inválido' using errcode='22023'; end if;
  if v_reason = 'other' and (v_description is null or char_length(v_description) < 3) then raise exception 'Explique o motivo da denúncia' using errcode='22023'; end if;
  if v_reason <> 'other' then v_description := null; end if;

  if p_target_kind = 'post' then
    select author_id, left(coalesce(caption, ''), 500) into v_author_id, v_excerpt from public.community_posts where id = p_post_id;
  else
    select author_id, left(body, 500) into v_author_id, v_excerpt from public.community_comments where id = p_comment_id and post_id = p_post_id;
  end if;
  if v_author_id is null then raise exception 'Conteúdo indisponível' using errcode='22023'; end if;
  if v_author_id = auth.uid() then raise exception 'Você não pode denunciar seu próprio conteúdo' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_target_kind || ':' || p_post_id::text || ':' || coalesce(p_comment_id::text, ''), 0));
  select r.ticket_id into v_ticket_id from public.community_report_context r join public.support_tickets t on t.id = r.ticket_id where t.user_id = auth.uid() and r.target_kind = p_target_kind and r.post_id = p_post_id and r.comment_id is not distinct from p_comment_id and t.status <> 'archived' order by r.created_at desc limit 1;
  if v_ticket_id is not null then return v_ticket_id; end if;

  select id into v_category_id from public.support_categories where slug = 'community_report' and is_active;
  if v_category_id is null then raise exception 'Categoria de denúncia indisponível' using errcode='55000'; end if;
  insert into public.support_tickets(user_id, category_id, subject) values (auth.uid(), v_category_id, case when p_target_kind = 'post' then 'Denúncia de publicação' else 'Denúncia de comentário' end) returning id into v_ticket_id;
  insert into public.support_messages(ticket_id, author_id, author_kind, body) values (v_ticket_id, auth.uid(), 'user', case v_reason when 'spam' then 'Motivo: spam.' when 'harassment' then 'Motivo: assédio ou discurso de ódio.' when 'inappropriate' then 'Motivo: conteúdo impróprio.' when 'misinformation' then 'Motivo: informação enganosa.' else 'Motivo: outro. ' || v_description end);
  insert into public.community_report_context(ticket_id, target_kind, post_id, comment_id, reported_user_id, reason, description, verification_link, content_excerpt) values (v_ticket_id, p_target_kind, p_post_id, p_comment_id, v_author_id, v_reason, v_description, '/community?post=' || p_post_id::text, coalesce(v_excerpt, ''));
  insert into public.support_ticket_events(ticket_id, actor_id, event_type, to_value) values (v_ticket_id, auth.uid(), 'community_reported', jsonb_build_object('target_kind', p_target_kind, 'post_id', p_post_id, 'comment_id', p_comment_id, 'reason', v_reason));
  return v_ticket_id;
end; $$;

create or replace function public.ops_support_ticket_detail(p_ticket_id uuid) returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v jsonb;
begin
  perform public.ops_require_admin();
  select jsonb_build_object(
    'ticket', to_jsonb(t),
    'category', jsonb_build_object('slug', c.slug, 'label', c.label),
    'messages', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.support_messages m where m.ticket_id=t.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from public.support_ticket_events e where e.ticket_id=t.id), '[]'::jsonb),
    'report_context', (select jsonb_build_object('target_kind', r.target_kind, 'post_id', r.post_id, 'comment_id', r.comment_id, 'reported_user_id', r.reported_user_id, 'reason', r.reason, 'description', r.description, 'verification_link', r.verification_link, 'content_excerpt', r.content_excerpt, 'created_at', r.created_at) from public.community_report_context r where r.ticket_id=t.id)
  ) into v from public.support_tickets t join public.support_categories c on c.id=t.category_id where t.id=p_ticket_id;
  if v is null then raise exception 'ticket not found' using errcode='P0002'; end if;
  return v;
end; $$;

revoke all on function public.community_report_content(text,uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.community_report_content(text,uuid,uuid,text,text) to authenticated;
