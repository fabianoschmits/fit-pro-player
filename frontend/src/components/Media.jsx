import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import ExerciseMuscleThumb from './ExerciseMuscleThumb.jsx'
import ExerciseGuideAnimation from './ExerciseGuideAnimation.jsx'
import { hasExerciseGuideAsset } from '../lib/exercise-guide-assets.js'

// Opening an exercise is an explicit request to see the movement, so playback starts on
// mount even when the OS asks to reduce motion (common on Windows). The leftover desktop
// click that opens the sheet is ignored so it cannot pause the animation immediately.
export default function Media({ ex, id, compact, minimizable }) {
  const mediaSize = useStore(s => s.S.mediaSize)
  const update = useStore(s => s.update)
  const mini = minimizable && mediaSize === 'mini'
  const [playing, setPlaying] = useState(() => !mini)
  const ignoreClickUntil = useRef(0)
  useEffect(() => {
    setPlaying(!mini)
    ignoreClickUntil.current = Date.now() + 450
  }, [ex?.id, mini])
  const toggleSize = e => { e.stopPropagation(); update(s => { s.mediaSize = mini ? 'full' : 'mini' }) }
  const hasGuideAnimation = hasExerciseGuideAsset(ex)
  const togglePlayback = e => {
    e.stopPropagation()
    if (!hasGuideAnimation || mini || Date.now() < ignoreClickUntil.current) return
    setPlaying(p => !p)
  }
  return (
    <div
      className={'exmedia' + (compact ? ' compact' : '') + (mini ? ' mini' : '')}
      id={id}
      onClick={togglePlayback}
    >
      {hasGuideAnimation
        ? <ExerciseGuideAnimation ex={ex} playing={playing} fallback={<ExerciseMuscleThumb ex={ex} full />} />
        : <ExerciseMuscleThumb ex={ex} full />}
      {hasGuideAnimation && <ExerciseMuscleThumb ex={ex} overlay />}
      {minimizable && (
        <button className="media-size-toggle" onClick={toggleSize}>
          <Icon name={mini ? 'expand' : 'minimize'} />{mini ? t('Expand') : t('Minimize')}
        </button>
      )}
      {!mini && hasGuideAnimation && (
        <button className="media-playback" onClick={togglePlayback} aria-label={playing ? t('tap to pause') : t('tap to play')}>
          <Icon name={playing ? 'pause' : 'play'} />
        </button>
      )}
    </div>
  )
}

export function Thumb({ ex }) {
  return <ExerciseMuscleThumb ex={ex} />
}
