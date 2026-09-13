import BodyMap from './BodyMap.jsx'
import { BODY_MEASUREMENT_BY_ID, BODY_MEASUREMENT_PARTS } from '../lib/body-measurements.js'

const HOTSPOTS = {
  front: {
    neck: [50, 14], shoulders: [50, 22], chest: [50, 30],
    'left-arm': [78, 35], 'right-arm': [22, 35],
    'left-forearm': [84, 47], 'right-forearm': [16, 47],
    waist: [50, 45], abdomen: [50, 53], hips: [50, 61],
    'left-thigh': [62, 70], 'right-thigh': [38, 70],
    'left-calf': [62, 87], 'right-calf': [38, 87],
  },
  back: {
    neck: [50, 14], shoulders: [50, 23], chest: [50, 31],
    'left-arm': [22, 36], 'right-arm': [78, 36],
    'left-forearm': [16, 48], 'right-forearm': [84, 48],
    waist: [50, 46], abdomen: [50, 53], hips: [50, 61],
    'left-thigh': [38, 71], 'right-thigh': [62, 71],
    'left-calf': [38, 87], 'right-calf': [62, 87],
  },
}

export default function MeasurementBodyMap({ body, view, selected, latestValues, weekValues, onSelect }) {
  const selectedPart = BODY_MEASUREMENT_BY_ID[selected]
  const mapLoad = {}
  BODY_MEASUREMENT_PARTS.forEach(part => {
    const level = weekValues[part.id] != null ? 2 : latestValues[part.id] != null ? 1 : 0
    part.muscles.forEach(slug => { mapLoad[slug] = Math.max(mapLoad[slug] || 0, level) })
  })
  return <div className="measurement-map-stage">
    <BodyMap
      className="tappable measurement-bodymap"
      body={body}
      view={view}
      load={mapLoad}
      thresholds={[{ at: 0, level: 0 }, { at: 1, level: 1 }, { at: 2, level: 4 }]}
      selected={selectedPart?.muscles || []}
      decorative
    />
    <div className="measurement-hotspots" aria-label="Regiões para medir">
      {BODY_MEASUREMENT_PARTS.map(part => {
        const [x, y] = HOTSPOTS[view][part.id]
        const measured = weekValues[part.id] != null
        const known = latestValues[part.id] != null
        return <button
          type="button"
          key={part.id}
          className={`measurement-hotspot${selected === part.id ? ' selected' : ''}${measured ? ' measured' : known ? ' known' : ''}`}
          style={{ '--hotspot-x': `${x}%`, '--hotspot-y': `${y}%` }}
          aria-label={`${part.label}${measured ? ', medida nesta semana' : ''}`}
          aria-pressed={selected === part.id}
          onClick={() => onSelect(part.id)}
        >
          <span className="measurement-hotspot-dot" />
          <span className="measurement-hotspot-label">{part.shortLabel}</span>
        </button>
      })}
    </div>
  </div>
}
