import { useEffect, useState } from 'react'
import BodyMap, { BodyMapLegend } from '../../BodyMap.jsx'
import { Button, Segmented } from '../../ui.jsx'
import { t } from '../../../lib/i18n.js'
import { MUSCLES, MUSCLE_NAME } from '../../../lib/muscles.js'
import { exOr, exerciseName } from '../../../lib/exercises.js'
import { weeklyNumber } from '../../../lib/weekly-progress-format.js'
export default function WeeklyMuscleSummary({ muscles, body, workouts, onWorkout }) {
  const [view, setView] = useState('front'), [selected, setSelected] = useState(null)
  const [wide, setWide] = useState(() => window.matchMedia('(min-width:900px)').matches)
  useEffect(() => { const query = window.matchMedia('(min-width:900px)'); const changed = () => setWide(query.matches); query.addEventListener('change', changed); return () => query.removeEventListener('change', changed) }, [])
  const muscle = MUSCLES.includes(selected) ? muscles.ranking.find(item => item.id === selected) || { id: selected, load: muscles.actualLoad[selected] || 0, directSets: muscles.directSets[selected] ?? null, exerciseIds: [], workoutIds: [] } : null
  return <section className="card weekly-section" data-weekly-muscles><h2>{t('Weekly muscle map')}</h2><p>{t('Distribution of muscular activity this week.')}</p>
    {!wide && <div role="group" aria-label={t('Vista do corpo')}><Segmented value={view} onChange={setView} options={[{ value: 'front', label: t('Frente') }, { value: 'back', label: t('Costas') }]} /></div>}
    <BodyMap className="weekly-bodymap" view={wide ? 'both' : view} load={muscles.actualLoad} thresholds={muscles.thresholds} body={body} selected={selected} onMuscle={setSelected} />
    <BodyMapLegend /><p className="weekly-caption">{t('Weighted sets estimate muscle participation; they are not literal sets.')}</p>
    {muscles.unknownMuscleSets > 0 && <p>{t('Muscle metadata is unavailable for {0} completed sets.', weeklyNumber(muscles.unknownMuscleSets))}</p>}
    {muscles.estimatedMuscleSets > 0 && <p className="weekly-caption">{t('Some historical records have partial information. Available data is shown.')}</p>}
    <label className="weekly-muscle-picker"><span>{t('Show muscles')}</span><select aria-label={t('Show muscles')} value={selected || ''} onChange={event => setSelected(event.target.value)}><option value="" disabled>{t('Show muscles')}</option>{MUSCLES.map(id => <option key={id} value={id}>{t(MUSCLE_NAME[id])}</option>)}</select></label>
    <div className="weekly-muscle-ranking" role="group" aria-label={t('Muscle ranking')}>{muscles.ranking.map(item => <button type="button" key={item.id} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}><span>{t(MUSCLE_NAME[item.id])}</span><strong>{weeklyNumber(item.load)}</strong><span className="weekly-rank-track"><i style={{ width: `${item.load / Math.max(1, muscles.ranking[0].load) * 100}%` }} /></span></button>)}</div>
    {muscle && <div className="weekly-muscle-detail" aria-live="polite"><h3>{t(MUSCLE_NAME[muscle.id])}</h3><p>{t('Weighted sets')}: {weeklyNumber(muscle.load)} · {t('Direct sets')}: {muscle.directSets === null ? t('Not recorded') : weeklyNumber(muscle.directSets)}</p><p>{t('Related exercises')}: {muscle.exerciseIds.length ? muscle.exerciseIds.map(id => exerciseName(exOr(id))).join(', ') : t('No data yet')}</p><div className="weekly-inline-actions">{muscle.workoutIds.map(id => <Button key={id} variant="ghost" size="sm" onClick={() => onWorkout(id)}>{workouts.find(workout => workout.id === id)?.name || t('Open workout')}</Button>)}</div></div>}
  </section>
}
