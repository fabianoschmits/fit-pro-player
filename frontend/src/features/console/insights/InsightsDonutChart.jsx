import InsightsEmptyState from './InsightsEmptyState.jsx'
export default function InsightsDonutChart({ rows = [] }) {
  const total = rows.reduce((s, r) => s + Number(r.count || 0), 0)
  if (!total) return <InsightsEmptyState />
  let position = 0
  return <figure className="fi-donut"><svg viewBox="0 0 120 120" role="img" aria-label="Distribuição por plataforma">{rows.map((r, i) => {
    const size = r.count / total * 100, offset = position; position += size
    return <circle key={r.label} cx="60" cy="60" r="45" pathLength="100" fill="none" stroke={['var(--fi-accent)', '#7bafb0', '#73737c'][i % 3]} strokeWidth="12" strokeDasharray={`${size} ${100 - size}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />
  })}</svg><figcaption>{rows.map(r => <p key={r.label}>{r.label}: {r.count} ({Math.round(r.count / total * 100)}%)</p>)}</figcaption></figure>
}
