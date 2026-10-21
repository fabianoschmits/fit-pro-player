import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'
import { FppStatusAnimation } from './FppFeedback.jsx'

export default function AppStatus() {
  const session = useStore(s => s.sessionRecovery)
  const [update, setUpdate] = useState(false)
  const [updateDismissed, setUpdateDismissed] = useState(false)
  const asideRef = useRef(null)

  useEffect(() => {
    const available = () => { setUpdate(true); setUpdateDismissed(false) }
    window.addEventListener('fitproplayer:update-available', available)
    return () => {
      window.removeEventListener('fitproplayer:update-available', available)
    }
  }, [])

  // Persistence and reconnect attempts run silently. A writer conflict still needs a choice.
  const state = session?.state === 'takeover-required' ? 'session-takeover'
    : session?.state === 'remote-active' ? 'session-remote-active'
    : update && !updateDismissed ? 'update'
    : null

  useEffect(() => {
    if (state !== 'update') return undefined
    const onPointerDown = event => {
      if (asideRef.current && !asideRef.current.contains(event.target)) setUpdateDismissed(true)
    }
    const timer = window.setTimeout(() => {
      document.addEventListener('click', onPointerDown, { capture: true })
      document.addEventListener('touchstart', onPointerDown, { capture: true })
    }, 0)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('click', onPointerDown, { capture: true })
      document.removeEventListener('touchstart', onPointerDown, { capture: true })
    }
  }, [state])

  const takeOverSession = () => useStore.getState().takeOverSessionRecovery()
  const replaceRemoteSession = () => useStore.getState().replaceRemoteActiveSession()

  if (!state) return null
  const text = ['session-takeover', 'session-remote-active'].includes(state) ? t('This workout is open on another device.')
    : t('App update ready. It will be applied after your workout.')

  return <aside ref={asideRef} className="app-status app-status-global" data-state={state} role="status">
    <FppStatusAnimation state="warning" />
    <span>{text}</span>
    {!state?.startsWith('session-') && <a href="#/settings">{t('Settings')}</a>}
    {state === 'session-takeover' && <Button size="sm" feedback="persistence" className="app-status-action" onAction={takeOverSession}>{t('Continue here')}</Button>}
    {state === 'session-remote-active' && <Button size="sm" feedback="persistence" className="app-status-action" onAction={replaceRemoteSession}>{t('Discard the running workout')}</Button>}
    {state === 'update' && <button type="button" className="app-status-dismiss" aria-label={t('Close')} onClick={() => setUpdateDismissed(true)}>×</button>}
  </aside>
}
