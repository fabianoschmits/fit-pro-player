import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'

export default function AppStatus() {
  const sync = useStore(s => s.accountSync), persistence = useStore(s => s.persistence)
  const pending = useStore(s => s.S.pendingProfessionalEvents?.length || 0)
  const blocked = useStore(s => s.S.pendingProfessionalEvents?.some(event => event.blocked) || false)
  const [online, setOnline] = useState(navigator.onLine !== false)
  const [update, setUpdate] = useState(false)
  const [updateDismissed, setUpdateDismissed] = useState(false)
  const asideRef = useRef(null)

  useEffect(() => {
    const change = () => setOnline(navigator.onLine !== false)
    const available = () => { setUpdate(true); setUpdateDismissed(false) }
    window.addEventListener('online', change)
    window.addEventListener('offline', change)
    window.addEventListener('fitproplayer:update-available', available)
    return () => {
      window.removeEventListener('online', change)
      window.removeEventListener('offline', change)
      window.removeEventListener('fitproplayer:update-available', available)
    }
  }, [])

  const state = persistence?.state === 'error' ? 'error'
    : sync?.state === 'CONFLICT' || sync?.state === 'conflict' ? 'conflict'
    : !online ? 'offline'
    : blocked ? 'blocked'
    : sync?.state === 'ERROR' ? 'sync-error'
    : pending ? 'pending'
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

  if (!state) return null
  const text = state === 'error' ? t('Data could not be saved on this device.')
    : state === 'conflict' ? t('Your devices have different changes. Review sync copies in Settings.')
    : state === 'offline' ? t('Offline — changes stay on this device until you reconnect.')
    : state === 'blocked' ? t('A professional update needs attention. Your workout remains saved on this device.')
    : state === 'sync-error' ? t('Could not sync. Your device copy is preserved.')
    : state === 'pending' ? t('{0} professional updates waiting to sync.', pending)
    : t('App update ready. It will be applied after your workout.')

  return <aside ref={asideRef} className="app-status app-status-global" data-state={state} role="status">
    <span className="status-dot" />
    <span>{text}</span>
    <a href="#/settings">{t('Settings')}</a>
    {state === 'update' && <button type="button" className="app-status-dismiss" aria-label={t('Close')} onClick={() => setUpdateDismissed(true)}>×</button>}
  </aside>
}
