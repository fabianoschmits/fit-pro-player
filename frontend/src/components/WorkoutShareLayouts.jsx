import { useEffect, useState } from 'react'
import { t } from '../lib/i18n.js'
import { exerciseGuideAsset } from '../lib/exercise-guide-assets.js'
import { EXIDX, exerciseName } from '../lib/exercises.js'
import { fmtDate, fmtDur, fmtNum, workoutDuration } from '../lib/format.js'
import { toDisplayMass } from '../lib/mass.js'
import { loadOfWorkouts, rankOf, MUSCLE_NAME } from '../lib/muscles.js'
import BodyMap from './BodyMap.jsx'
import Icon from './Icon.jsx'
import '../workout-share-compact.css'

const SHARE_FRAME_LOADERS = import.meta.glob('../assets/exercise-sprites/*/frames.js', { import: 'default' })

export function selectShareExerciseFrame(frames) {
  return Array.isArray(frames) && frames.length > 1 ? frames[Math.min(3, frames.length - 1)] : null
}

function ExerciseHighlight({ row, unit }) {
  const [asset, setAsset] = useState(null)
  const slug = exerciseGuideAsset(row)?.slug
  useEffect(() => {
    let alive = true
    setAsset(null)
    const loader = SHARE_FRAME_LOADERS[`../assets/exercise-sprites/${slug}/frames.js`]
    Promise.resolve(loader?.()).then(frames => {
      if (alive) setAsset({ slug, source: selectShareExerciseFrame(frames) })
    }).catch(() => { if (alive) setAsset({ slug, source: null }) })
    return () => { alive = false }
  }, [slug])
  const ready = asset?.slug === slug
  return (
    <section className="share-exercise-highlight" data-share-loading={!ready ? 'true' : undefined}>
      <div className="share-highlight-copy">
        <span className="share-highlight-label">{t('Destaque do treino')}</span>
        <h2>{row.name}</h2>
        <strong>{row.maxWeight > 0 ? `${fmtNum(toDisplayMass(row.maxWeight, unit))} ${unit}` : t('Peso corporal')}</strong>
        <p>{row.completedSets} {t('séries')} · {row.reps} {t('repetições')}</p>
      </div>
      {ready && asset.source && <img className="share-highlight-sprite" src={asset.source} alt={row.name} data-exercise-id={row.id} />}
    </section>
  )
}

export const WORKOUT_SHARE_LAYOUTS = [
  { id: 'premium', name: 'Premium' },
  { id: 'minimal', name: 'Minimal' },
  { id: 'editorial', name: 'Editorial' },
  { id: 'neon', name: 'Atlas' },
  { id: 'brutal', name: 'Blocos' },
  { id: 'receipt', name: 'Sessão' },
  { id: 'polaroid', name: 'Moldura' },
  { id: 'split', name: 'Colunas' },
  { id: 'medal', name: 'Foco' },
  { id: 'luxury', name: 'Linhas' },
  { id: 'poster', name: 'Impacto' },
]

function maxLoad(entry) {
  return Math.max(0, ...(Array.isArray(entry?.sets) ? entry.sets : []).filter(set => set?.done && Number.isFinite(Number(set.w))).map(set => Number(set.w)))
}

function sumVolume(entries) {
  return entries.reduce((acc, entry) => {
    const sets = Array.isArray(entry?.sets) ? entry.sets : []
    const entryVol = sets.reduce((sAcc, s) => {
      if (s?.done && Number.isFinite(Number(s.w)) && Number(s.w) > 0 && Number.isFinite(Number(s.r))) {
        return sAcc + Number(s.w) * Number(s.r)
      }
      return sAcc
    }, 0)
    return acc + entryVol
  }, 0)
}

