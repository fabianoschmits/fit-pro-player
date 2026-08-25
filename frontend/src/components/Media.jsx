import { useEffect, useState } from 'react'
import { exerciseName, imgSrc, gifSrc } from '../lib/exercises.js'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import ExerciseMuscleThumb from './ExerciseMuscleThumb.jsx'
import ExerciseSvgSprite from './ExerciseSvgSprite.jsx'
import { hasExerciseSvgSprite } from '../lib/exercise-svg-sprites.js'

// Big animation; tap toggles playback. The first catalogue exercises use local SVG sprites.
// Exercises that have not been redrawn yet keep the same static muscle map used by their card,
// so loading never flashes a different avatar before the final visual is ready.
// `minimizable` (workout view) adds a persistent minimize/expand control so the animation stops
// eating the screen; the chosen size is saved to settings and carries across exercises and
// future workouts (issue #12).
export default function Media({ ex, id, compact, minimizable }) {
  const reduceMotion = () => typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [playing, setPlaying] = useState(() => !reduceMotion())
  const [failedGif, setFailedGif] = useState(false)
  const [failedImg, setFailedImg] = useState(false)
  const gifSize = useStore(s => s.S.gifSize)
  const update = useStore(s => s.update)
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const onChange = event => { if (event.matches) setPlaying(false) }
    query?.addEventListener?.('change', onChange)
    return () => query?.removeEventListener?.('change', onChange)
  }, [])
  useEffect(() => { setPlaying(!reduceMotion()); setFailedGif(false); setFailedImg(false) }, [ex?.id])
  const mini = minimizable && gifSize === 'mini'
  useEffect(() => { if (mini) setPlaying(false) }, [mini])
  const toggleSize = e => { e.stopPropagation(); update(s => { s.gifSize = mini ? 'full' : 'mini' }) }
  const gif = gifSrc(ex), img = imgSrc(ex)
  const showGif = playing && gif && !failedGif
  const showImg = img && !failedImg
  const src = showGif ? gif : showImg ? img : null
  const hasSprite = hasExerciseSvgSprite(ex)
  const canPlay = hasSprite || Boolean(gif && !failedGif)
  const onMediaError = () => { if (showGif) setFailedGif(true); else setFailedImg(true) }
  return (
    <div className={'exmedia' + (compact ? ' compact' : '') + (mini ? ' mini' : '')} id={id}>
      {hasSprite
        ? <ExerciseSvgSprite ex={ex} playing={playing} />
        : src
          ? <img decoding="async" src={src} alt={exerciseName(ex)} onError={onMediaError} />
          : <ExerciseMuscleThumb ex={ex} full />}
      {minimizable && (
        <button className="giftoggle" onClick={toggleSize}>
          <Icon name={mini ? 'expand' : 'minimize'} />{mini ? t('Expand') : t('Minimize')}
        </button>
      )}
      {!mini && canPlay && (
        <button className="gifhint" onClick={() => setPlaying(p => !p)} aria-label={playing ? t('tap to pause') : t('tap to play')}>
          <Icon name={playing ? 'pause' : 'play'} />{playing ? t('tap to pause') : t('tap to play')}
        </button>
      )}
    </div>
  )
}

export function Thumb({ ex }) {
  return <ExerciseMuscleThumb ex={ex} />
}
