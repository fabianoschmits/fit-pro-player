import { useEffect, useRef, useState } from 'react'
import { exerciseName } from '../lib/exercises.js'
import { exerciseGuideAsset } from '../lib/exercise-guide-assets.js'

const FRAME_LOADERS = import.meta.glob('../assets/workout-guide/*/frames.js', { import: 'default' })

export function guideTimelineState(config, elapsed) {
  const steps = config.sequence.length
  const stepDuration = config.duration / steps
  const cycleTime = ((elapsed % config.duration) + config.duration) % config.duration
  const step = Math.min(steps - 1, Math.floor(cycleTime / stepDuration))
  return { frame: config.sequence[step] }
}

function validatedFrames(frames) {
  if (!Array.isArray(frames) || frames.length < 1) throw new Error('Invalid Workout Guide frame set')
  return frames.map(frame => {
    if (!/^<svg\b/i.test(frame) || /<(?:script|foreignObject)\b|\bjavascript:/i.test(frame)) {
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
    if (layers?.length !== config?.sequence.length || !config || !frames) return undefined

    let observer
    const stepDuration = config.duration / config.sequence.length
    const timeline = { elapsed: 0, timerId: null, renderedFrame: null, startTime: null }
    visibleRef.current = true

    const render = elapsed => {
      const state = guideTimelineState(config, elapsed)
      if (state.frame === timeline.renderedFrame) return
      timeline.renderedFrame = state.frame
      layers.forEach((layer, index) => {
        const active = index === state.frame
        layer.classList.toggle('is-active', active)
        layer.setAttribute('aria-hidden', String(!active))
      })
    }

    const schedule = () => {
      if (timeline.startTime === null) return
      const now = performance.now()
      timeline.elapsed = (now - timeline.startTime) % config.duration
      render(timeline.elapsed)
      const untilNextFrame = stepDuration - (timeline.elapsed % stepDuration)
      timeline.timerId = window.setTimeout(schedule, Math.max(16, untilNextFrame + 1))
    }

    const play = () => {
      if (timeline.startTime !== null) return
      timeline.startTime = performance.now() - timeline.elapsed
      schedule()
    }

    const pause = () => {
      if (timeline.startTime !== null) {
        timeline.elapsed = (performance.now() - timeline.startTime) % config.duration
        timeline.startTime = null
      }
      if (timeline.timerId !== null) window.clearTimeout(timeline.timerId)
      timeline.timerId = null
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
          className={'exercise-guide-frame' + (index === 0 ? ' is-active' : '')}
          data-guide-frame={index}
          // Frames are bundled source files, validated above and never supplied by users.
          dangerouslySetInnerHTML={{ __html: frame }}
          aria-hidden={index !== 0}
          key={index}
        />
      ))}
    </div>
  )
}
