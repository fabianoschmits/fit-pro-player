import { useEffect, useRef, useState } from 'react'
import { exerciseName } from '../lib/exercises.js'
import { exerciseMotion } from '../lib/exercise-motion.js'
import ExerciseVisual from './ExerciseVisual.jsx'

const POSTER_RATIOS = {
  crunch: 0.54,
  'dead-hang': 0.5,
  'plank-hold': 0.55,
}

function posterRatioOf(key) {
  return POSTER_RATIOS[key] ?? 0.36
}

function setThreeColor(target, cssColor) {
  if (!target || !cssColor) return
  // Chromium may serialize color-mix() as CSS Color 4. Three.js accepts rgb(),
  // so normalize that one representation before handing the value over.
  const srgb = cssColor.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
  const rgba = cssColor.match(/^rgba\(([^,]+),\s*([^,]+),\s*([^,]+),/)
  const value = srgb
    ? `rgb(${Math.round(Number(srgb[1]) * 255)}, ${Math.round(Number(srgb[2]) * 255)}, ${Math.round(Number(srgb[3]) * 255)})`
    : rgba ? `rgb(${rgba[1]}, ${rgba[2]}, ${rgba[3]})` : cssColor
  target.setStyle(value)
}

function themeViewer(viewer, wrapper) {
  const root = viewer.getMannequin()?.root
  const scene = root?.parent
  if (!scene || !wrapper) return
  const styles = getComputedStyle(wrapper)
  const background = styles.backgroundColor
  const ground = styles.borderTopColor
  const accent = styles.color
  const neutral = styles.outlineColor

  setThreeColor(scene.background, background)
  setThreeColor(scene.fog?.color, background)

  scene.traverse(node => {
    if (!node.isMesh) return
    const materials = Array.isArray(node.material) ? node.material : [node.material]
    for (const material of materials) {
      if (!material?.color) continue
      if (node.geometry?.type === 'CircleGeometry') {
        setThreeColor(material.color, ground)
        material.transparent = true
        material.opacity = 0.36
        material.depthWrite = false
      } else {
        const original = material.userData.fitProOriginalColor ?? material.color.getHex()
        material.userData.fitProOriginalColor = original
        if (original === 0x35707e) setThreeColor(material.color, accent)
        if (original === 0x262c38 || original === 0x6b7280) setThreeColor(material.color, neutral)
      }
      material.needsUpdate = true
    }
  })
  viewer.refresh?.()
}

// The motion documents are bundled JavaScript strings. Only the renderer is
// lazy-loaded, keeping the sizeable Three.js chunk away from catalogue lists.
export default function PosecodeVisual({ ex, playing }) {
  const canvasRef = useRef(null)
  const wrapperRef = useRef(null)
  const viewerRef = useRef(null)
  const visibleRef = useRef(true)
  const playingRef = useRef(playing)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const motion = exerciseMotion(ex)
  playingRef.current = playing

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !motion.source) {
      setFailed(true)
      return undefined
    }

    let cancelled = false
    let observer
    let themeObserver
    setReady(false)
    setFailed(false)

    Promise.all([import('posecode-parser'), import('posecode-render')])
      .then(([{ parse }, { createViewer }]) => {
        if (cancelled) return
        const parsed = parse(motion.source)
        if (!parsed.ir || parsed.errors.length) throw new Error(`Movimento Posecode inválido: ${motion.key}`)

        const viewer = createViewer(canvas, { autoRotate: false, floorGuide: false })
        viewerRef.current = viewer
        viewer.load(parsed.ir)
        viewer.setLoop(true)
        viewer.setSpeed(0.8)
        themeViewer(viewer, wrapperRef.current)
        themeObserver = new MutationObserver(() => themeViewer(viewer, wrapperRef.current))
        themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-theme', 'data-accent'],
        })
        if ('IntersectionObserver' in window) {
          observer = new IntersectionObserver(([entry]) => {
            visibleRef.current = entry.isIntersecting
            if (entry.isIntersecting && playingRef.current && !document.hidden) viewer.play()
            else viewer.pause()
          }, { threshold: 0.08 })
          observer.observe(canvas)
        }

        if (playingRef.current && visibleRef.current && !document.hidden) viewer.play()
        else {
          // A paused exercise should show its defining position, not a generic
          // neutral stance at the first millisecond of the program.
          viewer.seek(viewer.duration * posterRatioOf(motion.key))
          viewer.pause()
        }
        setReady(true)
      })
      .catch(error => {
        if (cancelled) return
        viewerRef.current?.dispose()
        viewerRef.current = null
        console.warn('Não foi possível iniciar a animação 3D do exercício.', error)
        setFailed(true)
      })

    const onVisibility = () => {
      const viewer = viewerRef.current
      if (!viewer) return
      if (playingRef.current && visibleRef.current && !document.hidden) viewer.play()
      else viewer.pause()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      observer?.disconnect()
      themeObserver?.disconnect()
      viewerRef.current?.dispose()
      viewerRef.current = null
    }
  }, [motion.key, motion.source])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    if (playing && visibleRef.current && !document.hidden) viewer.play()
    else viewer.pause()
  }, [playing, ready])

  if (failed) return <ExerciseVisual ex={ex} />

  return (
    <div
      ref={wrapperRef}
      className={'posecode-visual' + (ready ? ' is-ready' : '')}
      role="img"
      aria-label={exerciseName(ex)}
    >
      {!ready && <ExerciseVisual ex={ex} decorative />}
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  )
}
