import { useState, useRef, useEffect } from 'react'
import { toPng } from 'html-to-image'
import { t } from '../lib/i18n.js'
import { EXIDX, exerciseName } from '../lib/exercises.js'
import { fmtDate, fmtVol, fmtDur } from '../lib/format.js'
import { useStore } from '../store/useStore.js'
import { loadOfWorkouts } from '../lib/muscles.js'
import BodyMap from './BodyMap.jsx'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'
import '../workout-themes.css'
import '../workout-share-layouts.css'
import { LayoutDashboard as ShareCardLayout } from './WorkoutShareLayouts.jsx'
import { shareWorkoutImage } from '../lib/workout-share.js'

// The Dashboard layout is the default "gamer card" layout
function LayoutDashboard({ w, st, innerRef, themeId }) {
  const dur = w.end - w.start
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
                <span className="wsc-stat-val">{fmtVol(w.vol, st.unit)}</span>
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
  const [error, setError] = useState(null)
  const canvasRef = useRef(null)   // points to .workout-story-canvas (1080×1920)
  const outerRef = useRef(null)    // points to the visible scaler container

  // Scale the canvas to fit the visible preview frame
  useEffect(() => {
    if (!outerRef.current || !canvasRef.current) return
    const obs = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width
      if (width > 0) {
        canvasRef.current.style.transform = `scale(${width / 1080})`
        canvasRef.current.style.transformOrigin = 'top left'
      }
    })
    obs.observe(outerRef.current)
    return () => obs.disconnect()
  }, [])

  // ── Generate PNG ─────────────────────────────────────────────────────────
  const generateImage = async () => {
    if (!canvasRef.current) return null
    setError(null)
    setGenerating(true)

    // html-to-image clones the node. Make every async resource ready first;
    // otherwise the clone can contain the fallback silhouette and omit the logo.
    await new Promise(r => setTimeout(r, 400))
    await document.fonts?.ready
    const images = [...canvasRef.current.querySelectorAll('img')]
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
        const paths = canvasRef.current.querySelectorAll('.share-card-map svg path')
        if (paths.length || performance.now() - started > 2000) return resolve()
        requestAnimationFrame(check)
      }
      check()
    })

    try {
      const dataUrl = await toPng(canvasRef.current, {
        width: 1080,
        height: 1920,
        pixelRatio: 1,
        cacheBust: true,
        style: { transform: 'none', transformOrigin: 'top left' },
        includeQueryParams: true,
      })
      return dataUrl
    } catch (err) {
      console.error('[share] toPng error:', err)
      setError(t('Não foi possível gerar a imagem. Tente novamente.'))
      return null
    } finally {
      setGenerating(false)
    }
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
    const dataUrl = await generateImage()
    if (!dataUrl) return
    if (platform === 'save') saveToDevice(dataUrl)
    else {
      try {
        await shareNative(dataUrl)
      } catch (e) {
        if (e?.name === 'AbortError') return
        console.error('[share] failed:', e)
        setError(t('Não foi possível abrir o compartilhamento. Tente novamente.'))
      }
    }
  }

  return (
    <div className="workout-share-sheet">
      <div className="workout-share-heading">
        <div><h2>{t('Compartilhar treino')}</h2><p>{t('Sua imagem principal está pronta para compartilhar.')}</p></div>
        <span className="workout-share-heading-mark"><Icon name="upload" /></span>
      </div>
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
        <p className="workout-share-error">{error}</p>
      )}

      {/* Pinned action buttons */}
      <div className="workout-share-actions">
        <Button
          variant="primary"
          onClick={() => onShare('share')}
          disabled={generating}
          className="share-btn-ig"
        >
          {generating ? t('Gerando imagem...') : t('Compartilhar imagem')}
        </Button>
        <div className="workout-share-row">
          <Button
            variant="secondary"
            onClick={() => onShare('save')}
            disabled={generating}
          >
            {t('Baixar PNG')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onShare('share')}
            disabled={generating}
          >
            {t('Mais opções')}
          </Button>
        </div>
      </div>
    </div>
  )
}
