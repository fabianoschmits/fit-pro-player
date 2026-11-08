import InsightsBarChart from './InsightsBarChart.jsx'

import InsightsPanel from './InsightsPanel.jsx'

import InsightsKpis from './InsightsKpis.jsx'

import InsightsEmptyState from './InsightsEmptyState.jsx'

export default function InsightsWorkouts(props) {

  return <InsightsPanel {...props} title="Inteligência de treinos" method="getInsightsWorkouts">{data => data.started ? <><InsightsKpis items={[{ label: 'Treinos iniciados', value: data.started },{ label: 'Treinos concluídos', value: data.completed },{ label: 'Treinos abandonados', value: data.abandoned },{ label: 'Conclusão dos finalizados', value: data.completion_rate, suffix: '%' },{ label: 'Duração média concluídos', value: data.duration_minutes, suffix: ' min' },{ label: 'Ainda ativos', value: data.active }]} /><p className="fi-note">Fonte: sessões oficiais no servidor. Coorte por início; sessões ativas excluídas do denominador de conclusão.{data.filtered_sample && ' Filtros de plataforma usam apenas sessões correlacionadas à telemetria consentida.'}</p><h3>Sincronização, recuperação e FPP Flex</h3><InsightsBarChart rows={data.experience} percentage={false} /><h3>Conclusão por duração escolhida no Flex</h3><InsightsBarChart rows={data.flex} /></> : <InsightsEmptyState />}</InsightsPanel>

}
