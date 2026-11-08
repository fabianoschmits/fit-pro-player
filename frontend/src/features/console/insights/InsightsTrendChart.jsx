import { useState } from 'react'
import InsightsEmptyState from './InsightsEmptyState.jsx'
export default function InsightsTrendChart({ rows = [], label = 'Atividade por dia' }) {
  const [selected, setSelected] = useState(null)
  if (!rows.length) return <InsightsEmptyState />
  const maximum = Math.max(1, ...rows.map(r => Number(r.count || 0)))
  const point = (r, i) => [20 + i * 560 / Math.max(1, rows.length - 1), 140 - Number(r.count || 0) / maximum * 110]
  return <figure className="fi-trend"><svg viewBox="0 0 600 170" role="img" aria-label={label}><path d={rows.map((r, i) => i ? `C${(point(rows[i-1],i-1)[0]+point(r,i)[0])/2},${point(rows[i-1],i-1)[1]} ${(point(rows[i-1],i-1)[0]+point(r,i)[0])/2},${point(r,i)[1]} ${point(r,i).join(',')}` : `M${point(r,i).join(',')}`).join(' ')} fill="none" stroke="var(--fi-accent)" strokeWidth="3" />{rows.map((r, i) => <circle key={r.label} cx={point(r, i)[0]} cy={point(r, i)[1]} r={selected === i ? 8 : 5} fill="var(--fi-accent)"><title>{r.label}: {r.count}</title></circle>)}</svg><figcaption>{label}</figcaption><div className="fi-points">{rows.map((r, i) => <button key={r.label} aria-pressed={selected === i} onClick={() => setSelected(i)}>{r.label}<strong>{r.count}</strong></button>)}</div></figure>
}
