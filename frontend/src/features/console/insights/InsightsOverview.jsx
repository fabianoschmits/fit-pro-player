import InsightsPanel from './InsightsPanel.jsx'
import InsightsKpis from './InsightsKpis.jsx'
import InsightsFriction from './InsightsFriction.jsx'
import InsightsPerformance from './InsightsPerformance.jsx'
import InsightsAlerts from './InsightsAlerts.jsx'
import InsightsFunnels from './InsightsFunnels.jsx'
export default function InsightsOverview({ onTab, repo, filters }) {
  const props = { repo, filters }
  return <><InsightsPanel {...props} title="Uso no período" method="getInsightsOverview">{data => <InsightsKpis items={[{label:'Usuários ativos',value:data.active_users,previous:data.previous?.active_users,onClick:()=>onTab('retention')},{label:'Sessões de uso',value:data.sessions,previous:data.previous?.sessions},{label:'Conclusão de treinos',value:data.workout_completion_rate,suffix:'%',onClick:()=>onTab('workouts')},{label:'Abandono de processos',value:data.abandon_rate,suffix:'%',onClick:()=>onTab('funnels')},{label:'Usuários com dificuldades',value:data.affected_users,previous:data.previous?.affected_users,onClick:()=>onTab('friction')},{label:'Erros técnicos',value:data.technical_errors,previous:data.previous?.technical_errors,onClick:()=>onTab('performance')},{label:'Resposta de operações',value:data.response_ms,suffix:' ms',onClick:()=>onTab('performance')},{label:'Retenção D7',value:data.retention,suffix:'%',onClick:()=>onTab('retention')}]} />}</InsightsPanel><div className="fi-grid"><InsightsFriction {...props} /><InsightsFunnels {...props} compact /><InsightsPerformance {...props} /><InsightsAlerts {...props} /></div></>
}
