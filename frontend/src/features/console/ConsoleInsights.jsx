import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createInsightsRepository } from '../../lib/insights-repository.js'
import { getBrowserSupabaseClient } from '../../lib/supabase-client.js'
import ConsoleShell from './ConsoleLayout.jsx'
import { AccessGate, useConsoleAccess } from './ConsoleAccess.jsx'
import InsightsFilters, { insightsFilters } from './insights/InsightsFilters.jsx'
import InsightsOverview from './insights/InsightsOverview.jsx'
import InsightsFriction from './insights/InsightsFriction.jsx'
import InsightsFunnels from './insights/InsightsFunnels.jsx'
import InsightsWorkouts from './insights/InsightsWorkouts.jsx'
import InsightsRetention from './insights/InsightsRetention.jsx'
import InsightsPerformance from './insights/InsightsPerformance.jsx'
import InsightsSupport from './insights/InsightsSupport.jsx'
import InsightsAlerts from './insights/InsightsAlerts.jsx'
import './insights/insights.css'
const tabs = [['overview','Visão geral'],['friction','Dificuldades'],['funnels','Funis'],['workouts','Treinos'],['retention','Retenção'],['performance','Desempenho'],['support','Suporte']]
const sections = { overview:InsightsOverview,friction:InsightsFriction,funnels:InsightsFunnels,workouts:InsightsWorkouts,retention:InsightsRetention,performance:InsightsPerformance,support:InsightsSupport,alerts:InsightsAlerts }
function InsightsBody() {
  const [params,setParams] = useSearchParams()
  const query = params.toString()
  const filters = useMemo(() => insightsFilters(new URLSearchParams(query)), [query])
  const repo = useMemo(() => createInsightsRepository(getBrowserSupabaseClient()), [])
  const tab = sections[params.get('tab')] ? params.get('tab') : 'overview', Component = sections[tab]
  const change = patch => setParams(previous => { const next = new URLSearchParams(previous); Object.entries(patch).forEach(([key,value]) => value ? next.set(key,value) : next.delete(key)); return next })
  return <div className="cx-page-body fi-root"><div className="cx-page-head"><h1 className="cx-page-title">FPP Insights</h1><p className="cx-page-sub">Entenda o que acontece no seu aplicativo.</p></div><InsightsFilters params={params} change={change} /><nav className="fi-tabs" aria-label="Seções do FPP Insights">{tabs.map(([id,label]) => <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => change({tab:id,offset:''})}>{label}</button>)}</nav><p className="fi-note">Medição de uso: somente amostra consentida, mínimo de cinco usuários. Treinos e suporte identificam suas fontes operacionais. Horários em São Paulo.</p><div aria-live="polite">{filters.invalid ? <p role="alert">Selecione datas válidas, em ordem, com intervalo de até 90 dias.</p> : <Component key={tab} repo={repo} filters={filters} onTab={id => change({tab:id,offset:''})} />}</div><div className="fi-pagination"><button disabled={!filters.offset} onClick={() => change({offset:String(Math.max(0,filters.offset-20))})}>Anterior</button><span>Página {Math.floor(filters.offset/20)+1}</span><button onClick={() => change({offset:String(Math.min(10000,filters.offset+20))})}>Próxima</button></div></div>
}
export default function ConsoleInsights() {
  const { userId, allowed } = useConsoleAccess()
  return <AccessGate allowed={allowed}><ConsoleShell userId={userId} allowed={allowed}>{allowed && <InsightsBody key={userId} />}</ConsoleShell></AccessGate>
}
