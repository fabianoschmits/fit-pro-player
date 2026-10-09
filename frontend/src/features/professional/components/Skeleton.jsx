import { t } from '../../../lib/i18n.js'
/** Static geometry only. Consumers keep their last successful data on refresh. */
export default function Skeleton({ variant = 'rows', count = 3, label = t('Loading…') }) {
  return <div className={`professional-skeleton professional-skeleton-${variant}`} role="status" aria-label={label} aria-busy="true">
    <div aria-hidden="true">{Array.from({ length: variant === 'detail' ? 1 : count }, (_, index) => <div className="professional-skeleton-item" key={index}>
      {variant !== 'summary' && <span className="professional-skeleton-avatar" />}
      <span className="professional-skeleton-copy"><span /><span /></span>
    </div>)}</div>
  </div>
}
