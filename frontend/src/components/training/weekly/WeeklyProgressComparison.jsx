import { t } from '../../../lib/i18n.js'
import { weeklyDelta, weeklyNumber, weeklyDuration } from '../../../lib/weekly-progress-format.js'
export default function WeeklyProgressComparison({ summary }) {
  if (summary.canComparePeriods === false) return <section className="card weekly-section" data-weekly-comparison><h2>{t('Compared with last week')}</h2><p>{t('Comparison not available yet.')}</p></section>
  return <section className="card weekly-section" data-weekly-comparison><h2>{t('Compared with last week')}</h2>
    <p>{t(summary.period.isCurrentWeek ? 'Compared with the same period last week.' : 'Compared with the previous week.')}</p>
    {summary.period.isCurrentWeek && <p className="dim">{t('Today is still in progress.')}</p>}
    <dl className="weekly-comparison-list">{[['workouts', 'Workouts'], ['completedSets', 'Sets'], ['durationSeconds', 'Recorded time']].map(([key, label]) => <div key={key}><dt>{t(label)}</dt><dd><span>{key === 'durationSeconds' ? weeklyDuration(summary.previousMetrics[key]) : weeklyNumber(summary.previousMetrics[key])} → {key === 'durationSeconds' ? weeklyDuration(summary.metrics[key]) : weeklyNumber(summary.metrics[key])}</span><strong>{weeklyDelta(summary.deltas[key], key === 'durationSeconds')}</strong></dd></div>)}</dl>
  </section>
}
