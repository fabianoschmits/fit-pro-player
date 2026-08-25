import { useEffect, useId, useRef, useState } from 'react'
import { exerciseName } from '../lib/exercises.js'
import { exerciseSvgSprite } from '../lib/exercise-svg-sprites.js'

function spriteTransform(frame, frameWidth) {
  return `translateX(${-frame * frameWidth}px)`
}

const CROSSFADE_START = 0.62
const CROSSFADE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'

function buildLayerKeyframes(config, layerIndex) {
  const steps = config.sequence.length
  const keyframes = []
  config.sequence.forEach((currentFrame, step) => {
    const nextFrame = config.sequence[(step + 1) % steps]
    const active = step % 2 === layerIndex
    const transform = spriteTransform(active ? currentFrame : nextFrame, config.frameWidth)
    const start = step / steps
    const fadeStart = (step + CROSSFADE_START) / steps
    const end = (step + 1) / steps
    keyframes.push({ transform, opacity: active ? 1 : 0, offset: start })
    keyframes.push({
      transform,
      opacity: active ? 1 : 0,
      offset: fadeStart,
      easing: CROSSFADE_EASING,
    })
    keyframes.push({ transform, opacity: active ? 0 : 1, offset: end })
  })
  return keyframes
}

export default function ExerciseSvgSprite({ ex, playing }) {
  const config = exerciseSvgSprite(ex)
  const clipId = `exercise-sprite-clip-${useId().replace(/:/g, '')}`
  const [paths, setPaths] = useState(null)
  const [failed, setFailed] = useState(false)
  const svgRef = useRef(null)
  const animationsRef = useRef([])
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
    if (!layers?.length || !config || !paths || typeof Element === 'undefined' || !Element.prototype.animate) return undefined
    let observer
    const posterStep = Math.max(0, config.sequence.indexOf(config.posterFrame))
    const animations = [...layers].map((layer, layerIndex) => {
      const animation = layer.animate(buildLayerKeyframes(config, layerIndex), {
        duration: config.duration,
        iterations: Infinity,
        easing: 'linear',
        fill: 'both',
      })
      animation.pause()
      animation.currentTime = posterStep / config.sequence.length * config.duration
      return animation
    })
    animationsRef.current = animations

    const syncPlayback = () => {
      const shouldPlay = playingRef.current && visibleRef.current && !document.hidden
      animations.forEach(animation => { shouldPlay ? animation.play() : animation.pause() })
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
      animations.forEach(animation => animation.cancel())
      animationsRef.current = []
    }
  }, [config, paths])

  useEffect(() => {
    const animations = animationsRef.current
    if (!animations.length) return
    const shouldPlay = playing && visibleRef.current && !document.hidden
    animations.forEach(animation => { shouldPlay ? animation.play() : animation.pause() })
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
        </defs>
        {config.ground && <path className="sprite-ground" d={`M18 ${config.height - 15}H382`} aria-hidden="true" />}
        <g clipPath={`url(#${clipId})`}>
          {[0, 1].map(layerIndex => (
            <g
              className="sprite-sheet"
              data-sprite-layer={layerIndex}
              data-sprite-path-count={paths.length}
              style={{
                opacity: layerIndex === 0 ? 1 : 0,
                transform: spriteTransform(config.posterFrame, config.frameWidth),
              }}
              aria-hidden="true"
              key={layerIndex}
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
          ))}
        </g>
      </svg>
    </div>
  )
}
