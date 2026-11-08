import InsightsTrendChart from './InsightsTrendChart.jsx'
import InsightsPanel from './InsightsPanel.jsx'
import InsightsBarChart from './InsightsBarChart.jsx'
import InsightsEmptyState from './InsightsEmptyState.jsx'
export default function InsightsPerformance(props) {
  return <InsightsPanel {...props} title="Desempenho e problemas técnicos" method="getInsightsPerformance">{data => !data.rows?.length && !data.trend?.length ? <InsightsEmptyState /> : <><p className="fi-note">Categorias técnicas, plataformas e versões. Abra uma linha para consultar a duração e a amostra observadas.</p>{data.trend?.length>0 && <InsightsTrendChart rows={data.trend} label="Falhas e operações lentas por dia" />}{data.rows?.length>0 && <InsightsBarChart rows={data.rows} />}</>}</InsightsPanel>
}
