import InsightsPanel from './InsightsPanel.jsx'
import InsightsBarChart from './InsightsBarChart.jsx'
export default function InsightsFriction(props) {
  return <InsightsPanel {...props} title="Dificuldades mais frequentes" method="getInsightsFriction">{data => <><p className="fi-note">Ordenado por usuários afetados. Taxa entre usuários com exposição observada à funcionalidade. Sem exposição suficiente, a taxa fica indisponível.</p><InsightsBarChart rows={data.rows} /></>}</InsightsPanel>
}
