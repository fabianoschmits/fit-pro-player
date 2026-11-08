import InsightsPanel from './InsightsPanel.jsx'
import InsightsBarChart from './InsightsBarChart.jsx'
import { metricValue } from './InsightsKpis.jsx'
export default function InsightsSupport(props) {
  return <InsightsPanel {...props} title="Suporte por categoria" method="getInsightsSupport">{data => <><p className="fi-note">Fonte operacional: chamados existentes, sem conteúdo de mensagens.{data.filtered_sample && ' Plataforma limitada a usuários com atividade consentida correspondente.'}</p><InsightsBarChart rows={data.rows} percentage={false} />{data.rows?.map(row => <p key={row.label} className="fi-note">{row.label}: primeira resposta {metricValue(row.response_hours,' h')} · resolução {metricValue(row.resolution_hours,' h')}</p>)}</>}</InsightsPanel>
}
