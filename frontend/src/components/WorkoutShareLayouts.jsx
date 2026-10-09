import React from 'react'
import { t } from '../lib/i18n.js'
import { EXIDX, exerciseName } from '../lib/exercises.js'
import { fmtDate, fmtVol, fmtDur } from '../lib/format.js'
import { loadOfWorkouts } from '../lib/muscles.js'
import BodyMap from './BodyMap.jsx'
import Icon from './Icon.jsx'

// Shared helper
function getStats(w) {
  const dur = w.end - w.start
  const setsCount = w.entries.reduce((acc, e) => acc + (e.sets ? e.sets.length : 0), 0)
  const load = loadOfWorkouts([w])
  return { dur, setsCount, load }
}

// ── LAYOUT 1: MINIMAL ───────────────────────────────────────────────────────
// Centered, very clean, lots of whitespace.
export function LayoutMinimal({ w, st, innerRef, themeId }) {
  const { dur, setsCount, load } = getStats(w)

  return (
    <div ref={innerRef} className={`workout-story-canvas layout-minimal ${themeId}`}>
      <div className="wsc-bg" />
      <div className="wsc-bodymap-wrap">
        <BodyMap load={load} body={st.body || 'male'} view="front" decorative className="wsc-bodymap" />
      </div>

      <div className="lm-content">
        <div className="lm-logo"><img src="/brand-logo.png" alt="Logo" /></div>
        
        <div className="lm-header">
          <p className="lm-date">{fmtDate(w.d, true)}</p>
          <h2 className="lm-title">{t('Treino Finalizado')}</h2>
          <p className="lm-dur">{fmtDur(dur)}</p>
        </div>

        <div className="lm-stats">
          <div className="lm-stat">
            <span className="lm-val">{w.entries.length}</span>
            <span className="lm-lbl">{t('Exercícios')}</span>
          </div>
          <div className="lm-stat">
            <span className="lm-val">{setsCount}</span>
            <span className="lm-lbl">{t('Séries')}</span>
          </div>
          {w.vol > 0 && (
            <div className="lm-stat">
              <span className="lm-val">{fmtVol(w.vol, st.unit)}</span>
              <span className="lm-lbl">{t('Volume')}</span>
            </div>
          )}
        </div>

        <div className="lm-exercises">
          {w.entries.slice(0, 6).map((e, idx) => {
            const exData = EXIDX[e.id]
            const name = exData ? exerciseName(exData) : e.id
            const totalSets = e.sets ? e.sets.length : 0
            return (
              <div key={idx} className="lm-ex-row">
                <span className="lm-ex-name">{name}</span>
                <span className="lm-ex-sets">{totalSets} {t('séries')}</span>
              </div>
            )
          })}
          {w.entries.length > 6 && <div className="lm-ex-more">+ {w.entries.length - 6}</div>}
        </div>

        <div className="lm-footer">FITPPLAYER.COM.BR</div>
      </div>
    </div>
  )
}

// ── LAYOUT 2: RECEIPT ───────────────────────────────────────────────────────
// Looks like a printed store receipt. Monospaced vibe.
export function LayoutReceipt({ w, st, innerRef, themeId }) {
  const { dur, setsCount, load } = getStats(w)

  return (
    <div ref={innerRef} className={`workout-story-canvas layout-receipt ${themeId}`}>
      <div className="wsc-bg" />
      
      <div className="lr-paper">
        <div className="lr-logo"><img src="/brand-logo.png" alt="Logo" /></div>
        <div className="lr-header">
          <h2>FIT PRO PLAYER</h2>
          <p>--------------------------------</p>
          <p>RECIBO DE TREINO</p>
          <p>DATA: {fmtDate(w.d, true)}</p>
          <p>TEMPO: {fmtDur(dur)}</p>
          <p>--------------------------------</p>
        </div>

        <div className="lr-stats">
          <div className="lr-row"><span>EXERCÍCIOS:</span><span>{w.entries.length}</span></div>
          <div className="lr-row"><span>SÉRIES:</span><span>{setsCount}</span></div>
          {w.vol > 0 && <div className="lr-row"><span>VOLUME:</span><span>{fmtVol(w.vol, st.unit)}</span></div>}
        </div>

        <p className="lr-divider">--------------------------------</p>

        <div className="lr-exercises">
          {w.entries.slice(0, 8).map((e, idx) => {
            const exData = EXIDX[e.id]
            const name = exData ? exerciseName(exData) : e.id
            const totalSets = e.sets ? e.sets.length : 0
            return (
              <div key={idx} className="lr-ex-row">
                <span className="lr-ex-name">{name}</span>
                <span className="lr-ex-sets">x{totalSets}</span>
              </div>
            )
          })}
        </div>

        <p className="lr-divider">--------------------------------</p>
        <div className="lr-footer">
          <p>OBRIGADO POR TREINAR!</p>
          <p>FITPPLAYER.COM.BR</p>
        </div>
      </div>
    </div>
  )
}

