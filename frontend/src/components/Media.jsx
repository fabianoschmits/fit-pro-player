import { useEffect, useState } from 'react'
import { exerciseName, imgSrc, gifSrc } from '../lib/exercises.js'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import ExerciseVisual from './ExerciseVisual.jsx'

// Big autoplaying animation; tap toggles to the still frame. `compact` shrinks it (superset cards).
// Custom exercises and unlicensed builds use the original code-native visual below.
// `minimizable` (workout view) adds a persistent minimize/expand control so the animation stops
// eating the screen; the chosen size is saved to settings and carries across exercises and
// future workouts (issue #12).
export default function Media({ ex, id, compact, minimizable }) {
  const [playing, setPlaying] = useState(true)
  const [failedGif, setFailedGif] = useState(false)
  const [failedImg, setFailedImg] = useState(false)
  const gifSize = useStore(s => s.S.gifSize)
  const update = useStore(s => s.update)
  useEffect(() => { setPlaying(true); setFailedGif(false); setFailedImg(false) }, [ex?.id])
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
        : <ExerciseVisual ex={ex} animated={playing && !!ex?.gif} />}
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
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [ex?.id])
  const src = imgSrc(ex)
  if (!src || failed) return <ExerciseVisual ex={ex} className="thumb" decorative />
  return <img className="thumb" loading="lazy" decoding="async" src={src} alt="" onError={() => setFailed(true)} />
}
