import Icon from '../../Icon.jsx'
import { t } from '../../../lib/i18n.js'
import { weeklyDuration, weeklyNumber, weeklyDelta } from '../../../lib/weekly-progress-format.js'
export default function WeeklyProgressMetrics({ summary }) {
  const { metrics, deltas, coverage } = summary
  const items = [
    ['workouts', 'Completed workouts', 'dumbbell', weeklyNumber(metrics.workouts)],
    ['durationSeconds', coverage.unknownDurationWorkouts ? 'Recorded time' : 'Time trained', 'clock', weeklyDuration(metrics.durationSeconds)],
    ['completedSets', 'Completed sets', 'check', weeklyNumber(metrics.completedSets)],
    ['muscleGroupsWorked', 'Muscle groups worked', 'person', `${weeklyNumber(metrics.muscleGroupsWorked)}/18`],
  ]
  return <section className="weekly-metrics" aria-label={t('Weekly metrics')}>{items.map(([key, label, icon, value]) => <div className="card weekly-metric" key={key} data-weekly-metric={key}>
    <span><Icon name={icon} />{t(label)}</span><strong>{value}</strong>
    <small>{key === 'muscleGroupsWorked' ? t('Recorded activity') : weeklyDelta(deltas[key], key === 'durationSeconds')}</small>
  </div>)}</section>
}