export function buildWorkoutShareSummary(w, st) {
  const entries = Array.isArray(w?.entries) ? w.entries : []
  const exerciseRows = entries.map(entry => {
    const exercise = EXIDX[entry.id]
    return {
      id: entry.id,
      name: exercise ? exerciseName(exercise) : (entry.n || entry.id || t('Exercise')),
      equipment: exercise?.eq || entry.eq || 'body weight',
      sets: Array.isArray(entry.sets) ? entry.sets.length : 0,
      maxWeight: maxLoad(entry),
      completedSets: (entry.sets || []).filter(set => set?.done).length,
      reps: (entry.sets || []).filter(set => set?.done).reduce((total, set) => total + Math.max(0, Number(set.r) || 0), 0),
    }
  })
  const topLoad = exerciseRows.reduce((best, row) => row.maxWeight > best.weight ? { weight: row.maxWeight, exercise: row.name, equipment: row.equipment } : best, { weight: 0, exercise: '', equipment: '' })
  const displayUnit = st?.displayUnit || 'kg'
  const load = loadOfWorkouts([w])
  const { worked } = rankOf(load)
  const muscleTags = worked.map(m => t(MUSCLE_NAME[m])).filter(Boolean)
  const totalVolume = sumVolume(entries)
  const totalWeight = topLoad.weight > 0 ? topLoad.weight : totalVolume
  const highlight = exerciseRows.filter(row => row.completedSets > 0 && exerciseGuideAsset(row))
    .reduce((best, row) => !best || row.maxWeight > best.maxWeight ? row : best, null)

  return {
    name: w?.name?.trim() || t('Treino'),
    date: w?.d ? fmtDate(w.d, true) : '',
    duration: fmtDur(workoutDuration(w)),
    exercises: entries.length,
    sets: exerciseRows.reduce((total, row) => total + row.sets, 0),
    topLoad,
    topLoadLabel: topLoad.weight > 0 ? `${fmtNum(toDisplayMass(topLoad.weight, displayUnit))} ${displayUnit}` : t('Peso corporal'),
    totalWeight,
    displayUnit,
    exerciseRows,
    highlight,
    load,
    muscleTags,
  }
}

function formatWorkoutTitle(name) {
  const parts = (name || '').trim().split(' ')
  if (parts.length > 1) {
    const last = parts.pop()
    return (
      <>
        {parts.join(' ')} <span className="share-hero-accent">{last}</span>
      </>
    )
  }
  return name
}

