import { useCallback, useEffect, useRef, useState } from 'react'
import { waitForFppConfirmation } from './fpp-action-timing.js'
import { accountActionStore } from '../lib/account-action-store.js'

const BUSY_STATES = new Set(['loading', 'processing', 'uploading', 'syncing'])
const BUSY_VISUAL_DELAY = 220
const SUCCESS_VISIBLE_MS = 900
export const isFppBusy = state => BUSY_STATES.has(state)

// The operation owns its lifetime. Timers affect presentation only and can never
// release an outstanding write. The ref closes the gap before React re-renders.
export function useFppAction({ onAction, onSuccess, onError, state: controlledState, disabled = false } = {}) {
  const [managedState, setManagedState] = useState('idle')
  const [visualBusy, setVisualBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const running = useRef(false)
  const mounted = useRef(true)
  const resetTimer = useRef(null)
  const completion = useRef(null)
  const requestedState = controlledState ?? managedState
  const state = disabled && requestedState === 'idle' ? 'disabled' : requestedState
  const busy = isFppBusy(state) || managedState === 'loading'
  const locked = disabled || state === 'disabled' || busy || confirming

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; clearTimeout(resetTimer.current); completion.current?.abort() }
  }, [])

  useEffect(() => {
    if (!busy) { setVisualBusy(false); return undefined }
    const timer = setTimeout(() => setVisualBusy(true), BUSY_VISUAL_DELAY)
    return () => clearTimeout(timer)
  }, [busy])

  const run = useCallback(async event => {
    if (!onAction || locked || running.current) return false
    running.current = true
    clearTimeout(resetTimer.current)
    setManagedState('loading')
    let result
    let accountPending = false
    const before = accountActionStore()
    const beforeTimestamp = before?.S?._ts
    try {
      result = await onAction(event)
      const store = accountActionStore()
      if (result !== false && store?.getActiveLocalScope?.()?.kind === 'account'
        && store.S?._ts !== beforeTimestamp && Object.values(store.S?._pendingSync || {}).some(Boolean)) {
        await store.retryAccountSync?.()
        accountPending = Object.values(accountActionStore()?.S?._pendingSync || {}).some(Boolean)
      }
    } catch (error) {
      running.current = false
      if (mounted.current) {
        setManagedState('error')
        // Feedback observers do not change the settled outcome or strand retry.
        try { await onError?.(error) } catch { /* The operation already failed. */ }
      }
      return false
    }
    if (!mounted.current) { running.current = false; return result }
    if (result === false) { running.current = false; setManagedState('idle'); return false }
    setManagedState(accountPending ? 'warning' : 'success')
    if (onSuccess) {
      setConfirming(true)
      completion.current = new AbortController()
      const confirmed = await waitForFppConfirmation(event, { signal: completion.current.signal })
      completion.current = null
      if (!confirmed || !mounted.current) { running.current = false; return result }
      try { await onSuccess(result) } catch { /* The operation already succeeded. */ }
      if (!mounted.current) { running.current = false; return result }
      setConfirming(false)
    }
    running.current = false
    resetTimer.current = setTimeout(() => {
      if (mounted.current) setManagedState('idle')
    }, SUCCESS_VISIBLE_MS)
    return result
  }, [onAction, onSuccess, onError, locked])

  return { state, busy, locked, visualState: busy ? (visualBusy ? (isFppBusy(state) ? state : 'loading') : 'idle') : state, run }
}

export default useFppAction
