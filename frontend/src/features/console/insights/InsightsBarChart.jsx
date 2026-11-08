import { motion, useReducedMotion } from 'framer-motion'
import InsightsEmptyState from './InsightsEmptyState.jsx'
import { metricValue } from './InsightsKpis.jsx'
import { insightLabel } from './insights-labels.js'
export default function InsightsBarChart({ rows = [], percentage = true }) {
  const reduced = useReducedMotion()
  const total = rows.reduce((sum, r) => sum + Number(r.count || 0), 0)
  if (!rows.length) return <InsightsEmptyState />
  return <div className="fi-bars">{rows.map((row, index) => {
    const rate = Object.hasOwn(row,'rate') && row.rate == null ? null : Math.min(100, Math.max(0, Number(row.rate ?? (total ? row.count / total * 100 : 0))))
    return <details key={`${row.label}-${index}`} className="fi-bar"><summary><span>{insightLabel(row.label)}</span><strong>{metricValue(percentage ? rate : row.count, percentage ? '%' : '')}</strong><span className="fi-track"><motion.i initial={reduced ? false : { width: 0 }} animate={{ width: `${rate ?? 0}%` }} transition={{ duration: reduced ? 0 : 0.2 }} /></span></summary><div className="fi-detail">{row.count} ocorrências{row.users != null && ` · ${row.users} usuários afetados`}{row.platform && ` · ${row.platform}`}{row.app_version && ` · v${row.app_version}`}{row.error_category && <p>Categoria observada: {row.error_category}. A causa depende de investigação.</p>}{row.previous_users != null && <p>Período anterior: {row.previous_users} usuários afetados.</p>}{row.duration_ms != null && <p>Duração média: {metricValue(row.duration_ms, ' ms')}</p>}</div></details>
  })}</div>
}
