import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../ui.jsx'
import { exOr, exerciseName } from '../../../lib/exercises.js'
import { toDisplayMass } from '../../../lib/mass.js'
import { weeklyNumber } from '../../../lib/weekly-progress-format.js'
import { t } from '../../../lib/i18n.js'
const LABELS = { record: 'Recorded personal best', load: 'Higher recorded load', reps: 'More repetitions at the same load', first: 'First entry', available: 'Best available entry' }
export default function WeeklyPerformanceSummary({ performance, displayUnit = 'kg', exerciseCatalog = undefined }) {
  const [limit, setLimit] = useState(3), navigate = useNavigate()
  const records = performance.personalRecords || []
  const recorded = new Set(records.map(item => item.exerciseId))
  const highlights = [...records, ...performance.improvements.filter(item => !recorded.has(item.exerciseId))]
  const exercise = id => exerciseCatalog ? exerciseCatalog.get(id) || { id, n: t('Unknown exercise'), custom: true } : exOr(id)
  const value = (item, amount) => amount == null ? '—' : item.unit === 'reps' ? `${weeklyNumber(amount)} ${t('Reps')}` : `${weeklyNumber(toDisplayMass(amount, displayUnit))} ${displayUnit}`
  return <section className="card weekly-section" data-weekly-performance><h2>{t('Weekly highlights')}</h2>
    {highlights.length ? <><ul className="weekly-performance-list">{highlights.slice(0, limit).map(item => <li key={`${item.exerciseId}:${item.type}`}><strong>{exerciseName(exercise(item.exerciseId))}</strong><span>{t(LABELS[item.type])}</span><b>{item.previous == null ? value(item, item.current) : `${value(item, item.previous)} → ${value(item, item.current)}`}</b>{item.type === 'reps' && <small>{t('Recorded load')}: {weeklyNumber(toDisplayMass(item.load, displayUnit))} {displayUnit}</small>}<Button variant="ghost" size="sm" onClick={() => navigate(`/progress?exercise=${encodeURIComponent(item.exerciseId)}`)}>{t('Exercise progress')}</Button></li>)}</ul>{highlights.length > limit && <Button variant="ghost" onClick={() => setLimit(value => value + 3)}>{t('Show more highlights')}</Button>}</> : <p>{t('No comparable performance highlights in this period.')}</p>}
  </section>
}
