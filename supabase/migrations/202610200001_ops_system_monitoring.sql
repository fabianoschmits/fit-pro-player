-- System monitoring and error tracking for Central do Admin
create table if not exists public.ops_system_errors (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  severity text not null check (severity in ('warning', 'error', 'critical')),
  message text not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists ops_system_errors_unresolved_idx on public.ops_system_errors(created_at desc) where resolved_at is null;
alter table public.ops_system_errors enable row level security;
revoke all on table public.ops_system_errors from public, anon, authenticated;

create or replace function public.ops_system_health()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := public.ops_require_admin();
  v_connections jsonb;
  v_active_queries jsonb;
  v_cron_jobs jsonb;
  v_cron_runs jsonb;
  v_table_sizes jsonb;
  v_slow_queries jsonb;
  v_unresolved_errors jsonb;
  v_db_size text;
begin
  select coalesce(jsonb_agg(jsonb_build_object('state', coalesce(state, 'unknown'), 'count', c)), '[]'::jsonb)
  into v_connections
  from (select state, count(*) as c from pg_stat_activity group by state) t;

  select coalesce(jsonb_agg(jsonb_build_object(
    'pid', pid,
    'usename', usename,
    'state', state,
    'duration_sec', duration_sec,
    'query', left(query, 300)
  )), '[]'::jsonb)
  into v_active_queries
  from (
    select pid, usename, state, query, round(extract(epoch from (now() - query_start))::numeric, 2) as duration_sec
    from pg_stat_activity
    where state != 'idle' and pid <> pg_backend_pid()
    order by query_start asc
    limit 20
  ) aq;

  if to_regnamespace('cron') is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'jobid', jobid,
      'schedule', schedule,
      'command', command,
      'active', active
    )), '[]'::jsonb)
    into v_cron_jobs
    from cron.job;

    select coalesce(jsonb_agg(jsonb_build_object(
      'jobid', jobid,
      'runid', runid,
      'status', status,
      'return_message', return_message,
      'start_time', start_time,
      'end_time', end_time,
      'duration_ms', round((extract(epoch from (end_time - start_time)) * 1000)::numeric, 1)
    )), '[]'::jsonb)
    into v_cron_runs
    from (
      select * from cron.job_run_details
      order by start_time desc
      limit 25
    ) cr;
  else
    v_cron_jobs := '[]'::jsonb;
    v_cron_runs := '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'table_name', table_name,
    'size', pg_size_pretty(total_bytes),
    'bytes', total_bytes
  )), '[]'::jsonb)
  into v_table_sizes
  from (
    select relname as table_name, pg_total_relation_size(c.oid) as total_bytes
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by total_bytes desc
    limit 15
  ) ts;

  select pg_size_pretty(pg_database_size(current_database())) into v_db_size;

  if to_regclass('pg_stat_statements') is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'calls', calls,
      'total_time_ms', round(total_exec_time::numeric, 1),
      'mean_time_ms', round(mean_exec_time::numeric, 2),
      'query', left(query, 250)
    )), '[]'::jsonb)
    into v_slow_queries
    from (
      select calls, total_exec_time, mean_exec_time, query
      from pg_stat_statements
      order by total_exec_time desc
      limit 15
    ) sq;
  else
    v_slow_queries := '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'source', source,
    'severity', severity,
    'message', message,
    'details', details,
    'created_at', created_at,
    'resolved_at', resolved_at
  ) order by created_at desc), '[]'::jsonb)
  into v_unresolved_errors
  from (
    select * from public.ops_system_errors
    order by created_at desc
    limit 50
  ) errs;

  return jsonb_build_object(
    'database_size', v_db_size,
    'connections', coalesce(v_connections, '[]'::jsonb),
    'active_queries', v_active_queries,
    'cron_jobs', v_cron_jobs,
    'cron_runs', v_cron_runs,
    'table_sizes', v_table_sizes,
    'slow_queries', v_slow_queries,
    'system_errors', v_unresolved_errors,
    'unresolved_error_count', (select count(*) from public.ops_system_errors where resolved_at is null),
    'timestamp', now()
  );
end;
$$;

revoke all on function public.ops_system_health() from public, anon, authenticated;
grant execute on function public.ops_system_health() to authenticated;

-- Function to resolve system error
create or replace function public.ops_resolve_system_error(p_error_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.ops_require_admin();
  update public.ops_system_errors
  set resolved_at = now()
  where id = p_error_id;
end;
$$;

revoke all on function public.ops_resolve_system_error(uuid) from public, anon, authenticated;
grant execute on function public.ops_resolve_system_error(uuid) to authenticated;

-- Function to record a system error (callable by authenticated or background procedures)
create or replace function public.ops_log_system_error(
  p_source text,
  p_message text,
  p_severity text default 'error',
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.ops_system_errors (source, message, severity, details)
  values (
    coalesce(nullif(trim(p_source), ''), 'system'),
    coalesce(nullif(trim(p_message), ''), 'Unknown system event'),
    case when p_severity in ('warning', 'error', 'critical') then p_severity else 'error' end,
    coalesce(p_details, '{}'::jsonb)
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.ops_log_system_error(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.ops_log_system_error(text, text, text, jsonb) to authenticated;

-- Include system errors in ops_notification_feed for admin bell
create or replace function public.ops_notification_feed()
returns table (id text, kind text, title text, body text, target_path text, created_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.ops_require_admin();
  return query
  select 'error:' || e.id::text, 'system_error'::text, 'Erro do sistema (' || e.severity || ')'::text,
    e.source || ': ' || e.message, '/console/system?tab=errors', e.created_at
  from public.ops_system_errors e
  where e.resolved_at is null
  union all
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