function PerformanceCard({ w, st, innerRef, themeId, layoutId = 'premium' }) {
  const summary = buildWorkoutShareSummary(w, st)
  const tagsToShow = summary.muscleTags.slice(0, 3)

  return (
    <div ref={innerRef} className={`workout-story-canvas share-card share-compact share-layout-${layoutId} ${summary.highlight ? 'has-highlight' : ''} ${themeId || ''}`}>
      <div className="share-card-backdrop" />
      <div className="share-card-grain" />

      <div className="share-card-content">
        {/* Header: Logo and Date */}
        <header className="share-card-brand">
          <div className="share-card-logo-wrap">
            <img src="/brand-logo.png" alt="Fit Pro Player" className="share-card-logo" />
          </div>
          <div className="share-card-date-col">
            <span className="share-card-date">{summary.date}</span>
            <span className="share-card-date-bar" />
          </div>
        </header>

        {/* Hero Section */}
        <section className="share-card-hero">
          <div className="share-card-badge">
            <span className="share-card-badge-icon">
              <Icon name="check" />
            </span>
            <span>{t('Treino concluído')}</span>
          </div>

          <h1 className="share-card-title">{formatWorkoutTitle(summary.name)}</h1>

          {tagsToShow.length > 0 && (
            <p className="share-card-subtags">
              {tagsToShow.map((m, i) => (
                <span key={m}>
                  {m.toUpperCase()}
                  {i < tagsToShow.length - 1 && <span className="share-card-subtag-dot">•</span>}
                </span>
              ))}
            </p>
          )}
        </section>

        {/* 4 Stats Cards */}
        <section className="share-card-stats" aria-label={t('Workout summary')}>
          <div className="share-stat-box">
            <div className="share-stat-icon"><Icon name="clock" /></div>
            <strong className="share-stat-value">{summary.duration}</strong>
            <small className="share-stat-label">{t('DURAÇÃO')}</small>
          </div>
          <div className="share-stat-box">
            <div className="share-stat-icon"><Icon name="dumbbell" /></div>
            <strong className="share-stat-value">{summary.exercises}</strong>
            <small className="share-stat-label">{t('EXERCÍCIOS')}</small>
          </div>
          <div className="share-stat-box">
            <div className="share-stat-icon"><Icon name="list" /></div>
            <strong className="share-stat-value">{summary.sets}</strong>
            <small className="share-stat-label">{t('SÉRIES')}</small>
          </div>
          <div className="share-stat-box">
            <div className="share-stat-icon"><Icon name="plate" /></div>
            <strong className="share-stat-value">
              {summary.topLoad.weight > 0 ? `${fmtNum(toDisplayMass(summary.topLoad.weight, summary.displayUnit))} ${summary.displayUnit}` : '—'}
            </strong>
            <small className="share-stat-label">{t('MAIOR CARGA')}</small>
          </div>
        </section>

        {/* Músculos Trabalhados Card */}
        <section className="share-card-muscles-panel">
          <div className="share-muscles-info">
            <h2>{t('Músculos trabalhados')}</h2>
            <p>{t('Mais força para um corpo mais completo.')}</p>
            <div className="share-muscles-chips">
              {(tagsToShow.length ? tagsToShow : ['Peito', 'Bíceps', 'Costas']).map(tag => (
                <span key={tag} className="share-muscle-chip">{tag}</span>
              ))}
            </div>
          </div>
          <div className="share-muscles-map-wrapper">
            <div className="share-card-map">
              <BodyMap
                load={summary.load}
                body={st.body || 'male'}
                view="both"
                decorative
                captureSafe
              />
            </div>
          </div>
        </section>

        {/* O que você treinou Card */}
        <section className="share-card-exercises">
          <div className="share-exercises-title">
            <span>{t('O que você treinou')}</span>
          </div>

          <div className="share-card-exercise-list">
            {summary.exerciseRows.slice(0, 5).map((row, index) => (
              <div className="share-card-exercise" key={`${row.name}-${index}`}>
                <span className="share-card-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="share-card-exercise-name">{row.name}</span>
                <span className="share-card-exercise-eq">{row.equipment || 'body weight'}</span>
                <strong className="share-card-exercise-load">
                  {row.maxWeight > 0 ? `${fmtNum(toDisplayMass(row.maxWeight, summary.displayUnit))} ${summary.displayUnit}` : `${row.sets}×`}
                </strong>
              </div>
            ))}
            {!summary.exerciseRows.length && (
              <p className="share-card-empty">{t('Nenhum exercício registrado')}</p>
            )}
          </div>
        </section>

        {summary.highlight && <ExerciseHighlight row={summary.highlight} unit={summary.displayUnit} />}

        {/* Footer */}
        <footer className="share-card-footer">
          <div className="share-footer-top-row">
            <div className="share-footer-quote">
              <span className="share-footer-text">{t('Consistência gera resultado.')}</span>
              <span className="share-footer-accent-line" />
            </div>
            <span className="share-footer-brand">FIT PRO PLAYER</span>
          </div>
          <div className="share-footer-url">
            <span>www.fitpp.com.br</span>
          </div>
        </footer>
      </div>
    </div>
  )
}

export function LayoutDashboard(props) { return <PerformanceCard {...props} /> }
export function LayoutMinimal(props) { return <PerformanceCard {...props} /> }
export function LayoutReceipt(props) { return <PerformanceCard {...props} /> }
export function LayoutBrutal(props) { return <PerformanceCard {...props} /> }
export function LayoutPolaroid(props) { return <PerformanceCard {...props} /> }
