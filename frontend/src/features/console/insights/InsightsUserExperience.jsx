import { Link } from 'react-router-dom'
import { insightLabel } from './insights-labels.js'
import { useMemo } from 'react'
import { createInsightsRepository } from '../../../lib/insights-repository.js'
import { getBrowserSupabaseClient } from '../../../lib/supabase-client.js'
import InsightsPanel from './InsightsPanel.jsx'
import InsightsEmptyState from './InsightsEmptyState.jsx'
import './insights.css'
export default function InsightsUserExperience({ targetId }) {
  const repo = useMemo(() => createInsightsRepository(getBrowserSupabaseClient()), [])
  const filters = useMemo(() => ({period:'7',from:new Date(Date.now()-7*86400000).toISOString(),to:new Date().toISOString(),limit:20}),[])
  return <div className="fi-root"><InsightsPanel title="Experiência de uso" method="getUserInsights" repo={repo} filters={filters} targetId={targetId}>{data => <>
    {data.rows?.length ? <><p className="fi-note">Última atividade observada: {new Date(data.rows[0].occurred_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}. Últimos 20 registros permitidos no período.</p>{data.rows.map((row,i) => <div className="fi-alert" key={i}><strong>{insightLabel(row.action || row.flow || row.name)}</strong><p>{insightLabel(row.platform)} · v{row.app_version} · {new Date(row.occurred_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p>{row.error_category && <p>Categoria técnica: {row.error_category}</p>}</div>)}</> : <InsightsEmptyState />}
    {data.related_tickets?.length>0 && <><h3>Chamados existentes</h3>{data.related_tickets.map(ticket=><p key={ticket.id}><Link to={`/console/support/${ticket.id}`}>{ticket.category} · {ticket.status}</Link></p>)}</>}
  </>}</InsightsPanel></div>
}
