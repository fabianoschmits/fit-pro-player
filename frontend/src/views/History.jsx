import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t, dateLocale } from '../lib/i18n.js'
import { WorkoutRow, workoutDetailSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'

export default function History() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const groups = [...S.workouts].reverse().reduce((result, workout) => {
    const key = String(workout.d || '').slice(0, 7) || 'unknown'
    if (!result.has(key)) result.set(key, [])
    result.get(key).push(workout)
    return result
  }, new Map())
  return <div className="history-view">
    <div className="hdr history-titlebar"><button className="iconbtn" onClick={() => nav('/more')} aria-label={t('More')}><Icon name="chevronLeft" /></button>
      <div className="history-title-copy"><h1>{t('History')}</h1><div className="sub">{t('{0} workouts', S.workouts.length)}</div></div></div>
    {S.workouts.length ? <div className="history-groups">{[...groups].map(([month, workouts]) => {
      const date = new Date(`${month}-01T12:00:00`)
      const label = Number.isNaN(date.getTime()) ? month : date.toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' })
      return <section className="history-month" key={month}>
        <div className="history-month-heading"><h2>{label}</h2><span>{workouts.length}</span></div>
        <div className="list history-list">{workouts.map(workout => <WorkoutRow key={workout.id} w={workout} onClick={() => workoutDetailSheet(workout)} />)}</div>
      </section>
    })}</div>
      : <div className="empty"><div className="ico"><Icon name="history" /></div>{t('No workouts yet.')}</div>}
  </div>
}
