import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toPng } from 'html-to-image'
import { t } from '../lib/i18n.js'
import { EXIDX, exerciseName } from '../lib/exercises.js'
import { fmtDate, fmtVol, fmtDur } from '../lib/format.js'
import { useStore } from '../store/useStore.js'
import { loadOfWorkouts } from '../lib/muscles.js'
import BodyMap from './BodyMap.jsx'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

function WorkoutStoryPreview({ w, st }) {
  const load = loadOfWorkouts([w])
  const dur = w.end - w.start
  const setsCount = w.entries.reduce((acc, e) => acc + (e.sets ? e.sets.length : 0), 0)
  
  // Format the exercise list
  const maxExercises = 8
  const displayedExercises = w.entries.slice(0, maxExercises)
  const extraCount = w.entries.length - maxExercises

  return (
    <div id="workout-story-preview" className="workout-story-preview">
      {/* Background BodyMap */}
      <div className="workout-story-bg-body">
        <BodyMap load={load} body={st.body || 'male'} view="both" decorative />
      </div>

      <div className="workout-story-content">
        <div className="workout-story-header">
          <div className="workout-story-logo">FIT PRO PLAYER</div>
          <h2>{t('Treino finalizado')}</h2>
          <div className="workout-story-meta">
            <span>{fmtDate(w.d, true)}</span>
            <span>{fmtDur(dur)}</span>
          </div>
        </div>

        <div className="workout-story-stats">
          <div className="story-stat">
            <strong>{w.entries.length}</strong>
            <small>{t('Exercícios')}</small>
          </div>
          <div className="story-stat">
            <strong>{setsCount}</strong>
            <small>{t('Séries')}</small>
          </div>
          {w.vol > 0 && (
            <div className="story-stat">
              <strong>{fmtVol(w.vol, st.unit)}</strong>
              <small>{t('Volume')}</small>
            </div>
          )}
        </div>

        <div className="workout-story-exercises">
          {displayedExercises.map((e, idx) => {
            const exData = EXIDX[e.id]
            const name = exData ? exerciseName(exData) : e.id
            const totalSets = e.sets ? e.sets.length : 0
            const maxReps = e.sets && e.sets.length ? Math.max(...e.sets.filter(s => s.r).map(s => s.r || 0)) : 0
            
            return (
              <div key={idx} className="story-ex-row">
                <div className="story-ex-name">{name}</div>
                <div className="story-ex-sets">{totalSets} × {maxReps > 0 ? maxReps : '-'}</div>
              </div>
            )
          })}
          {extraCount > 0 && (
            <div className="story-ex-row story-ex-extra">
              + {t('{0} exercícios', extraCount)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function WorkoutShareModal({ w, onClose }) {
  const st = useStore(s => s.S)
  const [generating, setGenerating] = useState(false)
  const previewRef = useRef(null)

  const handleGenerateImage = async () => {
    if (!previewRef.current) return null
    try {
      setGenerating(true)
      // Small delay to ensure styles and fonts are applied
      await new Promise(r => setTimeout(r, 300))
      const dataUrl = await toPng(previewRef.current, {
        quality: 1,
        pixelRatio: 1, // Fixes issues on high-DPI screens generating oversized/blank images
        width: 1080,
        height: 1920,
        cacheBust: true,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          margin: '0'
        }
      })
      return dataUrl
    } catch (err) {
      console.error('Error generating image', err)
      return null
    } finally {
      setGenerating(false)
    }
  }

  const shareNative = async (dataUrl, intent) => {
    try {
      // Check if we are running natively via Capacitor
      const { Capacitor } = await import('@capacitor/core')
      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        const { Share } = await import('@capacitor/share')
        
        // Write the base64 image data to a temporary file
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
      
      // Fallback for Web/PWA
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const file = new File([blob], `workout-${w.id || Date.now()}.png`, { type: 'image/png' })
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: t('Meu treino no Fit Pro Player'),
          files: [file]
        })
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

    if (platform === 'download') {
      downloadFallback(dataUrl)
    } else {
      shareNative(dataUrl, platform)
    }
  }

  return (
    <AnimatePresence>
      <motion.div 
        className="workout-share-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      >
        <motion.div 
          className="workout-share-modal"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ duration: 0.3, type: 'spring', bounce: 0 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="workout-share-header">
            <button className="iconbtn" onClick={onClose} aria-label={t('Close')}>
              <Icon name="xmark" />
            </button>
            <h3>{t('Compartilhar treino')}</h3>
            <div style={{ width: 44 }} /> {/* balance */}
          </div>

          <div className="workout-share-preview-container">
            <div className="workout-share-preview-scaler">
              {/* This wrapper is the one converted to image */}
              <div ref={previewRef} className="workout-story-wrapper">
                <WorkoutStoryPreview w={w} st={st} />
              </div>
            </div>
          </div>

          <div className="workout-share-actions">
            <Button 
              variant="primary" 
              icon="instagram" 
              onClick={() => onShare('instagram')}
              disabled={generating}
              className="share-btn-ig"
            >
              {generating ? t('Gerando...') : t('Instagram Stories')}
            </Button>
            
            <div className="workout-share-row">
              <Button 
                variant="secondary" 
                icon="messageCircle" 
                onClick={() => onShare('whatsapp')}
                disabled={generating}
                className="share-btn-wa"
              >
                {t('WhatsApp')}
              </Button>
              
              <Button 
                variant="secondary" 
                icon="download" 
                onClick={() => onShare('download')}
                disabled={generating}
              >
                {t('Salvar')}
              </Button>
              
              <Button 
                variant="ghost" 
                icon="share" 
                onClick={() => onShare('other')}
                disabled={generating}
              >
                {t('Mais...')}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
