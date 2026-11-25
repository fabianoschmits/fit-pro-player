import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../../../store/useStore.js'
import { buildWeeklyPreview } from '../../../lib/weekly-progress-core.js'
import { useWeeklyClock } from '../../../lib/use-weekly-clock.js'
import { useWeeklyHistory } from '../../../lib/use-weekly-history.js'
import { weeklyDate, weeklyDuration, weeklyNumber, weeklyDelta } from '../../../lib/weekly-progress-format.js'
import { t } from '../../../lib/i18n.js'
import Icon from '../../Icon.jsx'
import '../../../weekly-progress.css'

export default function WeeklyProgressPreview({ compact = false }) {
  const zone = useStore(state => state.S.profile?.timeZone || state.S.reminder?.tz)
  const { now, timeZone, online } = useWeeklyClock(zone)
  const { workouts, availability } = useWeeklyHistory(online)
  const canComparePeriods = availability.canComparePeriods
  const summary = useMemo(() => buildWeeklyPreview({ workouts, now, timeZone, canComparePeriods }), [workouts, now, timeZone, canComparePeriods])
  if (availability.status === 'loading') return <div className="card weekly-preview weekly-preview-loading" aria-busy="true" aria-label={t('Weekly summary')} />
  return <Link to="/progress/weekly" state={{ weeklyBackTo: compact ? '/home' : '/progress' }} className={'card weekly-preview' + (compact ? ' is-compact' : '')} data-weekly-preview={compact ? 'home' : 'progress'}>
    <div className="weekly-preview-head"><h2>{t(compact ? 'Your week' : 'Weekly summary')}</h2><Icon name="chevronRight" /></div>
    {availability.updating && <p>{t('Updating your history…')}</p>}
    {!availability.historyComplete && <p>{t(availability.unavailable ? 'Your history is not available on this device yet.' : 'History partially available.')}</p>}
    {!compact && <p>{weeklyDate(summary.period.start)} – {weeklyDate(summary.days[6].date)}</p>}
    {summary.metrics.workouts ? <>
      <div className="weekly-preview-values"><span><b>{weeklyNumber(summary.metrics.workouts)}</b> {t('Workouts')}</span><span><b>{weeklyNumber(compact ? summary.metrics.activeDays : summary.metrics.completedSets)}</b> {t(compact ? 'Active days' : 'Sets')}</span><span>{weeklyDuration(summary.metrics.durationSeconds)}</span></div>
      {!compact && <p>{canComparePeriods ? <>{t('Compared with the same period last week.')} {weeklyDelta(summary.deltas.workouts)} {t('Workouts')}</> : t('Comparison not available yet.')}</p>}
    </> : availability.canShowEmpty ? <div className="weekly-preview-empty"><strong>{t('A new week to progress.')}</strong><p>{t('Your summary updates as you complete workouts.')}</p></div> : null}
    {(availability.hasLocalHistory || availability.canShowEmpty) && <div className="weekly-preview-days" aria-label={t('Weekly activity')}>{summary.days.map(day => <span key={day.date} className={(day.workouts ? ' is-active' : '') + (day.isFuture ? ' is-future' : '')} aria-label={`${weeklyDate(day.date)}: ${day.isFuture ? t('Future day') : weeklyNumber(day.workouts) + ' ' + t('Workouts')}`}>{weeklyDate(day.date, { weekday: 'narrow', day: undefined, month: undefined })}</span>)}</div>}
    <span className="weekly-preview-link">{t(compact ? 'View weekly summary' : 'View full summary')}</span>
  </Link>
}
