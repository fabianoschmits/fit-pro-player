import BodyMap from './BodyMap.jsx'
import { loadOfRoutine } from '../lib/muscles.js'
import { routineBodyRegion, routineBodyView } from '../lib/exercise-body-view.js'

export default function RoutineMuscleThumb({ routine, body, className = '', region }) {
  return <BodyMap
    className={`plan-routine-body-thumb ${className}`.trim()}
    load={loadOfRoutine(routine)}
    body={body}
    view={routineBodyView(routine)}
    region={region || routineBodyRegion(routine)}
    decorative
  />
}
