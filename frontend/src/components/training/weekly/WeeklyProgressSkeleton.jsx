import { t } from '../../../lib/i18n.js'
export default function WeeklyProgressSkeleton() {
  return <div className="weekly-skeleton" aria-busy="true" aria-label={t('Weekly summary')}><div className="card" /><div className="weekly-metrics">{[0, 1, 2, 3].map(key => <div className="card" key={key} />)}</div><div className="card" /></div>
}
