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
import { LayoutMinimal, LayoutReceipt, LayoutBrutal, LayoutPolaroid } from './WorkoutShareLayouts.jsx'

const THEMES = [
  { id: 't1', name: 'Original', layout: 'dashboard' },
  { id: 't2', name: 'Minimal Light', layout: 'minimal' },
  { id: 't3', name: 'Luxury Gold', layout: 'minimal' },
  { id: 't4', name: 'Blood Sport', layout: 'brutal' },
  { id: 't5', name: 'Ocean', layout: 'dashboard' },
  { id: 't6', name: 'Forest', layout: 'polaroid' },
  { id: 't7', name: 'Sunset', layout: 'receipt' },
  { id: 't8', name: 'Midnight', layout: 'minimal' },
  { id: 't9', name: 'Neon Purple', layout: 'dashboard' },
  { id: 't10', name: 'High Contrast', layout: 'brutal' },
  { id: 't11', name: 'Mesh Glow', layout: 'dashboard' },
  { id: 't12', name: 'Synthwave', layout: 'receipt' },
  { id: 't13', name: 'Pure Dark', layout: 'brutal' },
  { id: 't14', name: 'Bubblegum', layout: 'polaroid' },
  { id: 't15', name: 'Military', layout: 'minimal' },
  { id: 't16', name: 'Royal', layout: 'receipt' },
  { id: 't17', name: 'Hacker', layout: 'brutal' },
  { id: 't18', name: 'Magma', layout: 'polaroid' },
  { id: 't19', name: 'Ice', layout: 'dashboard' },
  { id: 't20', name: 'Pastel', layout: 'minimal' },
  { id: 't21', name: 'Mono', layout: 'receipt' },
  { id: 't22', name: 'Deep Space', layout: 'polaroid' },
  { id: 't23', name: 'Toxic', layout: 'brutal' },
  { id: 't24', name: 'Desert', layout: 'minimal' },
  { id: 't25', name: 'Cyber Pink', layout: 'dashboard' },
  { id: 't26', name: 'Steel', layout: 'receipt' },
  { id: 't27', name: 'Bronze', layout: 'polaroid' },
  { id: 't28', name: 'Outrun', layout: 'brutal' },
  { id: 't29', name: 'Clean Blue', layout: 'minimal' },
  { id: 't30', name: 'OLED', layout: 'dashboard' }
]

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
  const theme = THEMES.find(t => t.id === themeId) || THEMES[0]
  if (theme.layout === 'minimal') return <LayoutMinimal w={w} st={st} innerRef={innerRef} themeId={themeId} />
  if (theme.layout === 'receipt') return <LayoutReceipt w={w} st={st} innerRef={innerRef} themeId={themeId} />
  if (theme.layout === 'brutal') return <LayoutBrutal w={w} st={st} innerRef={innerRef} themeId={themeId} />
  if (theme.layout === 'polaroid') return <LayoutPolaroid w={w} st={st} innerRef={innerRef} themeId={themeId} />
  return <LayoutDashboard w={w} st={st} innerRef={innerRef} themeId={themeId} />
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
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0].id)
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
        // The background color is now defined by the theme css
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
            <WorkoutStoryPreview w={w} st={st} innerRef={canvasRef} themeId={selectedTheme} />
          </div>
        </div>
      </div>

      {/* Theme selector */}
      <div className="workout-share-themes">
        <div className="workout-share-themes-scroll">
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`theme-btn ${t.id === selectedTheme ? 'active' : ''} ${t.id}`}
              onClick={() => setSelectedTheme(t.id)}
            >
              {t.name}
            </button>
          ))}
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
