import { useEffect, useId, useRef, useState } from 'react'
import { exerciseName } from '../lib/exercises.js'
import { exerciseSvgSprite } from '../lib/exercise-svg-sprites.js'

function spriteTransform(frame, frameWidth) {
  return `translateX(${-frame * frameWidth}px)`
}

function buildSheetKeyframes(config) {
  const steps = config.sequence.length
  const keyframes = []
  config.sequence.forEach((frame, step) => {
    const transform = spriteTransform(frame, config.frameWidth)
    keyframes.push({ transform, offset: step / steps })
    keyframes.push({ transform, offset: (step + 0.999) / steps })
  })
  keyframes.push({ transform: spriteTransform(config.sequence[0], config.frameWidth), offset: 1 })
  return keyframes
}

export default function ExerciseSvgSprite({ ex, playing }) {
  const config = exerciseSvgSprite(ex)
  const clipId = `exercise-sprite-clip-${useId().replace(/:/g, '')}`
  const [paths, setPaths] = useState(null)
  const [failed, setFailed] = useState(false)
  const svgRef = useRef(null)
  const animationRef = useRef(null)
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
    const sheet = svg?.querySelector('[data-sprite-sheet]')
    if (!sheet || !config || !paths || typeof Element === 'undefined' || !Element.prototype.animate) return undefined
    let observer
    const posterStep = Math.max(0, config.sequence.indexOf(config.posterFrame))
    const animation = sheet.animate(buildSheetKeyframes(config), {
      duration: config.duration,
      iterations: Infinity,
      easing: 'linear',
      fill: 'both',
    })
    animation.pause()
    animation.currentTime = posterStep / config.sequence.length * config.duration
    animationRef.current = animation

    const syncPlayback = () => {
      const shouldPlay = playingRef.current && visibleRef.current && !document.hidden
      shouldPlay ? animation.play() : animation.pause()
    }
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
      animation.cancel()
      animationRef.current = null
    }
  }, [config, paths])

  useEffect(() => {
    const animation = animationRef.current
    if (!animation) return
    const shouldPlay = playing && visibleRef.current && !document.hidden
    shouldPlay ? animation.play() : animation.pause()
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
        role="img"
        aria-label={exerciseName(ex)}
        focusable="false"
      >
        <title>{exerciseName(ex)}</title>
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <rect width={config.frameWidth} height={config.height} />
          </clipPath>
        </defs>
        {config.ground && <path className="sprite-ground" d={`M18 ${config.height - 15}H382`} aria-hidden="true" />}
        <g clipPath={`url(#${clipId})`}>
          <g
            className="sprite-sheet"
            data-sprite-sheet="true"
            data-sprite-path-count={paths.length}
            style={{ transform: spriteTransform(config.posterFrame, config.frameWidth) }}
            aria-hidden="true"
          >
            {paths.map((path, index) => (
              <path
                d={path.d}
                fill={path.accentOpacity ? 'currentColor' : path.fill}
                fillOpacity={path.accentOpacity || undefined}
                key={index}
              />
            ))}
          </g>
        </g>
      </svg>
    </div>
  )
}
