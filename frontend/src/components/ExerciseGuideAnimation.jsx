import { useEffect, useRef, useState } from 'react'
import { exerciseName } from '../lib/exercises.js'
import { exerciseGuideAsset } from '../lib/exercise-guide-assets.js'

const FRAME_LOADERS = import.meta.glob('../assets/workout-guide/*/frames.js', { import: 'default' })
const CROSSFADE_PORTION = 0.14

function smoothstep(value) {
  const clamped = Math.max(0, Math.min(1, value))
  return clamped * clamped * (3 - 2 * clamped)
}

export function guideTimelineState(config, elapsed) {
  const steps = config.sequence.length
  const stepDuration = config.duration / steps
  const cycleTime = ((elapsed % config.duration) + config.duration) % config.duration
  const stepProgress = cycleTime / stepDuration
  const step = Math.min(steps - 1, Math.floor(stepProgress))
  const phase = stepProgress - step
  const mix = smoothstep((phase - (1 - CROSSFADE_PORTION)) / CROSSFADE_PORTION)
  return {
    currentFrame: config.sequence[step],
    nextFrame: config.sequence[(step + 1) % steps],
    mix,
  }
}

function validatedFrames(frames) {
  if (!Array.isArray(frames) || frames.length !== 3) throw new Error('Invalid Workout Guide frame set')
  return frames.map(frame => {
    if (!/^<svg\b/i.test(frame) || /<(?:script|image|foreignObject)\b|\b(?:href|xlink:href)\s*=|javascript:/i.test(frame)) {
      throw new Error('Unsafe Workout Guide SVG frame')
    }
    return frame
  })
}

async function loadFrames(slug) {
  const loader = FRAME_LOADERS[`../assets/workout-guide/${slug}/frames.js`]
  if (!loader) throw new Error(`Missing Workout Guide frames: ${slug}`)
  return validatedFrames(await loader())
}

export default function ExerciseGuideAnimation({ ex, playing, fallback = null }) {
  const config = exerciseGuideAsset(ex)
  const [frames, setFrames] = useState(null)
  const [failed, setFailed] = useState(false)
  const rootRef = useRef(null)
  const syncPlaybackRef = useRef(() => {})
  const visibleRef = useRef(true)
  const playingRef = useRef(playing)
  playingRef.current = playing

  useEffect(() => {
    let alive = true
    setFrames(null)
    setFailed(false)
    if (!config) return () => { alive = false }
    loadFrames(config.slug)
      .then(result => { if (alive) setFrames(result) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [config])

  useEffect(() => {
    const root = rootRef.current
    const layers = root?.querySelectorAll('[data-guide-frame]')
    if (layers?.length !== 3 || !config || !frames) return undefined

    let observer
    const requestFrame = window.requestAnimationFrame?.bind(window) ||
      (callback => window.setTimeout(() => callback(performance.now()), 16))
    const cancelFrame = window.cancelAnimationFrame?.bind(window) || window.clearTimeout.bind(window)
    const timeline = { elapsed: 0, frameId: null, lastSignature: '', startTime: null }
    visibleRef.current = true

    const render = elapsed => {
      const state = guideTimelineState(config, elapsed)
      const signature = `${state.currentFrame}:${state.nextFrame}:${state.mix.toFixed(3)}`
      if (signature === timeline.lastSignature) return
      timeline.lastSignature = signature
      layers.forEach(layer => { layer.style.opacity = '0' })
      layers[state.currentFrame].style.opacity = String(1 - state.mix)
      layers[state.nextFrame].style.opacity = String(
        Number(layers[state.nextFrame].style.opacity) + state.mix,
      )
    }

    const tick = timestamp => {
      if (timeline.startTime === null) return
      timeline.elapsed = (timestamp - timeline.startTime) % config.duration
      render(timeline.elapsed)
      timeline.frameId = requestFrame(tick)
    }

    const play = () => {
      if (timeline.startTime !== null) return
      timeline.startTime = performance.now() - timeline.elapsed
      timeline.frameId = requestFrame(tick)
    }

    const pause = () => {
      if (timeline.startTime !== null) {
        timeline.elapsed = (performance.now() - timeline.startTime) % config.duration
        timeline.startTime = null
      }
      if (timeline.frameId !== null) cancelFrame(timeline.frameId)
      timeline.frameId = null
      render(timeline.elapsed)
    }

    const syncPlayback = () => {
      const shouldPlay = playingRef.current && visibleRef.current && !document.hidden
      shouldPlay ? play() : pause()
    }
    syncPlaybackRef.current = syncPlayback
    render(0)

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(([entry]) => {
        visibleRef.current = entry.isIntersecting
        syncPlayback()
      }, { threshold: 0.08 })
      observer.observe(root)
    }
    const onVisibility = () => syncPlayback()
    document.addEventListener('visibilitychange', onVisibility)
    syncPlayback()

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      observer?.disconnect()
      pause()
      syncPlaybackRef.current = () => {}
    }
  }, [config, frames])

  useEffect(() => { syncPlaybackRef.current() }, [playing])

  if (!config) return null
  if (failed) return fallback
  if (!frames) {
    return (
      <div
        className="exercise-guide-motion is-loading"
        data-exercise-animation={ex.id}
        role="img"
        aria-label={exerciseName(ex)}
        aria-busy="true"
      >
        <span className="exercise-guide-placeholder" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div
      className={'exercise-guide-motion' + (playing ? ' is-playing' : '')}
      data-exercise-animation={ex.id}
      ref={rootRef}
      role="img"
      aria-label={exerciseName(ex)}
    >
      {frames.map((frame, index) => (
        <div
          className="exercise-guide-frame"
          data-guide-frame={index}
          // Frames are bundled source files, validated above and never supplied by users.
          dangerouslySetInnerHTML={{ __html: frame }}
          style={{ opacity: index === 0 ? 1 : 0 }}
          aria-hidden="true"
          key={index}
        />
      ))}
    </div>
  )
}
