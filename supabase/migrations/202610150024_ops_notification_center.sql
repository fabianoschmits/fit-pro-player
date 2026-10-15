-- Unified project activity for platform administrators, with per-admin read state.
create table public.ops_notification_reads (
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  notification_id text not null check (char_length(notification_id) between 1 and 300),
  read_at timestamptz not null default now(),
  primary key (admin_user_id, notification_id)
);
alter table public.ops_notification_reads enable row level security;
revoke all on table public.ops_notification_reads from public, anon, authenticated;
create policy ops_notification_reads_owner on public.ops_notification_reads
  for select to authenticated using (admin_user_id = auth.uid());
create index support_messages_admin_feed_idx on public.support_messages(created_at desc) where author_kind = 'user';

create function public.ops_notification_feed()
returns table (id text, kind text, title text, body text, target_path text, created_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.ops_require_admin();
  return query
  select 'support:' || m.id::text, 'support'::text, 'Mensagem recebida'::text,
    coalesce(nullif(p.display_name, ''), 'Usuário') || ': ' || t.subject,
    '/console/support/' || t.id::text, m.created_at
  from public.support_messages m
  join public.support_tickets t on t.id = m.ticket_id
  left join public.profiles p on p.id = t.user_id
  where m.author_kind = 'user'
  union all
  select 'user:' || p.id::text, 'account'::text, 'Novo usuário na plataforma'::text,
    coalesce(nullif(p.display_name, ''), 'Conta sem nome'), '/console/users/' || p.id::text, p.created_at
  from public.profiles p
  union all
  select 'verification:' || pp.user_id::text || ':' || pp.updated_at::text,
    'verification'::text, 'Verificação profissional pendente'::text,
    pp.professional_name, '/console/users/' || pp.user_id::text || '?section=professional', pp.updated_at
  from public.professional_profiles pp where pp.verification_status = 'pending'
  union all
  select 'faq:' || a.id::text || ':' || a.updated_at::text, 'faq'::text,
    case when a.is_published then 'Pergunta publicada no FAQ' else 'Rascunho do FAQ atualizado' end,
    a.question, '/console/faq/' || a.id::text, a.updated_at
  from public.support_faq_articles a
  union all
  select 'event:' || e.owner_id::text || ':' || e.event_key, e.kind,
    case e.kind
      when 'program_updated' then 'Programa de treino enviado'
      when 'program_removed' then 'Programa de treino removido'
      when 'relationship_accepted' then 'Vínculo profissional aceito'
      when 'relationship_ended' then 'Vínculo profissional encerrado'
      when 'student_workout_completed' then 'Treino de aluno concluído'
      when 'student_workout_abandoned' then 'Treino de aluno interrompido'
      when 'verification_changed' then 'Verificação profissional atualizada'
      else 'Atividade na plataforma'
    end,
    coalesce(nullif(p.display_name, ''), 'Usuário'),
    '/console/users/' || e.owner_id::text || case when e.kind like 'student_workout_%' then '?section=training' else '' end,
    e.created_at
  from (
    select distinct on (ne.owner_id, ne.event_key) ne.owner_id, ne.event_key, ne.kind, ne.created_at
    from public.notification_events ne order by ne.owner_id, ne.event_key, ne.created_at desc
  ) e left join public.profiles p on p.id = e.owner_id;
end;
$$;
revoke all on function public.ops_notification_feed() from public, anon, authenticated;

create function public.ops_list_notifications(p_limit integer default 25, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  caller uuid := public.ops_require_admin();
  lim integer := greatest(1, least(coalesce(p_limit, 25), 100));
  off_count integer := greatest(0, coalesce(p_offset, 0));
  result jsonb;
begin
  with feed as materialized (
    select f.*, r.read_at from public.ops_notification_feed() f
    left join public.ops_notification_reads r on r.notification_id = f.id and r.admin_user_id = caller
  ), page as (
    select f.* from feed f order by f.created_at desc, f.id limit lim offset off_count
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc, p.id) from page p), '[]'::jsonb),
    'unread_count', (select count(*) from feed f where f.read_at is null),
    'has_more', (select count(*) > off_count + lim from feed)
  ) into result;
  return result;
end;
$$;

create function public.ops_mark_notifications_read(p_notification_id text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare caller uuid := public.ops_require_admin();
begin
  insert into public.ops_notification_reads(admin_user_id, notification_id)
  select caller, f.id from public.ops_notification_feed() f
  where p_notification_id is null or f.id = p_notification_id
  on conflict (admin_user_id, notification_id) do nothing;
end;
$$;

revoke all on function public.ops_list_notifications(integer, integer), public.ops_mark_notifications_read(text) from public, anon, authenticated;
grant execute on function public.ops_list_notifications(integer, integer), public.ops_mark_notifications_read(text) to authenticated;
