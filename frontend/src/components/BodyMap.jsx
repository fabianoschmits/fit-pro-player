import { useEffect, useState } from 'react'
import { MUSCLES, INERT, MUSCLE_NAME, levelsOf } from '../lib/muscles.js'
import { t } from '../lib/i18n.js'

// Front and back views of a body, each muscle shaded by how hard it was worked.
//
// The five shade steps are the same ones the activity heatmap uses (.hm-c.l0…l4), so
// "more accent = more training" means one thing everywhere in the app rather than two.
//
// The geometry is ~90 KB and only some screens show a map, so it is fetched on first
// render instead of riding along in the main bundle. Until it lands the component
// renders nothing but keeps its height, so nothing below it jumps on arrival.

let CACHE = null                                  // shared across every mounted map
let PENDING = null

function useBodyPaths() {
  const [paths, setPaths] = useState(CACHE)
  useEffect(() => {
    if (CACHE) return
    let alive = true
    PENDING = PENDING || import('../lib/body-paths.js').then(m => (CACHE = m.default))
    PENDING.then(p => { if (alive) setPaths(p) }).catch(() => {})
    return () => { alive = false }
  }, [])
  return paths
}

const LOCAL_SHAPE_SLUGS = new Set(['biceps', 'triceps', 'forearm', 'quadriceps', 'hamstring', 'calves', 'tibialis', 'adductors'])
const SIDE_AWARE_SLUGS = LOCAL_SHAPE_SLUGS

export function anatomicalSideForPath(index, count, viewName) {
  const visualSide = index < count / 2 ? 'left' : 'right'
  return viewName === 'front'
    ? (visualSide === 'left' ? 'right' : 'left')
    : visualSide
}

export function pathMatchesSelectedSide(index, count, selectedSide, viewName) {
  if (!selectedSide) return true
  return anatomicalSideForPath(index, count, viewName) === selectedSide
}

export function shapeScaleForPath(shapeScales, slug, index, count, viewName) {
  const configured = shapeScales?.[slug]
  const rawScale = configured && typeof configured === 'object'
    ? configured[anatomicalSideForPath(index, count, viewName)]
    : configured
  const scale = Number(rawScale)
  return Number.isFinite(scale) ? Math.min(1.4, Math.max(.72, scale)) : 1
}

export function BodyMapView({ view, viewName, levels, onMuscle, selected, selectedSide, decorative, shapeScales, shapeInstant }) {
  const selectedMuscles = new Set(Array.isArray(selected) ? selected : selected ? [selected] : [])
  const pathIsSelected = (slug, index, count) => selectedMuscles.has(slug)
    && (!SIDE_AWARE_SLUGS.has(slug) || pathMatchesSelectedSide(index, count, selectedSide, viewName))
  const keyMuscle = (event, slug) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onMuscle(slug)
  }
  const pathA11y = (slug, index) => onMuscle && index === 0 ? {
    role: 'button', tabIndex: 0, 'aria-label': t(MUSCLE_NAME[slug]),
    'aria-pressed': selectedMuscles.has(slug),
    onKeyDown: event => keyMuscle(event, slug),
  } : { 'aria-hidden': 'true' }
  return (
    <svg
      className={`bm-v${shapeInstant ? ' bm-shape-instant' : ''}`}
      viewBox={view.vb}
      role={decorative ? undefined : onMuscle ? 'group' : 'img'}
      aria-hidden={decorative ? 'true' : undefined}
      aria-label={decorative ? undefined : t('Body diagram')}
      focusable={onMuscle ? undefined : 'false'}
    >
      {INERT.map(slug => {
        const paths = view.p[slug] || []
        const rendered = paths.map((d, i) => <path key={slug + i} className={'bm-sil' + (pathIsSelected(slug, i, paths.length) ? ' sel' : '')} d={d} />)
        if (slug !== 'neck' || !shapeScales) return rendered
        const scale = shapeScaleForPath(shapeScales, slug, 0, 1, viewName)
        return <g key={slug} className="bm-shape-group" style={{ transform: `scaleX(${scale})` }}>{rendered}</g>
      })}
      {MUSCLES.map(slug => {
        const paths = view.p[slug] || []
        if (!shapeScales) return paths.map((d, i) => <path
          key={slug + i}
          className={'bm-m l' + (levels[slug] || 0) + (pathIsSelected(slug, i, paths.length) ? ' sel' : '')}
          d={d}
          onClick={onMuscle ? () => onMuscle(slug) : undefined}
          {...pathA11y(slug, i)}
        />)
        const renderPath = (d, i, local = false, scale = 1) => <path
          key={slug + i}
          className={'bm-m l' + (levels[slug] || 0) + (pathIsSelected(slug, i, paths.length) ? ' sel' : '') + (local ? ' bm-shape-path' : '')}
          style={local ? { transform: `scaleX(${scale})` } : undefined}
          d={d}
          onClick={onMuscle ? () => onMuscle(slug) : undefined}
          {...pathA11y(slug, i)}
        />
        if (LOCAL_SHAPE_SLUGS.has(slug)) return paths.map((d, i) => renderPath(d, i, true, shapeScaleForPath(shapeScales, slug, i, paths.length, viewName)))
        const scale = shapeScaleForPath(shapeScales, slug, 0, 1, viewName)
        return <g key={slug} className="bm-shape-group" style={{ transform: `scaleX(${scale})` }}>{paths.map((d, i) => renderPath(d, i))}</g>
      })}
    </svg>
  )
}

/**
 * <BodyMap load={{ chest: 12, … }} body="male" />
 * `load` is effective sets per muscle (see lib/muscles.js); shading is relative to
 * the hardest-worked muscle in that same load, so it always reads as a balance. Pass ordered
 * `{ at, level, exclusive? }` `thresholds` for a fixed absolute scale (recovery views use this
 * to keep their semantic bands stable); omitting it preserves the balance behavior.
 */
export default function BodyMap({
  load = {}, thresholds, body = 'male', onMuscle, selected, selectedSide, className = '',
  view = 'both', decorative = false, shapeScales, shapeInstant = false,
}) {
  const paths = useBodyPaths()
  const levels = levelsOf(load, thresholds)
  const g = paths && (paths[body] || paths.male)
  const views = g && (view === 'front' ? [g.front] : view === 'back' ? [g.back] : [g.front, g.back])
  return (
    <div className={'bodymap ' + className}>
      {views
        ? views.map((bodyView, index) => (
            <BodyMapView
              key={view === 'both' ? (index ? 'back' : 'front') : view}
              view={bodyView}
              viewName={view === 'both' ? (index ? 'back' : 'front') : view}
              levels={levels}
              onMuscle={onMuscle}
              selected={selected}
              selectedSide={selectedSide}
              decorative={decorative}
              shapeScales={shapeScales}
              shapeInstant={shapeInstant}
            />
          ))
        : <div className="bm-ph" aria-hidden="true" />}
    </div>
  )
}

export function BodyMapLegend() {
  return <div className="hm-legend">
    {t('Less')} <div className="hm-c l0" /><div className="hm-c l1" /><div className="hm-c l2" />
    <div className="hm-c l3" /><div className="hm-c l4" /> {t('More')}
  </div>
}
