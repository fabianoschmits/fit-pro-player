import { useState, useRef, useEffect } from 'react'
import { toPng } from 'html-to-image'
import { t } from '../lib/i18n.js'
import { EXIDX, exerciseName } from '../lib/exercises.js'
import { fmtDate, fmtVol, fmtDur } from '../lib/format.js'
import { useStore } from '../store/useStore.js'
import { loadOfWorkouts } from '../lib/muscles.js'
import { Button } from './ui.jsx'

// Inline SVG silhouette — avoids html-to-image cross-origin/lazy-load issues
function BodySilhouette({ gender }) {
  if (gender === 'female') {
    return (
      <svg viewBox="0 0 200 500" xmlns="http://www.w3.org/2000/svg" fill="white" style={{ width: '100%', height: '100%' }}>
        <ellipse cx="100" cy="38" rx="28" ry="34" />
        <rect x="88" y="68" width="24" height="18" rx="4" />
        <ellipse cx="58" cy="92" rx="22" ry="13" />
        <ellipse cx="142" cy="92" rx="22" ry="13" />
        <path d="M70 85 Q58 122 62 164 Q72 188 100 190 Q128 188 138 164 Q142 122 130 85 Z" />
        <path d="M62 164 Q50 200 54 222 Q68 244 100 245 Q132 244 146 222 Q150 200 138 164 Z" />
        <path d="M58 88 Q32 108 25 148 Q21 170 28 192 Q35 180 39 158 Q45 124 62 102 Z" />
        <path d="M142 88 Q168 108 175 148 Q179 170 172 192 Q165 180 161 158 Q155 124 138 102 Z" />
        <path d="M28 192 Q20 224 22 250 Q29 240 33 218 Q36 202 35 190 Z" />
        <path d="M172 192 Q180 224 178 250 Q171 240 167 218 Q164 202 165 190 Z" />
        <path d="M54 222 Q44 268 47 314 Q58 304 62 268 Q66 242 65 222 Z" />
        <path d="M146 222 Q156 268 153 314 Q142 304 138 268 Q134 242 135 222 Z" />
        <path d="M47 314 Q42 368 44 400 Q56 390 58 354 Q60 326 57 312 Z" />
        <path d="M153 314 Q158 368 156 400 Q144 390 142 354 Q140 326 143 312 Z" />
        <ellipse cx="45" cy="410" rx="15" ry="10" />
        <ellipse cx="155" cy="410" rx="15" ry="10" />
      </svg>
    )
  }
  // Male (default)
  return (
    <svg viewBox="0 0 200 500" xmlns="http://www.w3.org/2000/svg" fill="white" style={{ width: '100%', height: '100%' }}>
      <ellipse cx="100" cy="36" rx="30" ry="35" />
      <rect x="86" y="68" width="28" height="16" rx="4" />
      <ellipse cx="54" cy="90" rx="26" ry="14" />
      <ellipse cx="146" cy="90" rx="26" ry="14" />
      <path d="M64 82 Q50 120 55 168 Q68 190 100 192 Q132 190 145 168 Q150 120 136 82 Z" />
      <path d="M55 168 Q46 198 50 218 Q65 238 100 240 Q135 238 150 218 Q154 198 145 168 Z" />
      <path d="M54 84 Q26 106 20 148 Q16 172 24 194 Q32 182 36 158 Q42 122 60 98 Z" />
      <path d="M146 84 Q174 106 180 148 Q184 172 176 194 Q168 182 164 158 Q158 122 140 98 Z" />
      <path d="M24 194 Q15 228 17 256 Q26 243 30 220 Q33 203 32 192 Z" />
      <path d="M176 194 Q185 228 183 256 Q174 243 170 220 Q167 203 168 192 Z" />
      <path d="M50 218 Q40 268 44 318 Q56 308 60 270 Q64 242 64 218 Z" />
      <path d="M150 218 Q160 268 156 318 Q144 308 140 270 Q136 242 136 218 Z" />
      <path d="M44 318 Q38 372 41 404 Q54 394 57 356 Q59 328 55 316 Z" />
      <path d="M156 318 Q162 372 159 404 Q146 394 143 356 Q141 328 145 316 Z" />
      <ellipse cx="42" cy="414" rx="17" ry="11" />
      <ellipse cx="158" cy="414" rx="17" ry="11" />
    </svg>
  )
}

