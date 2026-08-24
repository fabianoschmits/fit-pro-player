import { useEffect, useRef, useState } from 'react'
import { exerciseName } from '../lib/exercises.js'
import { exerciseMotion } from '../lib/exercise-motion.js'
import ExerciseVisual from './ExerciseVisual.jsx'

// The motion documents are bundled JavaScript strings. Only the renderer is
// lazy-loaded, keeping the sizeable Three.js chunk away from catalogue lists.
export default function PosecodeVisual({ ex, playing }) {
  const canvasRef = useRef(null)
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
        viewer.setSpeed(0.88)
        if ('IntersectionObserver' in window) {
          observer = new IntersectionObserver(([entry]) => {
            visibleRef.current = entry.isIntersecting
            if (entry.isIntersecting && playingRef.current && !document.hidden) viewer.play()
            else viewer.pause()
          }, { threshold: 0.08 })
          observer.observe(canvas)
        }

        if (playingRef.current && visibleRef.current && !document.hidden) viewer.play()
        else viewer.pause()
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
    <div className={'posecode-visual' + (ready ? ' is-ready' : '')} role="img" aria-label={exerciseName(ex)}>
      {!ready && <ExerciseVisual ex={ex} decorative />}
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  )
}
