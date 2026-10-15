-- Workout events belong to a professional's devices but describe a student's workout.
create or replace function public.ops_notification_feed()
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
    coalesce(nullif(student.display_name, ''), nullif(p.display_name, ''), 'Usuário'),
    '/console/users/' || coalesce(w.student_user_id, e.owner_id)::text || case when e.kind like 'student_workout_%' then '?section=training' else '' end,
    e.created_at
  from (
    select distinct on (ne.owner_id, ne.event_key) ne.owner_id, ne.event_key, ne.kind, ne.created_at
    from public.notification_events ne order by ne.owner_id, ne.event_key, ne.created_at desc
  ) e
  left join public.workout_executions w on e.kind in ('student_workout_completed', 'student_workout_abandoned')
    and w.id::text = split_part(e.event_key, ':', 2)
  left join public.profiles student on student.id = w.student_user_id
  left join public.profiles p on p.id = e.owner_id;
end;
$$;
revoke all on function public.ops_notification_feed() from public, anon, authenticated;
