import BodyMap from './BodyMap.jsx'
import { musclesOf } from '../lib/muscles.js'
import { exerciseBodyView } from '../lib/exercise-body-view.js'
import { useStore } from '../store/useStore.js'

export default function ExerciseMuscleThumb({ ex, full = false }) {
  const body = useStore(s => s.S.body)
  return (
    <BodyMap
      className={'exercise-muscle-thumb ' + (full ? 'exercise-muscle-static' : 'thumb')}
      load={musclesOf(ex)}
      body={body}
      view={exerciseBodyView(ex)}
      decorative={!full}
    />
  )
}
