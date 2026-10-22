import { useState, useRef, useEffect } from 'react'
import { toPng } from 'html-to-image'
import { t } from '../lib/i18n.js'
import { EXIDX, exerciseName } from '../lib/exercises.js'
import { fmtDate, fmtVol, fmtDur, workoutDuration } from '../lib/format.js'
import { useStore } from '../store/useStore.js'
import { loadOfWorkouts } from '../lib/muscles.js'
import BodyMap from './BodyMap.jsx'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'
import '../workout-themes.css'
import '../workout-share-layouts.css'
import { LayoutDashboard as ShareCardLayout } from './WorkoutShareLayouts.jsx'
import { shareWorkoutImage } from '../lib/workout-share.js'
import { FppActionFeedback } from './FppFeedback.jsx'

// The Dashboard layout is the default "gamer card" layout
function LayoutDashboard({ w, st, innerRef, themeId }) {
  const dur = workoutDuration(w)
  const setsCount = w.entries.reduce((acc, e) => acc + (e.sets ? e.sets.length : 0), 0)
  const load = loadOfWorkouts([w])

  return (
    <div ref={innerRef} className={`workout-story-canvas ${themeId}`}>
      {/* Backgrounds and glows */}
      <div className="wsc-bg" />
      <div className="wsc-grid-pattern" />
      <div className="wsc-glow wsc-glow-top" />
      <div className="wsc-glow wsc-glow-bottom" />

      {/* BodyMap — background */}
      <div className="wsc-bodymap-wrap">
        <BodyMap
          load={load}
          body={st.body || 'male'}
          view="front"
          decorative
          className="wsc-bodymap"
        />
      </div>

      <div className="wsc-content-wrapper">
        {/* Header: Logo and Date */}
        <div className="wsc-header">
          <div className="wsc-logo-box">
            <img src="/brand-logo.png" alt="Fit Pro Player" />
          </div>
          <div className="wsc-date-badge">
            <Icon name="calendar" />
            <span>{fmtDate(w.d, true)}</span>
          </div>
        </div>

        {/* Title */}
        <div className="wsc-title-container">
          <div className="wsc-title-subtitle">STATUS DO JOGADOR</div>
          <h2 className="wsc-title">TREINO CONCLUÍDO</h2>
          <div className="wsc-duration-badge">
            <Icon name="clock" /> {fmtDur(dur)}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="wsc-stats-grid">
          <div className="wsc-stat-box">
            <div className="wsc-stat-icon"><Icon name="list" /></div>
            <div className="wsc-stat-info">
              <span className="wsc-stat-val">{w.entries.length}</span>
              <span className="wsc-stat-label">{t('Exercícios')}</span>
            </div>
          </div>
          <div className="wsc-stat-box">
            <div className="wsc-stat-icon"><Icon name="repeat" /></div>
            <div className="wsc-stat-info">
              <span className="wsc-stat-val">{setsCount}</span>
              <span className="wsc-stat-label">{t('Séries')}</span>
            </div>
          </div>
          {w.vol > 0 && (
            <div className="wsc-stat-box">
              <div className="wsc-stat-icon"><Icon name="dumbbell" /></div>
              <div className="wsc-stat-info">
                <span className="wsc-stat-val">{fmtVol(w.vol, st.displayUnit || 'kg')}</span>
                <span className="wsc-stat-label">{t('Volume')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Exercises Card */}
        <div className="wsc-exercises-card" data-few={w.entries.length < 5 ? 'true' : 'false'}>
          <div className="wsc-exercises-header">
            <div className="wsc-eh-line" />
            <span>DESEMPENHO</span>
            <div className="wsc-eh-line" />
          </div>
          <div className="wsc-exercises-list">
            {w.entries.slice(0, 8).map((e, idx) => {
              const exData = EXIDX[e.id]
              const name = exData ? exerciseName(exData) : e.id
              const totalSets = e.sets ? e.sets.length : 0
              const maxReps = e.sets && e.sets.length
                ? Math.max(...e.sets.filter(s => s.r).map(s => s.r || 0))
                : 0
              return (
                <div key={idx} className="wsc-ex-row">
                  <div className="wsc-ex-icon"><Icon name="check" /></div>
                  <span className="wsc-ex-name">{name}</span>
                  <span className="wsc-ex-sets">{totalSets}×{maxReps > 0 ? maxReps : '-'}</span>
                </div>
              )
            })}
            {w.entries.length > 8 && (
              <div className="wsc-ex-extra">+ {w.entries.length - 8} {t('exercícios')}</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="wsc-footer">
          <div className="wsc-footer-line" />
          <span>FITPPLAYER.COM.BR</span>
          <div className="wsc-footer-line" />
        </div>
      </div>
    </div>
  )
}

function WorkoutStoryPreview({ w, st, innerRef, themeId }) {
  return <ShareCardLayout w={w} st={st} innerRef={innerRef} themeId={themeId} />
}

// ── Main modal component ───────────────────────────────────────────────────
export function WorkoutShareModal({ w, onClose }) {
  const st = useStore(s => s.S)
  const [generating, setGenerating] = useState(false)
  const [phase, setPhase] = useState('generating')
  const [shareOutcomes, setShareOutcomes] = useState({ share: 'shared', more: 'shared' })
  const [error, setError] = useState(null)
  const operation = useRef(false)
  const canvasRef = useRef(null)   // points to .workout-story-canvas (1080×1920)
  const outerRef = useRef(null)    // points to the visible scaler container

  // Scale the canvas to fit the visible preview frame
  useEffect(() => {
    if (!outerRef.current || !canvasRef.current) return
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) {
        const scale = Math.min(width / 1080, height / 1920)
        canvasRef.current.style.transform = `scale(${scale})`
        canvasRef.current.style.transformOrigin = 'center center'
      }
    })
    obs.observe(outerRef.current)
    return () => obs.disconnect()
  }, [])

  // ── Generate PNG ─────────────────────────────────────────────────────────
  const generateImage = async () => {
    const canvas = canvasRef.current
    if (!canvas) return null

    // html-to-image clones the node. Make every async resource ready first;
    // otherwise the clone can contain the fallback silhouette and omit the logo.
    await document.fonts?.ready
    const images = [...canvas.querySelectorAll('img')]
    await Promise.all(images.map(image => {
      if (!image.complete) return new Promise(resolve => {
        image.addEventListener('load', resolve, { once: true })
        image.addEventListener('error', resolve, { once: true })
      })
      return image.decode?.().catch(() => undefined)
    }))
    await new Promise(resolve => {
      const started = performance.now()
      const check = () => {
        const paths = canvas.querySelectorAll('.share-card-map svg path')
        if (paths.length || performance.now() - started > 2000) return resolve()
        requestAnimationFrame(check)
      }
      check()
    })

    return toPng(canvas, {
      width: 1080,
      height: 1920,
      pixelRatio: 1,
      cacheBust: true,
      style: { transform: 'none', transformOrigin: 'top left' },
      includeQueryParams: true,
    })
  }

  // ── Save to device ────────────────────────────────────────────────────────
  const saveToDevice = (dataUrl) => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `treino-fpp-${Date.now()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // The platform-specific adapters are loaded only when the share action is used.
  // This keeps the web bundle independent from native plugin initialization.
  const shareNative = async (dataUrl) => {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) return shareWorkoutImage(dataUrl, { dialogTitle: t('Compartilhar treino') })
    const [filesystemModule, shareModule] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
    return shareWorkoutImage(dataUrl, {
      capacitor: Capacitor,
      filesystem: filesystemModule.Filesystem,
      directory: filesystemModule.Directory.Cache,
      share: shareModule.Share,
      dialogTitle: t('Compartilhar treino'),
    })
  }

  const onShare = async (platform) => {
    if (operation.current || !canvasRef.current) return false
    operation.current = true
    setGenerating(true)
    setPhase('generating')
    setError(null)
    let sharing = false
    try {
      const dataUrl = await generateImage()
      if (!dataUrl) return false
      if (platform === 'save') saveToDevice(dataUrl)
      else {
        sharing = true
        setPhase('sharing')
        const result = await shareNative(dataUrl)
        setShareOutcomes(current => ({ ...current, [platform]: result?.method === 'download' ? 'saved' : 'shared' }))
      }
      return true
    } catch (e) {
      if (e?.name === 'AbortError') return false
      setError(t(sharing ? 'Não foi possível abrir o compartilhamento. Tente novamente.' : 'Não foi possível gerar a imagem. Tente novamente.'))
      throw e
    } finally {
      operation.current = false
      setGenerating(false)
    }
  }

  return (
    <div className="workout-share-sheet">
      {/* Story preview frame */}
      <div className="workout-share-preview-area">
        <div ref={outerRef} className="workout-share-scaler-outer">
          <div className="workout-share-scaler-inner">
            <WorkoutStoryPreview w={w} st={st} innerRef={canvasRef} themeId="t1" />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <FppActionFeedback state="error" className="workout-share-error">{error}</FppActionFeedback>
      )}

      {/* Pinned action buttons */}
      <div className="workout-share-actions">
        <Button
          variant="primary"
          activation="animated"
          icon="upload"
          onAction={() => onShare('share')}
          loadingLabel={t(phase === 'sharing' ? 'Compartilhando…' : 'Gerando imagem...')}
          successLabel={t(shareOutcomes.share === 'saved' ? 'Imagem salva' : 'Compartilhado')}
          disabled={generating}
          className="share-btn-action"
        >
          {t('Compartilhar')}
        </Button>
      </div>
    </div>
  )
}
