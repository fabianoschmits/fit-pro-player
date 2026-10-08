import { useState, useRef, useEffect } from 'react'
import { toPng } from 'html-to-image'
import { t } from '../lib/i18n.js'
import { EXIDX, exerciseName } from '../lib/exercises.js'
import { fmtDate, fmtVol, fmtDur } from '../lib/format.js'
import { useStore } from '../store/useStore.js'
import { loadOfWorkouts, MUSCLES, levelsOf } from '../lib/muscles.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

// Inline body silhouette using SVG paths - avoids html-to-image cross-origin issues
// We use a simplified human body silhouette as an inline SVG background
function BodySilhouette({ gender }) {
  // Use a path string for a simplified body silhouette
  // This avoids the BodyMap lazy-loading issue with html-to-image
  const color = 'rgba(255,255,255,0.08)'
  if (gender === 'female') {
    return (
      <svg viewBox="0 0 200 480" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', fill: color }}>
        {/* Head */}
        <ellipse cx="100" cy="40" rx="28" ry="35" />
        {/* Neck */}
        <rect x="88" y="70" width="24" height="20" rx="4" />
        {/* Shoulders */}
        <ellipse cx="60" cy="95" rx="22" ry="14" />
        <ellipse cx="140" cy="95" rx="22" ry="14" />
        {/* Torso */}
        <path d="M68 88 Q58 120 62 160 Q72 185 100 190 Q128 185 138 160 Q142 120 132 88 Z" />
        {/* Hips */}
        <path d="M62 160 Q50 200 55 220 Q70 240 100 242 Q130 240 145 220 Q150 200 138 160 Z" />
        {/* Left arm */}
        <path d="M60 90 Q35 110 28 145 Q24 165 30 185 Q36 175 40 155 Q46 125 62 105 Z" />
        {/* Right arm */}
        <path d="M140 90 Q165 110 172 145 Q176 165 170 185 Q164 175 160 155 Q154 125 138 105 Z" />
        {/* Left forearm */}
        <path d="M30 185 Q22 215 24 240 Q30 230 34 210 Q36 195 36 183 Z" />
        {/* Right forearm */}
        <path d="M170 185 Q178 215 176 240 Q170 230 166 210 Q164 195 164 183 Z" />
        {/* Left thigh */}
        <path d="M55 220 Q45 265 48 310 Q58 300 62 265 Q66 240 65 220 Z" />
        {/* Right thigh */}
        <path d="M145 220 Q155 265 152 310 Q142 300 138 265 Q134 240 135 220 Z" />
        {/* Left leg */}
        <path d="M48 310 Q44 360 46 395 Q56 385 58 350 Q60 320 58 308 Z" />
        {/* Right leg */}
        <path d="M152 310 Q156 360 154 395 Q144 385 142 350 Q140 320 142 308 Z" />
        {/* Left foot */}
        <ellipse cx="48" cy="405" rx="14" ry="10" />
        {/* Right foot */}
        <ellipse cx="152" cy="405" rx="14" ry="10" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 200 480" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', fill: color }}>
      {/* Head */}
      <ellipse cx="100" cy="38" rx="30" ry="36" />
      {/* Neck */}
      <rect x="86" y="70" width="28" height="18" rx="4" />
      {/* Shoulders - wider for male */}
      <ellipse cx="55" cy="92" rx="26" ry="15" />
      <ellipse cx="145" cy="92" rx="26" ry="15" />
      {/* Torso - broader */}
      <path d="M64 84 Q52 120 56 165 Q68 188 100 190 Q132 188 144 165 Q148 120 136 84 Z" />
      {/* Hips - narrower than shoulders */}
      <path d="M56 165 Q48 195 52 215 Q66 235 100 236 Q134 235 148 215 Q152 195 144 165 Z" />
      {/* Left arm - bulkier */}
      <path d="M56 86 Q28 108 22 148 Q18 170 25 192 Q32 180 36 158 Q42 122 60 100 Z" />
      {/* Right arm */}
      <path d="M144 86 Q172 108 178 148 Q182 170 175 192 Q168 180 164 158 Q158 122 140 100 Z" />
      {/* Left forearm */}
      <path d="M25 192 Q16 225 18 252 Q26 240 30 218 Q33 200 32 190 Z" />
      {/* Right forearm */}
      <path d="M175 192 Q184 225 182 252 Q174 240 170 218 Q167 200 168 190 Z" />
      {/* Left thigh */}
      <path d="M52 215 Q42 265 45 315 Q57 305 60 268 Q64 240 64 215 Z" />
      {/* Right thigh */}
      <path d="M148 215 Q158 265 155 315 Q143 305 140 268 Q136 240 136 215 Z" />
      {/* Left calf */}
      <path d="M45 315 Q40 368 43 400 Q54 390 57 355 Q59 328 56 313 Z" />
      {/* Right calf */}
      <path d="M155 315 Q160 368 157 400 Q146 390 143 355 Q141 328 144 313 Z" />
      {/* Left foot */}
      <ellipse cx="44" cy="410" rx="16" ry="11" />
      {/* Right foot */}
      <ellipse cx="156" cy="410" rx="16" ry="11" />
    </svg>
  )
}

function WorkoutStoryPreview({ w, st }) {
  const dur = w.end - w.start
  const setsCount = w.entries.reduce((acc, e) => acc + (e.sets ? e.sets.length : 0), 0)
  const fewExercises = w.entries.length < 5

  return (
    <div className="workout-story-preview">
      {/* Inline SVG body silhouette — avoids cross-origin html-to-image issues */}
      <div className="workout-story-bg-body">
        <BodySilhouette gender={st.body || 'male'} />
      </div>

      <div className="workout-story-content">
        {/* Logo */}
        <div className="workout-story-logo">
          <img src="/brand-logo.png" alt="Fit Pro Player" />
        </div>

        {/* Title + meta */}
        <div className="workout-story-title-block">
          <h2>{t('Treino finalizado')}</h2>
          <div className="workout-story-meta">
            <span>{fmtDate(w.d, true)}</span>
            <span className="workout-story-meta-sep">·</span>
            <span>{fmtDur(dur)}</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="workout-story-stats">
          <div className="story-stat">
            <strong>{w.entries.length}</strong>
            <small>{t('Exercícios')}</small>
          </div>
          <div className="story-stat-divider" />
          <div className="story-stat">
            <strong>{setsCount}</strong>
            <small>{t('Séries')}</small>
          </div>
          {w.vol > 0 && <>
            <div className="story-stat-divider" />
            <div className="story-stat">
              <strong>{fmtVol(w.vol, st.unit)}</strong>
              <small>{t('Volume')}</small>
            </div>
          </>}
        </div>

        {/* Exercises */}
        <div className="workout-story-exercises" data-few={fewExercises ? 'true' : 'false'}>
          {w.entries.map((e, idx) => {
            const exData = EXIDX[e.id]
            const name = exData ? exerciseName(exData) : e.id
            const totalSets = e.sets ? e.sets.length : 0
            const maxReps = e.sets && e.sets.length
              ? Math.max(...e.sets.filter(s => s.r).map(s => s.r || 0))
              : 0
            return (
              <div key={idx} className="story-ex-row">
                <span className="story-ex-name">{name}</span>
                <span className="story-ex-sets">{totalSets}×{maxReps > 0 ? maxReps : '-'}</span>
              </div>
            )
          })}
          {w.entries.length > 8 && (
            <div className="story-ex-extra">+ {w.entries.length - 8} {t('exercícios')}</div>
          )}
        </div>

        {/* Footer */}
        <div className="workout-story-footer">
          fitproplayer.app
        </div>
      </div>
    </div>
  )
}

export function WorkoutShareModal({ w, onClose }) {
  const st = useStore(s => s.S)
  const [generating, setGenerating] = useState(false)
  const previewRef = useRef(null)      // the 1080×1920 canvas
  const outerRef = useRef(null)        // the visible scaler-outer box

  // Dynamically compute CSS scale so the canvas fills the outer box
  useEffect(() => {
    if (!outerRef.current || !previewRef.current) return
    const observer = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      if (w > 0) {
        previewRef.current.style.transform = `scale(${w / 1080})`
      }
    })
    observer.observe(outerRef.current)
    return () => observer.disconnect()
  }, [])


  const handleGenerateImage = async () => {
    if (!previewRef.current) return null
    try {
      setGenerating(true)
      await new Promise(r => setTimeout(r, 200))
      const dataUrl = await toPng(previewRef.current, {
        quality: 1,
        pixelRatio: 2,
        width: 1080,
        height: 1920,
        cacheBust: true
      })
      return dataUrl
    } catch (err) {
      console.error('Error generating image', err)
      return null
    } finally {
      setGenerating(false)
    }
  }

  const shareNative = async (dataUrl) => {
    try {
      const { Capacitor } = await import('@capacitor/core')
      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        const { Share } = await import('@capacitor/share')
        const base64Data = dataUrl.split(',')[1]
        const fileName = `treino-${w.id || Date.now()}.png`
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
        })
        await Share.share({
          title: t('Meu treino no Fit Pro Player'),
          url: savedFile.uri,
          dialogTitle: t('Compartilhar treino')
        })
        return
      }
      // Web fallback
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const file = new File([blob], `workout-${w.id || Date.now()}.png`, { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: t('Meu treino no Fit Pro Player'), files: [file] })
      } else {
        downloadFallback(dataUrl)
      }
    } catch (e) {
      downloadFallback(dataUrl)
    }
  }

  const downloadFallback = (dataUrl) => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `workout-${w.id || Date.now()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const onShare = async (platform) => {
    const dataUrl = await handleGenerateImage()
    if (!dataUrl) return
    if (platform === 'download') downloadFallback(dataUrl)
    else shareNative(dataUrl)
  }

  return (
    <div className="workout-share-sheet">
      {/* Title only — no X button, sheet drag handle handles close */}
      <div className="workout-share-title">
        <span>{t('Compartilhar treino')}</span>
      </div>

      {/* Preview container — fills remaining height */}
      <div className="workout-share-preview-area">
        <div ref={outerRef} className="workout-share-scaler-outer">
          <div className="workout-share-scaler-inner">
            <div ref={previewRef} className="workout-story-canvas">
              <WorkoutStoryPreview w={w} st={st} />
            </div>
          </div>
        </div>
      </div>

      {/* Buttons — always pinned to bottom, never scroll */}
      <div className="workout-share-actions">
        <Button
          variant="primary"
          onClick={() => onShare('instagram')}
          disabled={generating}
          className="share-btn-ig"
        >
          {generating ? t('Gerando...') : '📱 ' + t('Instagram Stories')}
        </Button>
        <div className="workout-share-row">
          <Button
            variant="secondary"
            onClick={() => onShare('whatsapp')}
            disabled={generating}
            className="share-btn-wa"
          >
            💬 {t('WhatsApp')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => onShare('download')}
            disabled={generating}
          >
            <Icon name="download" /> {t('Salvar')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onShare('other')}
            disabled={generating}
          >
            <Icon name="share" /> {t('Mais')}
          </Button>
        </div>
      </div>
    </div>
  )
}
