import useInsightsResource from './useInsightsResource.js'
import InsightsEmptyState from './InsightsEmptyState.jsx'
import { Link, useSearchParams } from 'react-router-dom'
export default function InsightsPanel({ title, method, repo, filters, targetId = null, children }) {
  const resource = useInsightsResource(repo, method, filters, true, targetId)
  const { data, busy, error, refresh } = resource
  const [params] = useSearchParams()
  const detail = {getInsightsFriction:'friction',getInsightsFunnels:'funnels',getInsightsPerformance:'performance',getInsightsAlerts:'alerts'}[method]
  const destination = new URLSearchParams(params)
  if (detail) { destination.set('tab',detail); destination.delete('offset') }
  const heading = detail && (!params.get('tab') || params.get('tab')==='overview') ? <Link to={`?${destination}`}>{title}</Link> : title
  return <section className="fi-panel" aria-label={title}><header><h2>{heading}</h2><button onClick={refresh} aria-label={`Atualizar ${title}`}>Atualizar</button></header>{error && <div role="alert" className="fi-error">{error} <button onClick={refresh}>Tentar novamente</button></div>}{busy && !data ? <div className="fi-skeleton" role="status" aria-label="Carregando indicadores" /> : data?.insufficient || data?.restricted ? <InsightsEmptyState restricted={data?.restricted} /> : data && children(data, refresh)}{data?.updated_at && <p className="fi-note">Atualizado às {new Date(data.updated_at).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'})}{busy ? ' · Atualizando…' : ''}</p>}</section>
}
