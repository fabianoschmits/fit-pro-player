import { exerciseName } from '../lib/exercises.js'

const zoneOf = bp => ({
  chest: 'torso', back: 'torso', shoulders: 'arms', 'upper arms': 'arms',
  waist: 'core', 'upper legs': 'legs', 'lower legs': 'legs', cardio: 'all',
})[bp] || 'all'

// Original, code-native fallback used when licensed catalogue media is unavailable.
// It keeps every exercise identifiable without bundling or redistributing third-party art.
export default function ExerciseVisual({ ex, animated = false, decorative = false, className = '' }) {
  const zone = zoneOf(ex?.bp)
  return (
    <div
      className={'exercise-visual ' + (animated ? 'is-animated ' : '') + className}
      data-zone={zone}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : exerciseName(ex)}
    >
      <svg viewBox="0 0 120 160" aria-hidden="true" focusable="false">
        <g className="exvis-figure">
          <circle className="exvis-head" cx="60" cy="21" r="12" />
          <path className="exvis-torso" d="M43 42 Q60 34 77 42 L72 94 Q60 102 48 94 Z" />
          <path className="exvis-core" d="M48 70 Q60 76 72 70 L72 94 Q60 102 48 94 Z" />
          <g className="exvis-arms">
            <path d="M44 45 L25 73 L14 105" />
            <path d="M76 45 L95 73 L106 105" />
          </g>
          <g className="exvis-legs">
            <path d="M51 94 L43 124 L36 150" />
            <path d="M69 94 L77 124 L84 150" />
          </g>
        </g>
      </svg>
    </div>
  )
}
