import BodyMap from './BodyMap.jsx'
import { musclesOf } from '../lib/muscles.js'
import { exerciseBodyView } from '../lib/exercise-body-view.js'
import { useStore } from '../store/useStore.js'

export default function ExerciseMuscleThumb({ ex, full = false, popup = false }) {
  const body = useStore(s => s.S.body)
  const variant = full ? 'exercise-muscle-static' : popup ? 'exercise-muscle-popup' : 'thumb'
  return (
    <BodyMap
      className={'exercise-muscle-thumb ' + variant}
      load={musclesOf(ex)}
      body={body}
      view={popup ? 'both' : exerciseBodyView(ex)}
      decorative={!full && !popup}
    />
  )
}
