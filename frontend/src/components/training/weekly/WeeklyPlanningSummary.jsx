import { t } from '../../../lib/i18n.js'
import { weeklyNumber } from '../../../lib/weekly-progress-format.js'
export default function WeeklyPlanningSummary({ planning }) {
  const max = Math.max(1, planning.originalSets || 0, planning.adjustedSets || 0, planning.actualSets || 0)
  return <section className="card weekly-section" data-weekly-planning><h2>{t('Your plan in practice')}</h2>
    {planning.eligibleWorkouts ? <>
      <p>{planning.totalWorkouts === 1 ? t('Comparison is available for this workout.') : t('Comparison available in {0} of {1} workouts.', weeklyNumber(planning.eligibleWorkouts), weeklyNumber(planning.totalWorkouts))}</p>
      <dl className="weekly-planning-bars">{[['originalSets', 'Original plan'], ['adjustedSets', 'After adjustments'], ['actualSets', 'Realizado']].map(([key, label]) => <div key={key}><dt>{t(label)} <strong>{weeklyNumber(planning[key])}</strong></dt><dd><span style={{ width: `${planning[key] / max * 100}%` }} /></dd></div>)}</dl>
      <p>{t('Original set completion')}: {weeklyNumber(planning.originalCompletion)}% · {t('Adjusted set completion')}: {weeklyNumber(planning.adjustedCompletion)}%</p>
      {planning.flexWorkouts > 0 && <p>{t('Your workouts were adjusted to your chosen duration.')}</p>}
    </> : <><p>{t('Workouts this week have no historical planning recorded.')}</p><p>{t('New workouts will include this information automatically.')}</p></>}
  </section>
}
