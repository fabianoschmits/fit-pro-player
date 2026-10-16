import Icon from './Icon.jsx'
import { useEffect, useState } from 'react'
import { t } from '../lib/i18n.js'
import { isFppBusy } from './useFppAction.js'

export function FppStatusAnimation({ state = 'idle', className = '' }) {
  const icon = state === 'success' ? 'check' : state === 'error' ? 'xmark' : state === 'offline' ? 'globe' : 'info'
  if (isFppBusy(state)) return <span className={`fpp-status-animation fpp-status-busy ${className}`} data-state={state} aria-hidden="true"><span /></span>
  if (!['success', 'error', 'offline', 'warning'].includes(state)) return null
  return <span className={`fpp-status-animation ${className}`} data-state={state} aria-hidden="true"><Icon name={icon} /></span>
}

export function FppProgress({ value, max = 100, label = t('Loading…'), indeterminate = value == null, className = '', ...rest }) {
  const limit = Number.isFinite(max) && max > 0 ? max : 100
  const current = Math.min(limit, Math.max(0, Number(value) || 0))
  return <div {...rest} className={`fpp-progress ${className}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={indeterminate ? undefined : current} data-indeterminate={indeterminate || undefined}>
    <span className="fpp-progress-fill" style={indeterminate ? undefined : { transform: `scaleX(${current / limit})` }} />
  </div>
}

export function FppSkeleton({ label = t('Loading…'), rows = 3, className = '', ...rest }) {
  const count = Math.max(1, Math.min(12, Math.floor(Number(rows) || 3)))
  return <div {...rest} className={`fpp-skeleton ${className}`} role="status" aria-label={label} aria-busy="true">
    {Array.from({ length: count }, (_, index) => <div className="fpp-skeleton-row" key={index} aria-hidden="true"><span className="fpp-skeleton-glyph" /><span className="fpp-skeleton-copy"><span /><span /></span></div>)}
  </div>
}

export function FppActionFeedback({ state = 'idle', children, className = '', ...rest }) {
  return <div {...rest} className={`fpp-action-feedback ${className}`} data-state={state} role="status" aria-live="polite" aria-atomic="true" aria-busy={isFppBusy(state) || undefined}>
    <FppStatusAnimation state={state} />{children && <span>{children}</span>}
  </div>
}

export function FppSpinner({ label = t('Loading…'), className = '', ...rest }) {
  return <span {...rest} className={`fpp-spinner ${className}`} role="status" aria-label={label}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /></svg></span>
}

export function FppToast({ message, tone = 'neutral', id = 'toast' }) {
  const [shown, setShown] = useState(() => ({ message, tone }))
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (message) {
      setShown({ message, tone })
      setLeaving(false)
      return undefined
    }
    if (!shown.message) return undefined
    setLeaving(true)
    const timer = setTimeout(() => { setShown({ message: '', tone: 'neutral' }); setLeaving(false) }, 180)
    return () => clearTimeout(timer)
  }, [message, tone, shown.message])
  const state = shown.tone === 'neutral' ? 'idle' : shown.tone
  return <div id={id} className={`${shown.message && !leaving ? 'show ' : ''}${leaving ? 'is-leaving ' : ''}fpp-toast`} data-tone={shown.tone} role="status" aria-live="polite" aria-atomic="true">
    {shown.message && <><FppStatusAnimation state={state} /><span>{shown.message}</span></>}
  </div>
}
