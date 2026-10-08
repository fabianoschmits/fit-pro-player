import { useState, useRef, useEffect } from 'react'
import { toPng } from 'html-to-image'
import { t } from '../lib/i18n.js'
import { EXIDX, exerciseName } from '../lib/exercises.js'
import { fmtDate, fmtVol, fmtDur } from '../lib/format.js'
import { useStore } from '../store/useStore.js'
import { loadOfWorkouts } from '../lib/muscles.js'
import BodyMap from './BodyMap.jsx'
import { Button } from './ui.jsx'

// Story preview — the actual 1080×1920 canvas content
function WorkoutStoryPreview({ w, st, innerRef }) {
  const dur = w.end - w.start
  const setsCount = w.entries.reduce((acc, e) => acc + (e.sets ? e.sets.length : 0), 0)
  const load = loadOfWorkouts([w])

  return (
    <div ref={innerRef} className="workout-story-canvas">
      {/* Background gradient */}
      <div className="wsc-bg" />

      {/* BodyMap — absolute background, full canvas, very faded */}
      <div className="wsc-bodymap-wrap">
        <BodyMap
          load={load}
          body={st.body || 'male'}
          view="front"
          decorative
          className="wsc-bodymap"
        />
      </div>

      {/* Logo — small, at the very top */}
      <div className="wsc-logo">
        <img src="/brand-logo.png" alt="Fit Pro Player" />
      </div>

      {/* "Treino finalizado" — right below logo */}
      <div className="wsc-title-block">
        <h2 className="wsc-title">{t('Treino finalizado')}</h2>
        <div className="wsc-meta">
          <span>{fmtDate(w.d, true)}</span>
          <span className="wsc-dot">·</span>
          <span>{fmtDur(dur)}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="wsc-stats">
        <div className="wsc-stat">
          <strong>{w.entries.length}</strong>
          <small>{t('Exercícios')}</small>
        </div>
        <div className="wsc-stat-sep" />
        <div className="wsc-stat">
          <strong>{setsCount}</strong>
          <small>{t('Séries')}</small>
        </div>
        {w.vol > 0 && <>
          <div className="wsc-stat-sep" />
          <div className="wsc-stat">
            <strong>{fmtVol(w.vol, st.unit)}</strong>
            <small>{t('Volume')}</small>
          </div>
        </>}
      </div>

      {/* Exercise list */}
      <div className="wsc-exercises" data-few={w.entries.length < 5 ? 'true' : 'false'}>
        {w.entries.slice(0, 8).map((e, idx) => {
          const exData = EXIDX[e.id]
          const name = exData ? exerciseName(exData) : e.id
          const totalSets = e.sets ? e.sets.length : 0
          const maxReps = e.sets && e.sets.length
            ? Math.max(...e.sets.filter(s => s.r).map(s => s.r || 0))
            : 0
          return (
            <div key={idx} className="wsc-ex-row">
              <span className="wsc-ex-name">{name}</span>
              <span className="wsc-ex-sets">{totalSets}×{maxReps > 0 ? maxReps : '-'}</span>
            </div>
          )
        })}
        {w.entries.length > 8 && (
          <div className="wsc-ex-extra">+ {w.entries.length - 8} {t('exercícios')}</div>
        )}
      </div>

      {/* Footer */}
      <div className="wsc-footer">fitpp.com.br</div>
    </div>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────
async function dataUrlToFile(dataUrl, name) {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return new File([blob], name, { type: 'image/png' })
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

    // Store current visual transform, reset to scale(1) so html-to-image sees full size
    const prevTransform = canvasRef.current.style.transform
    canvasRef.current.style.transform = 'scale(1)'

    // Wait for BodyMap SVG paths to be fully painted
    await new Promise(r => setTimeout(r, 400))

    try {
      const dataUrl = await toPng(canvasRef.current, {
        width: 1080,
        height: 1920,
        pixelRatio: 1,
        cacheBust: true,
        backgroundColor: '#06080a',
        // inline all styles so SVG colours are captured
        includeQueryParams: true,
      })
      return dataUrl
    } catch (err) {
      console.error('[share] toPng error:', err)
      setError(t('Não foi possível gerar a imagem. Tente novamente.'))
      return null
    } finally {
      // Restore visual scale
      canvasRef.current.style.transform = prevTransform
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

  // ── Share via native dialog ───────────────────────────────────────────────
  const shareNative = async (dataUrl) => {
    const fileName = `treino-fpp-${Date.now()}.png`
    const title = 'Meu treino no Fit Pro Player 💪'

    // 1) Capacitor native (Android / iOS app)
    try {
      const { Capacitor } = await import('@capacitor/core')
      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        const { Share: CapShare } = await import('@capacitor/share')
        const base64 = dataUrl.split(',')[1]
        const saved = await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        })
        await CapShare.share({ title, url: saved.uri, dialogTitle: t('Compartilhar treino') })
        return
      }
    } catch (_) { /* not native — continue */ }

    // 2) Web Share API with file attachment (PWA on Android/iOS)
    try {
      const file = await dataUrlToFile(dataUrl, fileName)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title, files: [file] })
        return
      }
    } catch (e) {
      if (e?.name === 'AbortError') return // user cancelled
      console.warn('[share] Web Share API failed:', e)
    }

    // 3) Fallback: just download
    saveToDevice(dataUrl)
  }

  const onShare = async (platform) => {
    const dataUrl = await generateImage()
    if (!dataUrl) return
    if (platform === 'save') saveToDevice(dataUrl)
    else shareNative(dataUrl)
  }

  return (
    <div className="workout-share-sheet">
      {/* Story preview frame */}
      <div className="workout-share-preview-area">
        <div ref={outerRef} className="workout-share-scaler-outer">
          <div className="workout-share-scaler-inner">
            <WorkoutStoryPreview w={w} st={st} innerRef={canvasRef} />
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
          {generating ? t('Gerando...') : t('Compartilhar')}
        </Button>
        <div className="workout-share-row">
          <Button
            variant="secondary"
            onClick={() => onShare('save')}
            disabled={generating}
          >
            {t('Salvar imagem')}
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
