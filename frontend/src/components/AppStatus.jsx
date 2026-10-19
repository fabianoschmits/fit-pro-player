import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { getBrowserSupabaseClient } from '../lib/supabase-client.js'
import { Button } from './ui.jsx'
import { FppStatusAnimation } from './FppFeedback.jsx'

export default function AppStatus() {
  const sync = useStore(s => s.accountSync), persistence = useStore(s => s.persistence)
  const session = useStore(s => s.sessionRecovery)
  const pending = useStore(s => s.S.pendingProfessionalEvents?.length || 0)
  const blocked = useStore(s => s.S.pendingProfessionalEvents?.some(event => event.blocked) || false)
  const [online, setOnline] = useState(navigator.onLine !== false)
  const [update, setUpdate] = useState(false)
  const [updateDismissed, setUpdateDismissed] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncFeedback, setSyncFeedback] = useState(null)
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
    : session?.state === 'auth-required' ? 'session-auth'
    : session?.state === 'failed' ? 'session-error'
    : session?.state === 'waiting' ? 'session-waiting'
    : session?.state === 'saving' ? 'session-saving'
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

  const updateConflict = async () => {
    if (syncing) return false
    setSyncing(true); setSyncFeedback(null)
    try {
      const ok = await useStore.getState().resolveSyncConflict('cloud', getBrowserSupabaseClient())
      if (!ok) { setSyncFeedback('error'); throw new Error('sync-failed') }
      setSyncFeedback('success')
      window.setTimeout(() => setSyncFeedback(null), 1800)
    } catch (error) {
      setSyncFeedback('error')
      throw error
    } finally { setSyncing(false) }
  }
  const retrySession = () => useStore.getState().flushSessionRecovery()
  const takeOverSession = () => useStore.getState().takeOverSessionRecovery()

  if (!state && !syncFeedback) return null
  if (syncFeedback === 'success') return <aside className="app-status app-status-global" data-state="success" role="status">
    <FppStatusAnimation state="success" />
    <span>{t('Sync updated')}</span>
  </aside>
  const text = state === 'error' ? t('Data could not be saved on this device.')
    : state === 'session-takeover' ? t('This workout is open on another device. Continue it here to send your changes.')
    : state === 'session-auth' ? t('Sign in again to send this workout.')
    : state === 'session-error' ? t('This workout could not be sent. Your changes remain on this device.')
    : state === 'session-waiting' ? t('Workout waiting to send. It will retry when the connection returns.')
    : state === 'session-saving' ? t('Saving workout…')
    : state === 'conflict' ? t('Your devices have different changes. Review sync copies in Settings.')
    : state === 'offline' ? t('Offline — changes stay on this device until you reconnect.')
    : state === 'blocked' ? t('A professional update needs attention. Your workout remains saved on this device.')
    : state === 'sync-error' ? t('Could not sync. Your device copy is preserved.')
    : state === 'pending' ? t('{0} professional updates waiting to sync.', pending)
    : t('App update ready. It will be applied after your workout.')
  const syncError = syncFeedback === 'error' && t('Could not finish sync. Your copies were preserved.')

  return <aside ref={asideRef} className="app-status app-status-global" data-state={state} role="status">
    <FppStatusAnimation state={state === 'offline' ? 'offline' : state === 'error' || state === 'sync-error' ? 'error' : 'warning'} />
    <span>{syncError || text}</span>
    {!state?.startsWith('session-') && <a href="#/settings">{t('Settings')}</a>}
    {state === 'conflict' && <Button size="sm" className="app-status-action" onAction={updateConflict} loadingLabel={t('Syncing…')} successLabel={t('Sync updated')}>{t('Sync now')}</Button>}
    {['session-waiting', 'session-error', 'session-auth'].includes(state) && <Button size="sm" className="app-status-action" onAction={retrySession} loadingLabel={t('Saving…')} successLabel={t('Salvo')}>{t('Try again')}</Button>}
    {state === 'session-takeover' && <Button size="sm" className="app-status-action" onAction={takeOverSession} loadingLabel={t('Saving…')} successLabel={t('Salvo')}>{t('Continue here')}</Button>}
    {state === 'update' && <button type="button" className="app-status-dismiss" aria-label={t('Close')} onClick={() => setUpdateDismissed(true)}>×</button>}
  </aside>
}
