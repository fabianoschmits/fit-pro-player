import { useMemo, useState } from 'react'
import { t } from '../../../lib/i18n.js'
import { buildWeeklyCheckinSummary, checkinReasonLabel } from '../../../lib/training-checkin.js'
import '../../../training-checkin.css'
export default function WeeklyCheckinSummary({ workouts, partial = false }) {
 const summary = useMemo(() => buildWeeklyCheckinSummary(workouts), [workouts]), [expanded, setExpanded] = useState(false)
 if (!summary.answeredWorkouts) return null
 const number = value => new Intl.NumberFormat().format(value)
 return <section className="training-checkin-summary" data-weekly-checkin><h2>{t('Your training context')}</h2><p>{t(summary.answeredWorkouts === 1 ? 'Context recorded for {0} workout.' : 'Context recorded for {0} workouts.', number(summary.answeredWorkouts))}</p>
  {partial && <p className="small dim">{t('Based on the records available.')}</p>}
  <div>{(expanded ? summary.reasons : summary.reasons.slice(0, 3)).map(item => <div key={item.reason} className="training-checkin-reason-count"><span>{t(checkinReasonLabel(item.reason))}</span><strong>{number(item.count)}</strong></div>)}</div>
  {!expanded && summary.reasons.length > 3 && <button type="button" className="training-checkin-text-action" onClick={() => setExpanded(true)}>{t('More reasons')}</button>}
 </section>
}
