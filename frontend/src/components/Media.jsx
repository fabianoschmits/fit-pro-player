import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import ExerciseMuscleThumb from './ExerciseMuscleThumb.jsx'
import ExerciseGuideAnimation from './ExerciseGuideAnimation.jsx'
import { hasExerciseGuideAsset } from '../lib/exercise-guide-assets.js'

// Big animation; tap toggles playback. Verified catalogue matches use bundled Workout Guide SVG
// frames. Exercises without an exact movement match keep the static muscle map used by their card,
// so loading never flashes an unrelated or temporary avatar.
// `minimizable` (workout view) adds a persistent minimize/expand control so the animation stops
// eating the screen; the chosen size is saved to settings and carries across exercises and
// future workouts (issue #12).
export default function Media({ ex, id, compact, minimizable }) {
  const reduceMotion = () => typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [playing, setPlaying] = useState(() => !reduceMotion())
  const mediaSize = useStore(s => s.S.mediaSize)
  const update = useStore(s => s.update)
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const onChange = event => { if (event.matches) setPlaying(false) }
    query?.addEventListener?.('change', onChange)
    return () => query?.removeEventListener?.('change', onChange)
  }, [])
  useEffect(() => { setPlaying(!reduceMotion()) }, [ex?.id])
  const mini = minimizable && mediaSize === 'mini'
  useEffect(() => { if (mini) setPlaying(false) }, [mini])
  const toggleSize = e => { e.stopPropagation(); update(s => { s.mediaSize = mini ? 'full' : 'mini' }) }
  const hasGuideAnimation = hasExerciseGuideAsset(ex)
  return (
    <div className={'exmedia' + (compact ? ' compact' : '') + (mini ? ' mini' : '')} id={id}>
      {hasGuideAnimation
        ? <ExerciseGuideAnimation ex={ex} playing={playing} fallback={<ExerciseMuscleThumb ex={ex} full />} />
        : <ExerciseMuscleThumb ex={ex} full />}
      {minimizable && (
        <button className="media-size-toggle" onClick={toggleSize}>
          <Icon name={mini ? 'expand' : 'minimize'} />{mini ? t('Expand') : t('Minimize')}
        </button>
      )}
      {!mini && hasGuideAnimation && (
        <button className="media-playback" onClick={() => setPlaying(p => !p)} aria-label={playing ? t('tap to pause') : t('tap to play')}>
          <Icon name={playing ? 'pause' : 'play'} />{playing ? t('tap to pause') : t('tap to play')}
        </button>
      )}
    </div>
  )
}

export function Thumb({ ex }) {
  return <ExerciseMuscleThumb ex={ex} />
}
