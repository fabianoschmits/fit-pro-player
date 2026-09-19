import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import ExerciseMuscleThumb from './ExerciseMuscleThumb.jsx'
import ExerciseGuideAnimation from './ExerciseGuideAnimation.jsx'
import { hasExerciseGuideAsset } from '../lib/exercise-guide-assets.js'

const MUSCLES_EXIT_MS = 140

// Opening an exercise is an explicit request to see the movement, so playback starts on
// mount even when the OS asks to reduce motion (common on Windows). The leftover desktop
// click that opens the sheet is ignored so it cannot pause the animation immediately.
export default function Media({ ex, id, compact, minimizable }) {
  const mediaSize = useStore(s => s.S.mediaSize)
  const update = useStore(s => s.update)
  const mini = minimizable && mediaSize === 'mini'
  const [playing, setPlaying] = useState(() => !mini)
  const [musclesOpen, setMusclesOpen] = useState(false)
  const [musclesClosing, setMusclesClosing] = useState(false)
  const ignoreClickUntil = useRef(0)
  const resumeAfterMuscles = useRef(false)
  const musclesTriggerRef = useRef(null)
  const musclesCloseRef = useRef(null)
  const musclesCloseTimer = useRef(null)
  const musclesTitleId = useId()
  useEffect(() => {
    window.clearTimeout(musclesCloseTimer.current)
    setPlaying(!mini)
    setMusclesOpen(false)
    setMusclesClosing(false)
    resumeAfterMuscles.current = false
    ignoreClickUntil.current = Date.now() + 450
  }, [ex?.id, mini])
  useEffect(() => () => window.clearTimeout(musclesCloseTimer.current), [])
  const toggleSize = e => { e.stopPropagation(); update(s => { s.mediaSize = mini ? 'full' : 'mini' }) }
  const hasGuideAnimation = hasExerciseGuideAsset(ex)
  const togglePlayback = e => {
    e.stopPropagation()
    if (musclesOpen || Date.now() < ignoreClickUntil.current) return
    if (mini) {
      update(s => { s.mediaSize = 'full' })
      return
    }
    if (!hasGuideAnimation) return
    setPlaying(p => !p)
  }
  const openMuscles = e => {
    e.stopPropagation()
    musclesTriggerRef.current = e.currentTarget
    resumeAfterMuscles.current = playing
    setPlaying(false)
    setMusclesClosing(false)
    setMusclesOpen(true)
  }
  const finishClosingMuscles = useCallback(() => {
    window.clearTimeout(musclesCloseTimer.current)
    musclesCloseTimer.current = null
    setMusclesOpen(false)
    setMusclesClosing(false)
    if (resumeAfterMuscles.current && !mini) setPlaying(true)
    resumeAfterMuscles.current = false
    const trigger = musclesTriggerRef.current
    if (trigger?.isConnected) trigger.focus({ preventScroll: true })
  }, [mini])
  const closeMuscles = useCallback((e, immediate = false) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (!musclesOpen || musclesClosing) return
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (immediate || reducedMotion) {
      finishClosingMuscles()
      return
    }
    setMusclesClosing(true)
    musclesCloseTimer.current = window.setTimeout(finishClosingMuscles, MUSCLES_EXIT_MS)
  }, [finishClosingMuscles, musclesClosing, musclesOpen])
  useEffect(() => {
    if (!musclesOpen || musclesClosing) return undefined
    musclesCloseRef.current?.focus({ preventScroll: true })
    const onKeyDown = event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation?.()
      closeMuscles(null, true)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [closeMuscles, musclesClosing, musclesOpen])
  useEffect(() => {
    if (!musclesOpen || typeof document === 'undefined') return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [musclesOpen])
  const keepDialogFocus = event => {
    if (event.key !== 'Tab') return
    event.preventDefault()
    musclesCloseRef.current?.focus({ preventScroll: true })
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
      {minimizable && (
        <button className="media-size-toggle" onClick={toggleSize}>
          <Icon name={mini ? 'expand' : 'minimize'} />
        </button>
      )}
      {!mini && hasGuideAnimation && (
        <button ref={musclesTriggerRef} className="media-muscles" onClick={openMuscles} aria-label={t('Show muscles')}>
          <Icon name="figureStrength" />
        </button>
      )}
      {!mini && hasGuideAnimation && (
        <button className="media-playback" onClick={togglePlayback} aria-label={playing ? t('tap to pause') : t('tap to play')}>
          <Icon name={playing ? 'pause' : 'play'} />
        </button>
      )}
      {musclesOpen && typeof document !== 'undefined' && createPortal(
        <div className={`media-muscles-scrim${musclesClosing ? ' is-closing' : ''}`} onClick={closeMuscles}>
          <div
            className="media-muscles-pop"
            role="dialog"
            aria-modal="true"
            aria-labelledby={musclesTitleId}
            tabIndex={-1}
            onClick={e => e.stopPropagation()}
            onKeyDown={keepDialogFocus}
          >
            <button ref={musclesCloseRef} className="media-muscles-close" onClick={closeMuscles} aria-label={t('Close')}>
              <Icon name="xmark" />
            </button>
            <div id={musclesTitleId} className="media-muscles-title">{t('Worked muscles')}</div>
            <ExerciseMuscleThumb ex={ex} popup />
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

export function Thumb({ ex }) {
  return <ExerciseMuscleThumb ex={ex} />
}
