import { useEffect, useState } from 'react'
import { exerciseName, imgSrc, gifSrc } from '../lib/exercises.js'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import ExerciseVisual from './ExerciseVisual.jsx'
import ExerciseMuscleThumb from './ExerciseMuscleThumb.jsx'
import PosecodeVisual from './PosecodeVisual.jsx'

// Big animation; tap toggles playback. Licensed media remains optional, while the normal
// build uses a fully bundled procedural 3D movement and custom exercises keep a static visual.
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
  const toggleSize = e => { e.stopPropagation(); update(s => { s.gifSize = mini ? 'full' : 'mini' }) }
  const gif = gifSrc(ex), img = imgSrc(ex)
  const showGif = playing && gif && !failedGif
  const showImg = img && !failedImg
  const src = showGif ? gif : showImg ? img : null
  const onMediaError = () => { if (showGif) setFailedGif(true); else setFailedImg(true) }
  return (
    <div className={'exmedia' + (compact ? ' compact' : '') + (mini ? ' mini' : '')} id={id} onClick={() => setPlaying(p => !p)}>
      {src
        ? <img decoding="async" src={src} alt={exerciseName(ex)} onError={onMediaError} />
        : ex?.gif
          ? <PosecodeVisual ex={ex} playing={playing} />
          : <ExerciseVisual ex={ex} />}
      {minimizable && (
        <button className="giftoggle" onClick={toggleSize}>
          <Icon name={mini ? 'expand' : 'minimize'} />{mini ? t('Expand') : t('Minimize')}
        </button>
      )}
      {!mini && (
        <span className="gifhint">
          <Icon name={playing ? 'pause' : 'play'} />{playing ? t('tap to pause') : t('tap to play')}
        </span>
      )}
    </div>
  )
}

export function Thumb({ ex }) {
  return <ExerciseMuscleThumb ex={ex} />
}
