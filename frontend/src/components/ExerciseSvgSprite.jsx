import { useEffect, useId, useRef, useState } from 'react'
import { exerciseName } from '../lib/exercises.js'
import { exerciseSvgSprite } from '../lib/exercise-svg-sprites.js'

function spriteTransform(frame, frameWidth) {
  return `translateX(${-frame * frameWidth}px)`
}

const CROSSFADE_PORTION = 0.14

function smoothstep(value) {
  const clamped = Math.max(0, Math.min(1, value))
  return clamped * clamped * (3 - 2 * clamped)
}

export function spriteTimelineState(config, elapsed) {
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

export default function ExerciseSvgSprite({ ex, playing }) {
  const config = exerciseSvgSprite(ex)
  const instanceId = useId().replace(/:/g, '')
  const clipId = `exercise-sprite-clip-${instanceId}`
  const sheetId = `exercise-sprite-sheet-${instanceId}`
  const [paths, setPaths] = useState(null)
  const [failed, setFailed] = useState(false)
  const svgRef = useRef(null)
  const syncPlaybackRef = useRef(() => {})
  const visibleRef = useRef(true)
  const playingRef = useRef(playing)
  playingRef.current = playing

  useEffect(() => {
    let alive = true
    setPaths(null)
    setFailed(false)
    config?.loadPaths()
      .then(module => { if (alive) setPaths(module.PATHS || module.default) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [config])

  useEffect(() => {
    const svg = svgRef.current
    const layers = svg?.querySelectorAll('[data-sprite-layer]')
    if (layers?.length !== 2 || !config || !paths) return undefined
    let observer
    const posterStep = Math.max(0, config.sequence.indexOf(config.posterFrame))
    const requestFrame = window.requestAnimationFrame?.bind(window) || (callback => window.setTimeout(() => callback(performance.now()), 16))
    const cancelFrame = window.cancelAnimationFrame?.bind(window) || window.clearTimeout.bind(window)
    const timeline = {
      elapsed: posterStep / config.sequence.length * config.duration,
      frameId: null,
      lastSignature: '',
      startTime: null,
    }
    visibleRef.current = true

    const render = elapsed => {
      const state = spriteTimelineState(config, elapsed)
      const signature = `${state.currentFrame}:${state.nextFrame}:${state.mix.toFixed(3)}`
      if (signature === timeline.lastSignature) return
      timeline.lastSignature = signature
      layers[0].style.transform = spriteTransform(state.currentFrame, config.frameWidth)
      layers[0].style.opacity = String(1 - state.mix)
      layers[1].style.transform = spriteTransform(state.nextFrame, config.frameWidth)
      layers[1].style.opacity = String(state.mix)
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
    render(timeline.elapsed)
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(([entry]) => {
        visibleRef.current = entry.isIntersecting
        syncPlayback()
      }, { threshold: 0.08 })
      observer.observe(svg)
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
  }, [config, paths])

  useEffect(() => {
    syncPlaybackRef.current()
  }, [playing])

  if (!config) return null
  if (!paths || failed) {
    return (
      <div
        className={'exercise-sprite-motion is-loading' + (failed ? ' has-error' : '')}
        data-exercise-sprite={ex.id}
        role="img"
        aria-label={exerciseName(ex)}
        aria-busy={!failed}
      >
        <span className="exercise-sprite-placeholder" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="exercise-sprite-motion" data-exercise-sprite={ex.id}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${config.frameWidth} ${config.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={exerciseName(ex)}
        focusable="false"
      >
        <title>{exerciseName(ex)}</title>
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <rect width={config.frameWidth} height={config.height} />
          </clipPath>
          <g id={sheetId} aria-hidden="true">
            {paths.map((path, index) => (
              <path
                d={path.d}
                fill={path.accentOpacity ? 'currentColor' : path.fill}
                fillOpacity={path.accentOpacity || undefined}
                key={index}
              />
            ))}
          </g>
        </defs>
        {config.ground && <path className="sprite-ground" d={`M18 ${config.height - 15}H382`} aria-hidden="true" />}
        <g clipPath={`url(#${clipId})`}>
          {[0, 1].map(layerIndex => (
            <use
              className="sprite-sheet"
              data-sprite-layer={layerIndex}
              data-sprite-path-count={paths.length}
              href={`#${sheetId}`}
              style={{
                opacity: layerIndex === 0 ? 1 : 0,
                transform: spriteTransform(config.posterFrame, config.frameWidth),
              }}
              aria-hidden="true"
              key={layerIndex}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}
