import InsightsPanel from './InsightsPanel.jsx'
import InsightsFunnel from './InsightsFunnel.jsx'
import InsightsEmptyState from './InsightsEmptyState.jsx'
const titles = { onboarding:'Configuração inicial',plan_creation:'Criação de treino pessoal',workout:'Execução do treino',professional:'Vínculo aluno-profissional',photos:'Fotos de evolução',community:'Comunidade' }
export default function InsightsFunnels({ compact = false, repo, filters }) {
  const props = { repo, filters }
  return <InsightsPanel {...props} title="Jornada dos usuários" method="getInsightsFunnels">{data => data.rows?.length ? (compact ? data.rows.slice(0,1) : data.rows).map(row => <div key={row.flow}><h3>{titles[row.flow] || row.flow}</h3><InsightsFunnel rows={row.steps} /></div>) : <InsightsEmptyState />}</InsightsPanel>
}
