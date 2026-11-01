import { useState, useRef, useEffect } from 'react'
import { toPng } from 'html-to-image'
import { t } from '../lib/i18n.js'
import { useStore } from '../store/useStore.js'

import './BodyMap.jsx'
import './Icon.jsx'
import { Button } from './ui.jsx'
import '../workout-themes.css'
import '../workout-share-layouts.css'
import { LayoutDashboard as ShareCardLayout, WORKOUT_SHARE_LAYOUTS } from './WorkoutShareLayouts.jsx'
import { shareWorkoutImage } from '../lib/workout-share.js'
import { FppActionFeedback } from './FppFeedback.jsx'

// The Dashboard layout is the default "gamer card" layout


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

  const marks = Array.isArray(logo) ? logo : [logo]
  const cardBounds = card.getBoundingClientRect()
  if (!cardBounds.width || !cardBounds.height) return cardDataUrl

  try {
    const exportedCard = await loadImage(cardDataUrl)
    const output = createCanvas()
    output.width = 1080
    output.height = 1920
    const context = output.getContext('2d')
    if (!context) throw new Error('Image canvas unavailable')

    // Downsample the 2x capture with high-quality filtering. PNG itself is
    // lossless: its quality improves through rasterization, not a JPEG quality flag.
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'

    const scaleX = 1080 / cardBounds.width
    const scaleY = 1920 / cardBounds.height
    context.drawImage(exportedCard, 0, 0, 1080, 1920)
    for (const mark of marks) {
      const bounds = mark.getBoundingClientRect()
      if (!bounds.width || !bounds.height) continue
      // Preserve object-fit: contain for square sprite frames and the lion.
      const fit = mark.naturalWidth && mark.naturalHeight
        ? Math.min(bounds.width / mark.naturalWidth, bounds.height / mark.naturalHeight) : 1
      const width = mark.naturalWidth ? mark.naturalWidth * fit : bounds.width
      const height = mark.naturalHeight ? mark.naturalHeight * fit : bounds.height
      context.globalCompositeOperation = mark.classList?.contains('share-highlight-sprite') ? 'screen' : 'source-over'
      context.drawImage(mark,
        (bounds.left - cardBounds.left + (bounds.width - width) / 2) * scaleX,
        (bounds.top - cardBounds.top + (bounds.height - height) / 2) * scaleY,
        width * scaleX, height * scaleY)
    }
    return output.toDataURL('image/png')
  } catch (cause) {
    // Do not silently share the oversized intermediate image without its marks.
    throw new Error('Unable to finish share image', { cause })
  }
}

// ── Main modal component ───────────────────────────────────────────────────
export function WorkoutShareModal({ w }) {
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
    if (operation.current) return
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
    await new Promise((resolve, reject) => {
      const started = performance.now()
      const check = () => {
        if (!canvas.querySelector('[data-share-loading="true"]')) return resolve()
        if (performance.now() - started > 10000) return reject(new Error('Exercise image is still loading'))
        requestAnimationFrame(check)
      }
      check()
    })
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

    const marks = [...canvas.querySelectorAll('.share-card-logo, .share-highlight-sprite')]
    const opacity = marks.map(mark => mark.style.opacity)
    let cardDataUrl
    try {
      // Preserve layout space in the clone; draw raster assets directly into
      // the PNG to avoid the mobile webview's missing-image capture bug.
      marks.forEach(mark => { mark.style.opacity = '0' })
      cardDataUrl = await toPng(canvas, {
        width: 1080,
        height: 1920,
        pixelRatio: 2,
        cacheBust: true,
        style: { transform: 'none', transformOrigin: 'top left' },
        includeQueryParams: true,
      })
    } finally {
      marks.forEach((mark, index) => { mark.style.opacity = opacity[index] })
    }
    return composeShareImageWithLogo(cardDataUrl, marks, canvas)
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
