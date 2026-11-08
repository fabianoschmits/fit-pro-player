export const metricValue = (value, suffix = '') => value == null ? '—' : `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${suffix}`
export default function InsightsKpis({ items }) {
  return <div className="fi-kpis">{items.map(item => <button type="button" className="fi-kpi" key={item.label} onClick={item.onClick} disabled={!item.onClick}><strong>{metricValue(item.value, item.suffix)}</strong><span>{item.label}</span><small>{item.previous == null ? 'Sem comparação elegível' : `Anterior: ${metricValue(item.previous)} · ${item.value > item.previous ? '↑' : item.value < item.previous ? '↓' : 'Estável'}`}</small></button>)}</div>
}
