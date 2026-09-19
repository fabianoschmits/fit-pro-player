import { useEffect, useRef, useState } from 'react'
import BodyMap from './BodyMap.jsx'
import { BODY_MEASUREMENT_BY_ID, BODY_MEASUREMENT_PARTS } from '../lib/body-measurements.js'

const LANDMARKS = {
  front: {
    neck: [.5, .145], shoulders: [.5, .19], chest: [.5, .245],
    'left-arm': [.73, .3], 'right-arm': [.27, .3],
    'left-forearm': [.8, .43], 'right-forearm': [.2, .43],
    waist: [.5, .35], abdomen: [.5, .405], hips: [.5, .495],
    'left-thigh': [.61, .62], 'right-thigh': [.39, .62],
    'left-calf': [.61, .82], 'right-calf': [.39, .82],
  },
  back: {
    neck: [.5, .145], shoulders: [.5, .19], chest: [.5, .255],
    'left-arm': [.27, .3], 'right-arm': [.73, .3],
    'left-forearm': [.2, .43], 'right-forearm': [.8, .43],
    waist: [.5, .36], abdomen: [.5, .41], hips: [.5, .5],
    'left-thigh': [.39, .62], 'right-thigh': [.61, .62],
    'left-calf': [.39, .82], 'right-calf': [.61, .82],
  },
}

const BODY_VIEWBOX = {
  male: {
    front: { x: 0, y: 95, width: 727, height: 1280 },
    back: { x: 718, y: 95, width: 727, height: 1280 },
  },
  female: {
    front: { x: 0, y: 0, width: 650, height: 1450 },
    back: { x: 823, y: 0, width: 650, height: 1450 },
  },
}

const REFERENCE_CM = {
  male: {
    neck: 38, shoulders: 112, chest: 98, 'left-arm': 33.5, 'right-arm': 33.5,
    'left-forearm': 28.2, 'right-forearm': 28.2, waist: 84, abdomen: 88, hips: 96,
    'left-thigh': 56, 'right-thigh': 56, 'left-calf': 36.5, 'right-calf': 36.5,
  },
  female: {
    neck: 33.5, shoulders: 100, chest: 92, 'left-arm': 29, 'right-arm': 29,
    'left-forearm': 24.5, 'right-forearm': 24.5, waist: 72, abdomen: 80, hips: 98,
    'left-thigh': 56, 'right-thigh': 56, 'left-calf': 35.5, 'right-calf': 35.5,
  },
}

const RING_RADIUS = {
  neck: 5.5, shoulders: 25.5, chest: 20, 'left-arm': 4.7, 'right-arm': 4.7,
  'left-forearm': 3.9, 'right-forearm': 3.9, waist: 14.8, abdomen: 17.3, hips: 19.3,
  'left-thigh': 6.4, 'right-thigh': 6.4, 'left-calf': 4.8, 'right-calf': 4.8,
}

// A circumference crosses more than one anatomical surface. Keep the original
// body-map geometry and highlight every drawable region the tape passes over,
// including the matching rear muscles when the user switches to the back view.
export const MEASUREMENT_MUSCLES = {
  neck: ['neck', 'trapezius'],
  shoulders: ['trapezius', 'deltoids', 'upper-back'],
  chest: ['chest', 'serratus', 'upper-back'],
  'left-arm': ['biceps', 'triceps'],
  'right-arm': ['biceps', 'triceps'],
  'left-forearm': ['forearm'],
  'right-forearm': ['forearm'],
  waist: ['obliques', 'lower-back'],
  abdomen: ['abs', 'obliques', 'lower-back'],
  hips: ['hip-flexors', 'gluteal'],
  'left-thigh': ['quadriceps', 'hamstring', 'adductors'],
  'right-thigh': ['quadriceps', 'hamstring', 'adductors'],
  'left-calf': ['calves', 'tibialis'],
  'right-calf': ['calves', 'tibialis'],
}

export const measurementMusclesFor = partId => MEASUREMENT_MUSCLES[partId] || []

function landmarkStyle([u, v], box, size) {
  if (!size?.width || !size?.height) return { '--hotspot-x': `${u * 100}%`, '--hotspot-y': `${v * 100}%` }
  const viewAspect = box.width / box.height
  const hostAspect = size.width / size.height
  const renderWidth = hostAspect > viewAspect ? size.height * viewAspect : size.width
  const renderHeight = hostAspect > viewAspect ? size.height : size.width / viewAspect
  const x = (size.width - renderWidth) / 2 + u * renderWidth
  const y = (size.height - renderHeight) / 2 + v * renderHeight
  return { '--hotspot-x': `${x}px`, '--hotspot-y': `${y}px` }
}

const clamp = (min, value, max) => Math.min(max, Math.max(min, value))
const mean = values => {
  const valid = values.filter(value => Number.isFinite(value))
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 1
}

function scaleFor(values, baselineValues, body, partId, fallbackScales = {}) {
  const value = Number(values?.[partId])
  const reference = REFERENCE_CM[body]?.[partId] || REFERENCE_CM.male[partId]
  if (!(value > 0)) {
    const fallback = Number(fallbackScales?.[partId])
    return fallback > 0 ? clamp(.76, fallback, 1.34) : 1
  }
  const baseline = Number(baselineValues?.[partId])
  const absoluteChange = value / reference - 1
  const relativeChange = baseline > 0 ? value / baseline - 1 : 0
  return clamp(.76, 1 + absoluteChange * 1.05 + relativeChange * .42, 1.34)
}