// ── LAYOUT 3: BRUTALISM ─────────────────────────────────────────────────────
// Huge typography, sharp edges, no padding, aggressive.
export function LayoutBrutal({ w, st, innerRef, themeId }) {
  const { dur, setsCount, load } = getStats(w)

  return (
    <div ref={innerRef} className={`workout-story-canvas layout-brutal ${themeId}`}>
      <div className="wsc-bg" />
      
      <div className="lb-bodymap-wrap">
        <BodyMap load={load} body={st.body || 'male'} view="front" decorative className="lb-bodymap" />
      </div>

      <div className="lb-content">
        <div className="lb-top">
          <img src="/brand-logo.png" alt="Logo" className="lb-logo" />
          <h1 className="lb-title">TREINO<br/>FEITO.</h1>
        </div>

        <div className="lb-marquee">
          <span>{fmtDate(w.d, true).toUpperCase()} // {fmtDur(dur)} // </span>
        </div>

        <div className="lb-stats">
          <div className="lb-stat">
            <div className="lb-val">{w.entries.length}</div>
            <div className="lb-lbl">EX</div>
          </div>
          <div className="lb-stat">
            <div className="lb-val">{setsCount}</div>
            <div className="lb-lbl">SÉRIES</div>
          </div>
          {w.vol > 0 && (
            <div className="lb-stat">
              <div className="lb-val">{fmtVol(w.vol, st.unit)}</div>
              <div className="lb-lbl">KG</div>
            </div>
          )}
        </div>

        <div className="lb-exercises">
          {w.entries.slice(0, 6).map((e, idx) => {
            const exData = EXIDX[e.id]
            const name = exData ? exerciseName(exData) : e.id
            const totalSets = e.sets ? e.sets.length : 0
            return (
              <div key={idx} className="lb-ex-row">
                <div className="lb-ex-sets">{totalSets}</div>
                <div className="lb-ex-name">{name}</div>
              </div>
            )
          })}
        </div>
        
        <div className="lb-footer">FITPPLAYER.COM.BR</div>
      </div>
    </div>
  )
}

// ── LAYOUT 4: POLAROID ──────────────────────────────────────────────────────
// Looks like an instant photo of the bodymap with scribbled text below.
export function LayoutPolaroid({ w, st, innerRef, themeId }) {
  const { dur, setsCount, load } = getStats(w)

  return (
    <div ref={innerRef} className={`workout-story-canvas layout-polaroid ${themeId}`}>
      <div className="wsc-bg" />
      
      <div className="lp-frame">
        <div className="lp-photo">
          <BodyMap load={load} body={st.body || 'male'} view="front" decorative className="lp-bodymap" />
          <div className="lp-photo-overlay">
            <img src="/brand-logo.png" alt="Logo" />
          </div>
        </div>
        
        <div className="lp-text">
          <h2 className="lp-title">{t('Treino Finalizado')}</h2>
          <p className="lp-date">{fmtDate(w.d, true)} - {fmtDur(dur)}</p>
          
          <div className="lp-stats">
            <span>{w.entries.length} Ex</span>
            <span>{setsCount} Séries</span>
            {w.vol > 0 && <span>{fmtVol(w.vol, st.unit)} Vol</span>}
          </div>

          <div className="lp-exercises">
            {w.entries.slice(0, 4).map((e, idx) => {
              const exData = EXIDX[e.id]
              const name = exData ? exerciseName(exData) : e.id
              return <div key={idx} className="lp-ex">• {name}</div>
            })}
            {w.entries.length > 4 && <div className="lp-ex">...e mais {w.entries.length - 4}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
