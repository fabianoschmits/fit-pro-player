begin;
create or replace function public.ops_insights_refresh_alerts(p_filters jsonb default '{}') returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare caller uuid:=public.ops_require_admin();
 f timestamptz:=coalesce((p_filters->>'from')::timestamptz,now()-interval '7 days');
 t timestamptz:=coalesce((p_filters->>'to')::timestamptz,now());
 plat text:=nullif(p_filters->>'platform',''); ver text:=nullif(p_filters->>'version',''); dev text:=nullif(p_filters->>'device','');
 current_count bigint; prior_count bigint; current_done bigint; prior_done bigint; affected bigint; first_at timestamptz; last_at timestamptz;
begin
 if t<=f or t-f>interval '90 days' or f<now()-interval '180 days' then raise exception 'invalid period' using errcode='22023'; end if;
 insert into public.insights_admin_access(admin_id,resource) values(caller,'refresh_anomaly_alerts');
 with e as (select * from public.insights_events where occurred_at>=f-(t-f) and occurred_at<t and (plat is null or platform=plat) and (ver is null or app_version=ver) and (dev is null or device=dev)),
 g as (select coalesce(action,flow,name) as area,platform,app_version,device,
 count(distinct user_id) filter(where occurred_at>=f) as exposed,
 count(*) filter(where occurred_at>=f and name in ('action_failed','runtime_error','sync_failed','workout_recovery_failed')) as failures,
 count(*) filter(where occurred_at<f and name in ('action_failed','runtime_error','sync_failed','workout_recovery_failed')) as prior_failures,
 count(distinct user_id) filter(where occurred_at>=f and name in ('action_failed','runtime_error','sync_failed','workout_recovery_failed')) as users,
 count(distinct user_id) filter(where occurred_at<f and name in ('action_failed','runtime_error','sync_failed','workout_recovery_failed')) as prior_users,
 count(*) filter(where occurred_at>=f and name='operation_slow') as slow,
 count(distinct user_id) filter(where occurred_at>=f and name='operation_slow') as slow_users,
 count(*) filter(where occurred_at>=f and name='flow_interrupted') as interruptions,
 count(*) filter(where occurred_at<f and name='flow_interrupted') as prior_interruptions,
 count(distinct user_id) filter(where occurred_at>=f and name='flow_interrupted') as interrupted_users,
 count(distinct user_id) filter(where occurred_at<f and name='flow_interrupted') as prior_interrupted_users,
 min(occurred_at) filter(where occurred_at>=f) as first_seen,max(occurred_at) as last_seen
 from e group by coalesce(action,flow,name),platform,app_version,device),
 candidates as (select g.*,r.reason,r.title,r.users as affected,r.occurrences
 from g cross join lateral (values
 ('failure_growth','Crescimento de falhas',case when g.users>=5 and g.prior_users>=5 and g.failures>=10 and g.failures>=1.5*g.prior_failures then g.users end,g.failures),
 ('version_concentration','Falhas concentradas em uma versão',case when g.users>=5 and g.exposed>=20 and g.failures>=10 and 1.0*g.users/g.exposed>=0.2 then g.users end,g.failures),
 ('slow_platform','Lentidão concentrada em uma plataforma',case when g.slow_users>=5 and g.slow>=10 then g.slow_users end,g.slow),
 ('interruption_growth','Aumento de interrupções observadas',case when g.interrupted_users>=5 and g.prior_interrupted_users>=5 and g.interruptions>=10 and g.interruptions>=1.5*g.prior_interruptions then g.interrupted_users end,g.interruptions)
 ) r(reason,title,users,occurrences) where r.users is not null)
 insert into public.insights_alerts(fingerprint,title,description,impact,affected_users,occurrences,platform,app_version,device,first_seen,last_seen)
 select reason||':'||area||':'||platform||':'||app_version||':'||device,title||': '||area,
 case reason when 'failure_growth' then 'Volume de falhas ao menos 50% maior que no período anterior equivalente; ambos com amostra mínima.'
 when 'version_concentration' then 'Ao menos 20% dos usuários observados nesta área e versão tiveram falhas. A causa ainda requer investigação.'
 when 'slow_platform' then 'Operações pendentes acima do limite técnico em múltiplos usuários. Não inclui descanso de treino.'
 else 'Interrupções por navegação cresceram ao menos 50% sobre o período anterior equivalente. Interrupção não prova falha técnica.' end,
 'high',c.affected,c.occurrences,c.platform,c.app_version,c.device,c.first_seen,c.last_seen from candidates c
 on conflict(fingerprint) do update set affected_users=excluded.affected_users,occurrences=excluded.occurrences,last_seen=greatest(insights_alerts.last_seen,excluded.last_seen);

 -- Official finalized cohorts: no telemetry success event substitutes the domain status.
 select count(*) filter(where w.started_at>=f),count(*) filter(where w.started_at<f),
 count(*) filter(where w.started_at>=f and w.status='completed'),count(*) filter(where w.started_at<f and w.status='completed'),
 count(distinct w.user_id) filter(where w.started_at>=f and w.status='abandoned'),min(w.started_at) filter(where w.started_at>=f),max(w.updated_at) filter(where w.started_at>=f)
 into current_count,prior_count,current_done,prior_done,affected,first_at,last_at
 from public.workout_sessions w where w.started_at>=f-(t-f) and w.started_at<t and w.status in ('completed','abandoned')
 and ((plat is null and ver is null and dev is null) or exists(select 1 from public.insights_events e where e.journey_id=w.id and e.user_id=w.user_id and e.occurred_at>=f-(t-f) and e.occurred_at<t and (plat is null or e.platform=plat) and (ver is null or e.app_version=ver) and (dev is null or e.device=dev)));
 if current_count>=20 and prior_count>=20 and affected>=5 and 1.0*current_done/current_count<=1.0*prior_done/prior_count-0.15 then
  insert into public.insights_alerts(fingerprint,title,description,impact,affected_users,occurrences,platform,app_version,device,first_seen,last_seen)
  values('completion_drop:'||coalesce(plat,'all')||':'||coalesce(ver,'all')||':'||coalesce(dev,'all'),'Queda na conclusão dos treinos','Queda de pelo menos 15 pontos percentuais entre coortes finalizadas com ao menos 20 sessões em cada período. Sessões ativas são excluídas.','high',affected,current_count-current_done,plat,ver,dev,first_at,last_at)
  on conflict(fingerprint) do update set affected_users=excluded.affected_users,occurrences=excluded.occurrences,last_seen=greatest(insights_alerts.last_seen,excluded.last_seen);
 end if;
end $$;
revoke all on function public.ops_insights_refresh_alerts(jsonb) from public,anon,authenticated;
grant execute on function public.ops_insights_refresh_alerts(jsonb) to authenticated;
commit;
