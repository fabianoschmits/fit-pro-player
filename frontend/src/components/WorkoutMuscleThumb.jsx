import BodyMap from './BodyMap.jsx'
import { loadOfWorkouts } from '../lib/muscles.js'
import { bodyRegionOfLoad, bodyViewOfLoad } from '../lib/exercise-body-view.js'

export default function WorkoutMuscleThumb({ workout, body }) {
  const load = loadOfWorkouts([workout])
  return <BodyMap className="plan-routine-body-thumb" load={load} body={body}
    view={bodyViewOfLoad(load)} region={bodyRegionOfLoad(load)} decorative />
}
