import { t } from '../lib/i18n.js'

/** Step indicator for the 3-step plan setup flow. */
export default function PlanProgress({ progress }) {
  if (!progress) return null
  const { step, total, label } = progress
  const pct = Math.round((step / total) * 100)
  return (
    <div className="plan-progress card" role="status">
      <div className="row between" style={{ marginBottom: 8 }}>
        <span className="small muted">{t('Step {0} of {1}', step, total)}</span>
        <span className="small" style={{ fontWeight: 600, color: 'var(--acc)' }}>{label}</span>
      </div>
      <div className="plan-progress-bar" aria-hidden="true">
        <i style={{ width: pct + '%' }} />
      </div>
    </div>
  )
}
