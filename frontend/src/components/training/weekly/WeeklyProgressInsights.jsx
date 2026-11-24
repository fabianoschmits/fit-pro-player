import { t } from '../../../lib/i18n.js'
import { MUSCLE_NAME } from '../../../lib/muscles.js'
import { weeklyNumber } from '../../../lib/weekly-progress-format.js'
export function weeklyInsightText(item) {
  const [count, difference] = item.args
  switch (item.key) {
    case 'weekly.empty.current': return t('Your summary updates as you complete workouts.')
    case 'weekly.empty.past': return t('No completed workout was recorded in this period.')
    case 'weekly.records': return t(count === 1 ? 'You recorded one new personal best this week.' : 'You recorded {0} new personal bests this week.', weeklyNumber(count))
    case 'weekly.first': return t(count === 1 ? 'You made your first entry for an exercise.' : 'You made first entries for {0} exercises.', weeklyNumber(count))
    case 'weekly.firstWeek': return t('You completed your first workouts recorded in FPP.')
    case 'weekly.frequency.same': return t(count === 1 ? 'You maintained one recorded workout compared with the previous period.' : 'You maintained {0} recorded workouts compared with the previous period.', weeklyNumber(count))
    case 'weekly.frequency.up':
    case 'weekly.frequency.down': return t('Recorded workouts: {0}. Difference from the previous comparable period: {1}.', weeklyNumber(count), `${item.key.endsWith('up') ? '+' : '−'}${weeklyNumber(difference)}`)
    case 'weekly.time.up': return t('Your recorded training time increased by {0} min.', weeklyNumber(count))
    case 'weekly.muscles': return t('Highest recorded muscular activity: {0}.', item.args.map(id => t(MUSCLE_NAME[id])).join(', '))
    case 'weekly.flex': return t('Your workouts were adjusted to your chosen duration; the original plan remains available.')
    case 'weekly.coverage': return t('Some historical records have partial information. Available data is shown.')
    default: return ''
  }
}
export default function WeeklyProgressInsights({ insights }) {
  return <section className="weekly-insights" aria-label={t('Weekly insights')}><h2>{t('Weekly insights')}</h2><ul>{insights.map(item => <li key={item.key}>{weeklyInsightText(item)}</li>)}</ul></section>
}
