import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'
import { FppStatusAnimation } from './FppFeedback.jsx'

export default function AppStatus() {
  const persistence = useStore(s => s.persistence)
  const accountSync = useStore(s => s.accountSync)
  const session = useStore(s => s.sessionRecovery)
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
    : session?.state === 'takeover-required' ? 'session-takeover'
    : session?.state === 'remote-active' ? 'session-remote-active'
    : session?.state === 'auth-required' ? 'session-auth'
    : session?.state === 'failed' ? 'session-error'
    : session?.state === 'waiting' ? 'session-waiting'
    : session?.state === 'saving' ? 'session-saving'
    : !online ? 'offline'
    : accountSync?.state === 'error' ? 'account-error'
    : accountSync?.state === 'saving' ? 'account-saving'
    : accountSync?.pending ? 'account-pending'
    : blocked ? 'blocked'
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

  const retrySession = () => useStore.getState().flushSessionRecovery()
  const takeOverSession = () => useStore.getState().takeOverSessionRecovery()
  const replaceRemoteSession = () => useStore.getState().replaceRemoteActiveSession()

  if (!state) return null
  const text = state === 'error' ? t('Data could not be saved on this device.')
    : state === 'session-takeover' ? t('This workout is open on another device. Continue it here to send your changes.')
    : state === 'session-remote-active' ? `${t('This workout is open on another device.')} ${t('This workout could not be sent. Your changes remain on this device.')}`
    : state === 'session-auth' ? t('Sign in again to send this workout.')
    : state === 'session-error' ? t('This workout could not be sent. Your changes remain on this device.')
    : state === 'session-waiting' ? t('Workout waiting to send. It will retry when the connection returns.')
    : state === 'session-saving' ? t('Saving workout…')
    : state === 'offline' ? t('Offline — changes stay on this device until you reconnect.')
    : state === 'account-error' ? t('Could not sync. Your device copy is preserved.')
    : state === 'account-saving' ? t('Syncing…')
    : state === 'account-pending' ? t('Changes waiting to sync')
    : state === 'blocked' ? t('A professional update needs attention. Your workout remains saved on this device.')
    : state === 'pending' ? t('{0} professional updates waiting to sync.', pending)
    : t('App update ready. It will be applied after your workout.')

  return <aside ref={asideRef} className="app-status app-status-global" data-state={state} role="status">
    <FppStatusAnimation state={state === 'offline' ? 'offline' : ['error', 'account-error'].includes(state) ? 'error' : 'warning'} />
    <span>{text}</span>
    {!state?.startsWith('session-') && <a href="#/settings">{t('Settings')}</a>}
    {['session-waiting', 'session-error', 'session-auth'].includes(state) && <Button size="sm" className="app-status-action" onAction={retrySession} loadingLabel={t('Saving…')} successLabel={t('Salvo')}>{t('Try again')}</Button>}
    {['account-error', 'account-pending'].includes(state) && <Button size="sm" className="app-status-action" onAction={() => useStore.getState().retryAccountSync?.()} loadingLabel={t('Syncing…')} successLabel={t('Saved')}>{t('Try again')}</Button>}
    {state === 'session-takeover' && <Button size="sm" className="app-status-action" onAction={takeOverSession} loadingLabel={t('Saving…')} successLabel={t('Salvo')}>{t('Continue here')}</Button>}
    {state === 'session-remote-active' && <Button size="sm" className="app-status-action" onAction={replaceRemoteSession} loadingLabel={t('Saving…')} successLabel={t('Salvo')}>{t('Discard the running workout')}</Button>}
    {state === 'update' && <button type="button" className="app-status-dismiss" aria-label={t('Close')} onClick={() => setUpdateDismissed(true)}>×</button>}
  </aside>
}