export function measurementShapeScales(values = {}, baselineValues = {}, body = 'male', fallbackScales = {}) {
  const scale = id => scaleFor(values, baselineValues, body, id, fallbackScales)
  const leftArm = scale('left-arm')
  const rightArm = scale('right-arm')
  const leftForearm = scale('left-forearm')
  const rightForearm = scale('right-forearm')
  const leftThigh = scale('left-thigh')
  const rightThigh = scale('right-thigh')
  const leftCalf = scale('left-calf')
  const rightCalf = scale('right-calf')
  const sides = (left, right) => ({ left, right })
  const waist = scale('waist')
  const abdomen = scale('abdomen')
  const hips = scale('hips')
  const shoulders = scale('shoulders')
  const chest = scale('chest')
  return {
    neck: scale('neck'),
    trapezius: mean([scale('neck'), shoulders]),
    deltoids: shoulders,
    'upper-back': mean([shoulders, chest]),
    chest,
    serratus: mean([chest, waist]),
    obliques: mean([waist, abdomen, abdomen]),
    abs: abdomen,
    'lower-back': mean([waist, abdomen]),
    gluteal: hips,
    'hip-flexors': hips,
    biceps: sides(leftArm, rightArm),
    triceps: sides(leftArm, rightArm),
    forearm: sides(leftForearm, rightForearm),
    adductors: sides(mean([hips, leftThigh]), mean([hips, rightThigh])),
    quadriceps: sides(leftThigh, rightThigh),
    hamstring: sides(leftThigh, rightThigh),
    calves: sides(leftCalf, rightCalf),
    tibialis: sides(leftCalf, rightCalf),
  }
}

export default function MeasurementBodyMap({
  body = 'male', view = 'front', selected, latestValues = {}, weekValues = {}, shapeValues,
  baselineValues = {}, fallbackScales = {}, directValues, instant = false, onSelect,
}) {
  // Geometry may use a weight-based visual fallback, but labels, rings and ARIA
  // must only expose circumferences that the user actually recorded.
  const displayValues = { ...latestValues, ...weekValues }
  const values = shapeValues || displayValues
  const direct = directValues || weekValues
  const shapeScales = measurementShapeScales(values, baselineValues, body, fallbackScales)
  const selectedPart = BODY_MEASUREMENT_BY_ID[selected]
  const selectedValue = displayValues[selected]
  const selectedMuscles = measurementMusclesFor(selected)
  const stageRef = useRef(null)
  const [stageSize, setStageSize] = useState(null)
  const box = BODY_VIEWBOX[body]?.[view] || BODY_VIEWBOX.male[view]

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined
    const measure = () => {
      const rect = stage.getBoundingClientRect()
      setStageSize(current => current?.width === rect.width && current?.height === rect.height
        ? current
        : { width: rect.width, height: rect.height })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  return <div ref={stageRef} className={`measurement-map-stage${instant ? ' is-scrubbing' : ''}`}>
    <BodyMap
      className="tappable measurement-bodymap"
      body={body}
      view={view}
      load={{}}
      decorative
      selected={selectedMuscles}
      selectedSide={selectedPart?.side}
      shapeScales={shapeScales}
      shapeInstant={instant}
    />
    <svg className="measurement-rings" viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      {BODY_MEASUREMENT_PARTS.map(part => {
        const [u, v] = LANDMARKS[view][part.id]
        const measured = direct[part.id] != null
        const known = displayValues[part.id] != null
        const partScale = scaleFor(values, baselineValues, body, part.id, fallbackScales)
        return <ellipse
          key={part.id}
          className={`measurement-ring${selected === part.id ? ' selected' : ''}${measured ? ' direct' : known ? ' carried' : ' empty'}`}
          cx={box.x + u * box.width}
          cy={box.y + v * box.height}
          rx={RING_RADIUS[part.id] / 100 * box.width * partScale}
          ry={(part.side ? .007 : .009) * box.height}
        />
      })}
    </svg>
    <div className="measurement-hotspots" role="group" aria-label="Circunferências corporais">
      {BODY_MEASUREMENT_PARTS.map(part => {
        const landmark = LANDMARKS[view][part.id]
        const measured = direct[part.id] != null
        const known = displayValues[part.id] != null
        const displayed = displayValues[part.id]
        return <button
          type="button"
          key={part.id}
          className={`measurement-hotspot${selected === part.id ? ' selected' : ''}${measured ? ' measured' : known ? ' known' : ''}`}
          style={landmarkStyle(landmark, box, stageSize)}
          aria-label={`${part.circumferenceLabel}${displayed != null ? `, ${displayed} centímetros` : ', sem registro'}${measured ? ', medida neste check-in' : known ? ', valor anterior' : ''}`}
          aria-pressed={selected === part.id}
          onClick={() => onSelect?.(part.id)}
        >
          <span className="measurement-hotspot-dot" />
          <span className="measurement-hotspot-label">{selectedPart?.id === part.id ? `${part.shortLabel}${selectedValue != null ? ` · ${fmtOne(selectedValue)} cm` : ''}` : part.shortLabel}</span>
        </button>
      })}
    </div>
  </div>
}

const fmtOne = value => String(Math.round(Number(value) * 10) / 10).replace('.', ',')
