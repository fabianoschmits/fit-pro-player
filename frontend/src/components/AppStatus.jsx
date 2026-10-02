import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'

export default function AppStatus() {
  const sync = useStore(s => s.accountSync), persistence = useStore(s => s.persistence)
  const pending = useStore(s => s.S.pendingProfessionalEvents?.length || 0)
  const blocked = useStore(s => s.S.pendingProfessionalEvents?.some(event => event.blocked) || false)
  const [online, setOnline] = useState(navigator.onLine !== false), [update, setUpdate] = useState(false)
  useEffect(() => {
    const change = () => setOnline(navigator.onLine !== false), available = () => setUpdate(true)
    window.addEventListener('online', change); window.addEventListener('offline', change); window.addEventListener('fitproplayer:update-available', available)
    return () => { window.removeEventListener('online', change); window.removeEventListener('offline', change); window.removeEventListener('fitproplayer:update-available', available) }
  }, [])
  const state = persistence?.state === 'error' ? 'error' : sync?.state === 'CONFLICT' || sync?.state === 'conflict' ? 'conflict' : !online ? 'offline' : blocked ? 'blocked' : sync?.state === 'ERROR' ? 'sync-error' : pending ? 'pending' : update ? 'update' : null
  if (!state) return null
  const text = state === 'error' ? t('Data could not be saved on this device.') : state === 'conflict' ? t('Your devices have different changes. Review sync copies in Settings.') : state === 'offline' ? t('Offline — changes stay on this device until you reconnect.') : state === 'blocked' ? t('A professional update needs attention. Your workout remains saved on this device.') : state === 'sync-error' ? t('Could not sync. Your device copy is preserved.') : state === 'pending' ? t('{0} professional updates waiting to sync.', pending) : t('App update ready. It will be applied after your workout.')
  return <aside className="app-status app-status-global" data-state={state} role="status"><span className="status-dot" /><span>{text}</span><a href="#/settings">{t('Settings')}</a></aside>
}
