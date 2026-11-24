import { useState } from 'react'
import { Segmented, Button } from '../../ui.jsx'
import { t } from '../../../lib/i18n.js'
import { weeklyDate, weeklyDuration, weeklyNumber } from '../../../lib/weekly-progress-format.js'

export default function WeeklyActivityChart({ summary, onDay }) {
  const [mode, setMode] = useState(summary.metrics.durationKnownWorkouts ? 'durationSeconds' : 'completedSets')
  const [selected, setSelected] = useState(null)
  const max = Math.max(1, ...summary.days.map(day => day[mode] || 0))
  const day = summary.days.find(item => item.date === selected)
  return <section className="card weekly-section" data-weekly-chart>
    <div className="weekly-section-heading"><h2>{t('Weekly activity')}</h2><span>{t('Active days')}: {weeklyNumber(summary.metrics.activeDays)}</span></div>
    <div role="group" aria-label={t('Activity metric')}><Segmented value={mode} onChange={setMode} options={[{ value: 'durationSeconds', label: t('Time') }, { value: 'completedSets', label: t('Sets') }, { value: 'workouts', label: t('Workouts') }]} /></div>
    <div className="weekly-chart" role="group" aria-label={t('Weekly activity')}>{summary.days.map(item => <button type="button" key={item.date} className={'weekly-day' + (item.isFuture ? ' is-future' : '')} aria-pressed={selected === item.date} disabled={item.isFuture}
      aria-label={`${weeklyDate(item.date)}: ${item.isFuture ? t('Future day') : item.workouts ? `${t('Workouts')}: ${weeklyNumber(item.workouts)}, ${t('Sets')}: ${weeklyNumber(item.completedSets)}, ${weeklyDuration(item.durationSeconds)}` : t('No workout recorded')}`} onClick={() => setSelected(item.date)}>
      <span className="weekly-day-value">{item.isFuture ? '—' : mode === 'durationSeconds' ? item.durationSeconds == null ? '—' : weeklyNumber(Math.round(item.durationSeconds / 60)) : weeklyNumber(item[mode])}</span>
      <span className="weekly-day-track"><i style={{ height: `${item.isFuture ? 0 : Math.max(0, (item[mode] || 0) / max * 100)}%` }} /></span>
      <span>{weeklyDate(item.date, { weekday: 'short', day: undefined, month: undefined })}</span>
    </button>)}</div>
    {day && <div className="weekly-day-detail" aria-live="polite"><strong>{weeklyDate(day.date)}</strong><p>{t('Workouts')}: {weeklyNumber(day.workouts)} · {t('Sets')}: {weeklyNumber(day.completedSets)} · {weeklyDuration(day.durationSeconds)}</p>{day.workouts ? <Button variant="ghost" size="sm" onClick={() => onDay(day.date)}>{t("See this day's workouts")}</Button> : <p>{t('No workout recorded')}</p>}</div>}
  </section>
}
