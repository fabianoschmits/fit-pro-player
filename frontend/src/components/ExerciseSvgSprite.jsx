import { useEffect, useRef } from 'react'
import { exerciseName } from '../lib/exercises.js'
import { exerciseSvgSprite } from '../lib/exercise-svg-sprites.js'
import { ABDOMINAL_SPRITE_PATHS } from '../lib/abdominal-sprite-paths.js'
import ExerciseVisual from './ExerciseVisual.jsx'

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
  const svgRef = useRef(null)
  const animationRef = useRef(null)
  const visibleRef = useRef(true)
  const playingRef = useRef(playing)
  playingRef.current = playing

  useEffect(() => {
    const svg = svgRef.current
    const sheet = svg?.querySelector('[data-sprite-sheet]')
    if (!sheet || !config || typeof Element === 'undefined' || !Element.prototype.animate) return undefined
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
  }, [config])

  useEffect(() => {
    const animation = animationRef.current
    if (!animation) return
    const shouldPlay = playing && visibleRef.current && !document.hidden
    shouldPlay ? animation.play() : animation.pause()
  }, [playing])

  if (!config) return <ExerciseVisual ex={ex} />

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
        <path className="sprite-ground" d={`M18 ${config.height - 15}H382`} aria-hidden="true" />
        <g
          className="sprite-sheet"
          data-sprite-sheet="true"
          data-sprite-path-count={ABDOMINAL_SPRITE_PATHS.length}
          style={{ transform: spriteTransform(config.posterFrame, config.frameWidth) }}
          aria-hidden="true"
        >
          {ABDOMINAL_SPRITE_PATHS.map((path, index) => (
            <path
              d={path.d}
              fill={path.accentOpacity ? 'currentColor' : path.fill}
              fillOpacity={path.accentOpacity || undefined}
              key={index}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}