function WorkoutStoryPreview({ w, st }) {
  const dur = w.end - w.start
  const setsCount = w.entries.reduce((acc, e) => acc + (e.sets ? e.sets.length : 0), 0)
  const fewExercises = w.entries.length < 5

  return (
    <div className="workout-story-preview">
      {/* Silhouette — full bleed background */}
      <div className="workout-story-bg-body" aria-hidden="true">
        <BodySilhouette gender={st.body || 'male'} />
      </div>

      <div className="workout-story-content">
        {/* Logo image (lion mascot) */}
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

        {/* Stats */}
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
        <div
          className="workout-story-exercises"
          data-few={fewExercises ? 'true' : 'false'}
        >
          {w.entries.slice(0, 8).map((e, idx) => {
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
        <div className="workout-story-footer">fitproplayer.app</div>
      </div>
    </div>
  )
}

// ─── helper: dataURL → File object ─────────────────────────────────────────
async function dataUrlToFile(dataUrl, name) {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return new File([blob], name, { type: 'image/png' })
}

export function WorkoutShareModal({ w, onClose }) {
  const st = useStore(s => s.S)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const previewRef = useRef(null)
  const outerRef = useRef(null)

  // Scale canvas to fill the outer container
  useEffect(() => {
    if (!outerRef.current || !previewRef.current) return
    const obs = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width
      if (width > 0) {
        previewRef.current.style.transform = `scale(${width / 1080})`
        previewRef.current.style.transformOrigin = 'top left'
      }
    })
    obs.observe(outerRef.current)
    return () => obs.disconnect()
  }, [])

  // ── Generate PNG from the 1080×1920 canvas ────────────────────────────────
  const generateImage = async () => {
    if (!previewRef.current) return null
    setGenerating(true)
    setError(null)
    try {
      // Reset scale to 1 before capture so html-to-image sees true size
      const prev = previewRef.current.style.transform
      previewRef.current.style.transform = 'scale(1)'
      await new Promise(r => setTimeout(r, 150)) // let paint settle

      const dataUrl = await toPng(previewRef.current, {
        width: 1080,
        height: 1920,
        pixelRatio: 1,
        cacheBust: true,
        backgroundColor: '#080a0b',
      })

      // Restore visual scale
      previewRef.current.style.transform = prev
      return dataUrl
    } catch (err) {
      console.error('[share] generate error:', err)
      setError(t('Erro ao gerar imagem. Tente novamente.'))
      return null
    } finally {
      setGenerating(false)
    }
  }

  // ── Download to device (universal fallback) ───────────────────────────────
  const download = (dataUrl) => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `treino-fpp-${w.id || Date.now()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // ── Native share via Web Share API or Capacitor ───────────────────────────
  const share = async (dataUrl) => {
    const fileName = `treino-fpp-${w.id || Date.now()}.png`
    const shareTitle = 'Meu treino no Fit Pro Player 💪'

    // 1) Try Capacitor native (Android/iOS app)
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
        await CapShare.share({
          title: shareTitle,
          url: saved.uri,
          dialogTitle: t('Compartilhar treino'),
        })
        return
      }
    } catch (_) { /* not native */ }

    // 2) Try Web Share API with file (Chrome Android, Safari iOS on PWA)
    try {
      const file = await dataUrlToFile(dataUrl, fileName)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: shareTitle, files: [file] })
        return
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.warn('[share] Web Share API failed:', e)
      } else {
        return // user cancelled — do nothing
      }
    }

    // 3) Fallback: download
    download(dataUrl)
  }

  const onShare = async (platform) => {
    const dataUrl = await generateImage()
    if (!dataUrl) return
    if (platform === 'download') {
      download(dataUrl)
    } else {
      await share(dataUrl)
    }
  }

  return (
    <div className="workout-share-sheet">
      {/* No title text — sheet handle is enough */}

      {/* Story preview */}
      <div className="workout-share-preview-area">
        <div ref={outerRef} className="workout-share-scaler-outer">
          <div className="workout-share-scaler-inner">
            <div ref={previewRef} className="workout-story-canvas">
              <WorkoutStoryPreview w={w} st={st} />
            </div>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div style={{ padding: '8px 20px', color: 'var(--red)', fontSize: 13, textAlign: 'center' }}>
          {error}
        </div>
      )}

      {/* Action buttons — pinned at bottom */}
      <div className="workout-share-actions">
        <Button
          variant="primary"
          onClick={() => onShare('native')}
          disabled={generating}
          className="share-btn-ig"
        >
          {generating ? t('Gerando...') : t('Instagram Stories')}
        </Button>
        <div className="workout-share-row">
          <Button
            variant="secondary"
            onClick={() => onShare('native')}
            disabled={generating}
            className="share-btn-wa"
          >
            {t('WhatsApp')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => onShare('download')}
            disabled={generating}
          >
            {t('Salvar')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onShare('native')}
            disabled={generating}
          >
            {t('Mais')}
          </Button>
        </div>
      </div>
    </div>
  )
}
