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

export function pathMatchesSelectedSide(index, count, selectedSide, viewName) {
  if (!selectedSide) return true
  const visualSide = index < count / 2 ? 'left' : 'right'
  const anatomicalSide = viewName === 'front'
    ? (visualSide === 'left' ? 'right' : 'left')
    : visualSide
  return anatomicalSide === selectedSide
}

function View({ view, viewName, levels, onMuscle, selected, selectedSide, decorative, shapeScales, shapeInstant }) {
  const selectedMuscles = new Set(Array.isArray(selected) ? selected : selected ? [selected] : [])
  const pathIsSelected = (slug, index, count) => selectedMuscles.has(slug)
    && (!SIDE_AWARE_SLUGS.has(slug) || pathMatchesSelectedSide(index, count, selectedSide, viewName))
  return (
    <svg
      className={`bm-v${shapeInstant ? ' bm-shape-instant' : ''}`}
      viewBox={view.vb}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? 'true' : undefined}
      aria-label={decorative ? undefined : t('Body diagram')}
      focusable="false"
    >
      {INERT.map(slug => (view.p[slug] || []).map((d, i, paths) =>
        <path key={slug + i} className={'bm-sil' + (pathIsSelected(slug, i, paths.length) ? ' sel' : '')} d={d} />))}
      {MUSCLES.map(slug => {
        const paths = view.p[slug] || []
        if (!shapeScales) return paths.map((d, i) => <path
          key={slug + i}
          className={'bm-m l' + (levels[slug] || 0) + (pathIsSelected(slug, i, paths.length) ? ' sel' : '')}
          d={d}
          onClick={onMuscle ? () => onMuscle(slug) : undefined}
        >
          {!decorative && <title>{t(MUSCLE_NAME[slug])}</title>}
        </path>)
        const rawScale = Number(shapeScales?.[slug])
        const scale = Number.isFinite(rawScale) ? Math.min(1.4, Math.max(.72, rawScale)) : 1
        const renderPath = (d, i, local = false) => <path
          key={slug + i}
          className={'bm-m l' + (levels[slug] || 0) + (pathIsSelected(slug, i, paths.length) ? ' sel' : '') + (local ? ' bm-shape-path' : '')}
          style={local ? { transform: `scaleX(${scale})` } : undefined}
          d={d}
          onClick={onMuscle ? () => onMuscle(slug) : undefined}
        >
          {!decorative && <title>{t(MUSCLE_NAME[slug])}</title>}
        </path>
        if (LOCAL_SHAPE_SLUGS.has(slug)) return paths.map((d, i) => renderPath(d, i, true))
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
            <View
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
