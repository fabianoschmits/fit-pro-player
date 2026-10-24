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
import { LayoutDashboard as ShareCardLayout, WORKOUT_SHARE_LAYOUTS } from './WorkoutShareLayouts.jsx'
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

function WorkoutStoryPreview({ w, st, innerRef, themeId, layoutId }) {
  return <ShareCardLayout w={w} st={st} innerRef={innerRef} themeId={themeId} layoutId={layoutId} />
}

const loadShareImage = source => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = reject
  image.src = source
})

// html-to-image can lose regular <img> elements in native webviews even though
// the same image is visible in the DOM. Compose the already-loaded mark onto
// its generated PNG so the published image always has the user's visible logo.
export async function composeShareImageWithLogo(cardDataUrl, logo, card, {
  loadImage = loadShareImage,
  createCanvas = () => document.createElement('canvas'),
} = {}) {
  if (!cardDataUrl || !logo || !card) return cardDataUrl

  const logoBounds = logo.getBoundingClientRect()
  const cardBounds = card.getBoundingClientRect()
  if (!logoBounds.width || !logoBounds.height || !cardBounds.width || !cardBounds.height) return cardDataUrl

  try {
    const exportedCard = await loadImage(cardDataUrl)
    const output = createCanvas()
    output.width = 1080
    output.height = 1920
    const context = output.getContext('2d')
    if (!context) return cardDataUrl

    const scaleX = 1080 / cardBounds.width
    const scaleY = 1920 / cardBounds.height
    context.drawImage(exportedCard, 0, 0, 1080, 1920)
    context.drawImage(
      logo,
      (logoBounds.left - cardBounds.left) * scaleX,
      (logoBounds.top - cardBounds.top) * scaleY,
      logoBounds.width * scaleX,
      logoBounds.height * scaleY,
    )
    return output.toDataURL('image/png')
  } catch {
    // A share image without a second render is still preferable to failing the
    // native share flow if a webview rejects canvas composition.
    return cardDataUrl
  }
}

// ── Main modal component ───────────────────────────────────────────────────
export function WorkoutShareModal({ w, onClose }) {
  const st = useStore(s => s.S)
  const [generating, setGenerating] = useState(false)
  const [phase, setPhase] = useState('generating')
  const [layoutIndex, setLayoutIndex] = useState(0)
  const [shareOutcomes, setShareOutcomes] = useState({ share: 'shared', more: 'shared' })
  const [error, setError] = useState(null)
  const operation = useRef(false)
  const canvasRef = useRef(null)   // points to .workout-story-canvas (1080×1920)
  const outerRef = useRef(null)    // points to the visible scaler container
  const layoutSwipe = useRef(null)
  const activeLayout = WORKOUT_SHARE_LAYOUTS[layoutIndex]

  const selectLayout = nextIndex => {
    setLayoutIndex(Math.max(0, Math.min(WORKOUT_SHARE_LAYOUTS.length - 1, nextIndex)))
  }

  const startLayoutSwipe = (x, y) => {
    layoutSwipe.current = { x, y }
  }

  const finishLayoutSwipe = (x, y) => {
    const start = layoutSwipe.current
    layoutSwipe.current = null
    if (!start) return
    const distanceX = x - start.x
    const distanceY = y - start.y
    if (Math.abs(distanceX) < 42 || Math.abs(distanceX) <= Math.abs(distanceY)) return
    selectLayout(layoutIndex + (distanceX < 0 ? 1 : -1))
  }

  // Scale the canvas to fit the visible preview frame
  useEffect(() => {
    const scaleCanvas = ({ width, height }) => {
      const canvas = canvasRef.current
      if (!canvas || width <= 0 || height <= 0) return
      const scale = Math.min(width / 1080, height / 1920)
      canvas.style.transform = `scale(${scale})`
      canvas.style.transformOrigin = 'center center'
    }

    if (!outerRef.current || !canvasRef.current) return
    const obs = new ResizeObserver(entries => {
      scaleCanvas(entries[0].contentRect)
    })
    obs.observe(outerRef.current)
    scaleCanvas(outerRef.current.getBoundingClientRect())
    return () => obs.disconnect()
  }, [layoutIndex])

  // The modal is as wide as its 9:16 preview. This must not run from the
  // preview observer itself: changing the sheet width would resize that target
  // again and can create an observer feedback loop in Chromium.
  useEffect(() => {
    const syncSheetWidth = () => {
      const outer = outerRef.current
      const sheet = outer?.closest('.sheet.share-sheet-modal')
      if (!outer || !sheet) return
      const previewWidth = `${Math.round(outer.getBoundingClientRect().width)}px`
      if (sheet.style.getPropertyValue('--share-preview-width') !== previewWidth) {
        sheet.style.setProperty('--share-preview-width', previewWidth)
      }
    }
    syncSheetWidth()
    window.addEventListener('resize', syncSheetWidth)
    return () => window.removeEventListener('resize', syncSheetWidth)
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

    const lionLogo = canvas.querySelector('.share-card-logo')
    const cardDataUrl = await toPng(canvas, {
        width: 1080,
        height: 1920,
        pixelRatio: 1,
        cacheBust: true,
        style: { transform: 'none', transformOrigin: 'top left' },
        includeQueryParams: true,
        // The mark is drawn into the resulting bitmap below. Removing it from
        // the DOM clone avoids a double logo in browsers that do capture imgs.
        filter: node => !node.classList?.contains('share-card-logo'),
      })
    return composeShareImageWithLogo(cardDataUrl, lionLogo, canvas)
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
      <div
        className="workout-share-preview-area"
        data-nodrag
        onTouchStart={event => startLayoutSwipe(event.touches[0].clientX, event.touches[0].clientY)}
        onTouchEnd={event => finishLayoutSwipe(event.changedTouches[0].clientX, event.changedTouches[0].clientY)}
        onMouseDown={event => startLayoutSwipe(event.clientX, event.clientY)}
        onMouseUp={event => finishLayoutSwipe(event.clientX, event.clientY)}
      >
        <div ref={outerRef} className="workout-share-scaler-outer">
          <div className="workout-share-scaler-inner">
            <div className="workout-share-card-transition" key={activeLayout.id}>
              <WorkoutStoryPreview w={w} st={st} innerRef={canvasRef} themeId="t1" layoutId={activeLayout.id} />
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <FppActionFeedback state="error" className="workout-share-error">{error}</FppActionFeedback>
      )}

      {/* Pinned action buttons */}
      <div className="workout-share-actions">
        <div className="workout-share-layout-picker" role="tablist" aria-label="Estilos de compartilhamento" data-nodrag>
          <span className="workout-share-layout-name" aria-live="polite">{activeLayout.name}</span>
          <div className="workout-share-layout-dots">
            {WORKOUT_SHARE_LAYOUTS.map((layout, index) => (
              <button
                key={layout.id}
                type="button"
                role="tab"
                aria-selected={index === layoutIndex}
                aria-label={`Selecionar estilo ${layout.name}`}
                className="workout-share-layout-dot"
                onClick={() => selectLayout(index)}
              >
                <span className="sr-only">{layout.name}</span>
              </button>
            ))}
          </div>
        </div>
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
