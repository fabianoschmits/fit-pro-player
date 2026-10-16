import { t } from '../lib/i18n.js'
import { EXIDX, exerciseName } from '../lib/exercises.js'
import { fmtDate, fmtDur, fmtNum, workoutDuration } from '../lib/format.js'
import { loadOfWorkouts } from '../lib/muscles.js'
import BodyMap from './BodyMap.jsx'

function maxLoad(entry) {
  return Math.max(0, ...(Array.isArray(entry?.sets) ? entry.sets : []).filter(set => set?.done && Number.isFinite(Number(set.w))).map(set => Number(set.w)))
}

export function buildWorkoutShareSummary(w, st) {
  const entries = Array.isArray(w?.entries) ? w.entries : []
  const exerciseRows = entries.map(entry => {
    const exercise = EXIDX[entry.id]
    return { name: exercise ? exerciseName(exercise) : (entry.n || entry.id || t('Exercise')), equipment: exercise?.eq || entry.eq || '', sets: Array.isArray(entry.sets) ? entry.sets.length : 0, maxWeight: maxLoad(entry) }
  })
  const topLoad = exerciseRows.reduce((best, row) => row.maxWeight > best.weight ? { weight: row.maxWeight, exercise: row.name, equipment: row.equipment } : best, { weight: 0, exercise: '', equipment: '' })
  return { name: w?.name?.trim() || t('Treino'), date: w?.d ? fmtDate(w.d, true) : '', duration: fmtDur(workoutDuration(w)), exercises: entries.length, sets: exerciseRows.reduce((total, row) => total + row.sets, 0), topLoad, topLoadLabel: topLoad.weight > 0 ? `${fmtNum(topLoad.weight)} ${st?.unit || 'kg'}` : t('Peso corporal'), exerciseRows, load: loadOfWorkouts([w]) }
}

function Stat({ value, label, accent = false }) { return <div className={'share-card-stat' + (accent ? ' is-accent' : '')}><span className="share-card-stat-copy"><strong>{value}</strong><small>{label}</small></span></div> }

function PerformanceCard({ w, st, innerRef, themeId }) {
  const summary = buildWorkoutShareSummary(w, st)
  return <div ref={innerRef} className={`workout-story-canvas share-card ${themeId}`}><div className="share-card-backdrop" /><div className="share-card-grain" /><div className="share-card-map"><BodyMap load={summary.load} body={st.body || 'male'} view="front" decorative captureSafe /></div><div className="share-card-content"><header className="share-card-brand"><img src="/brand-logo.svg" alt="Fit Pro Player" /><span>{summary.date}</span></header><section className="share-card-hero"><p className="share-card-kicker"><span /> {t('Treino concluído')}</p><h1>{summary.name}</h1><div className="share-card-time">{summary.duration}</div></section><section className="share-card-stats" aria-label={t('Workout summary')}><Stat value={summary.exercises} label={t('Exercícios')} /><Stat value={summary.sets} label={t('Séries')} /><Stat value={summary.topLoadLabel} label={summary.topLoad.equipment || summary.topLoad.exercise || t('Maior carga')} accent /></section><section className="share-card-exercises"><div className="share-card-section-title"><span>{t('O que você treinou')}</span><b>{summary.exercises}</b></div><div className="share-card-exercise-list">{summary.exerciseRows.map((row, index) => <div className="share-card-exercise" key={`${row.name}-${index}`}><span className="share-card-index">{String(index + 1).padStart(2, '0')}</span><span className="share-card-exercise-name">{row.name}</span><small>{row.equipment || t('Exercício')}</small><strong>{row.maxWeight > 0 ? `${fmtNum(row.maxWeight)} ${st?.unit || 'kg'}` : `${row.sets}×`}</strong></div>)}{!summary.exerciseRows.length && <p className="share-card-empty">{t('Nenhum exercício registrado')}</p>}</div></section><footer className="share-card-footer"><span>{t('Consistência gera resultado')}</span><b>FIT PRO PLAYER</b></footer></div></div>
}

export function LayoutDashboard(props) { return <PerformanceCard {...props} /> }
export function LayoutMinimal(props) { return <PerformanceCard {...props} /> }
export function LayoutReceipt(props) { return <PerformanceCard {...props} /> }
export function LayoutBrutal(props) { return <PerformanceCard {...props} /> }
export function LayoutPolaroid(props) { return <PerformanceCard {...props} /> }
