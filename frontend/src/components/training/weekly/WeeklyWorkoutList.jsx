import { Button } from '../../ui.jsx'
import { weeklyDate, weeklyDuration, weeklyNumber } from '../../../lib/weekly-progress-format.js'
import { t } from '../../../lib/i18n.js'
export default function WeeklyWorkoutList({ workouts, selectedDay, onClearDay, onWorkout, onMap }) {
  const visible = selectedDay ? workouts.filter(workout => workout.date === selectedDay) : workouts
  const groups = new Map()
  visible.forEach(workout => { if (!groups.has(workout.date)) groups.set(workout.date, []); groups.get(workout.date).push(workout) })
  return <section className="weekly-workouts" id="weekly-workouts" data-weekly-workouts><div className="weekly-section-heading"><h2>{t('Workouts this week')}</h2>{selectedDay && <Button variant="ghost" size="sm" onClick={onClearDay}>{t('All days')}</Button>}</div>
    {[...groups].map(([date, sessions]) => <section key={date} aria-label={weeklyDate(date)}><h3><time dateTime={date}>{weeklyDate(date, { weekday: 'long' })}</time></h3>{sessions.map(workout => <article key={workout.id} className="card weekly-workout"><button type="button" className="weekly-workout-main" onClick={() => onWorkout(workout.id)}><strong>{workout.name}</strong><span>{weeklyDuration(workout.metrics.durationSeconds)} · {t('Exercises')}: {weeklyNumber(workout.metrics.exerciseOccurrences)} · {t('Sets')}: {weeklyNumber(workout.metrics.completedSets)}</span>{workout.origin === 'professional' && <small>{t('Professional plan')}</small>}</button><Button variant="ghost" size="sm" onClick={() => onMap(workout.id)}>{t('Mapa do treino')}</Button></article>)}</section>)}
  </section>
}
