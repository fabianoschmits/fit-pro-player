import { exerciseGuideAsset } from '../lib/exercise-guide-assets.js'
import ExerciseMuscleThumb from './ExerciseMuscleThumb.jsx'

const frames = import.meta.glob('../assets/exercise-sprites/*/frame-1.webp', { eager: true, query: '?url', import: 'default' })

export default function ExerciseSpriteThumb({ ex }) {
  const guide = exerciseGuideAsset(ex)
  const src = guide && frames[`../assets/exercise-sprites/${guide.slug}/frame-1.webp`]
  return src ? <span className="thumb exercise-sprite-thumb" aria-hidden="true"><img src={src} alt="" loading="lazy" decoding="async" /></span> : <ExerciseMuscleThumb ex={ex} />
}
