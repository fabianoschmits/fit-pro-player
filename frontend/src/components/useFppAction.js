import { useCallback, useEffect, useRef, useState } from 'react'

const BUSY_STATES = new Set(['loading', 'processing', 'uploading', 'syncing'])
export const isFppBusy = state => BUSY_STATES.has(state)

// The operation owns its lifetime. Timers affect presentation only and can never
// release an outstanding write. The ref closes the gap before React re-renders.
export function useFppAction({ onAction, onSuccess, onError, state: controlledState, disabled = false } = {}) {
  const [managedState, setManagedState] = useState('idle')
  const [visualBusy, setVisualBusy] = useState(false)
  const running = useRef(false)
  const mounted = useRef(true)
  const resetTimer = useRef(null)
  const requestedState = controlledState ?? managedState
  const state = disabled && !isFppBusy(requestedState) ? 'disabled' : requestedState
  const busy = isFppBusy(state) || managedState === 'loading'
  const locked = disabled || state === 'disabled' || busy

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; clearTimeout(resetTimer.current) }
  }, [])

  useEffect(() => {
    if (!busy) { setVisualBusy(false); return undefined }
    const timer = setTimeout(() => setVisualBusy(true), 160)
    return () => clearTimeout(timer)
  }, [busy])

  const run = useCallback(async event => {
    if (!onAction || locked || running.current) return false
    running.current = true
    clearTimeout(resetTimer.current)
    setManagedState('loading')
    let result
    try {
      result = await onAction(event)
    } catch (error) {
      running.current = false
      if (mounted.current) {
        setManagedState('error')
        // Feedback observers do not change the settled outcome or strand retry.
        try { await onError?.(error) } catch { /* The operation already failed. */ }
      }
      return false
    }
    running.current = false
    if (!mounted.current) return result
    if (result === false) { setManagedState('idle'); return false }
    setManagedState('success')
    resetTimer.current = setTimeout(() => {
      if (mounted.current) setManagedState('idle')
    }, 600)
    try { await onSuccess?.(result) } catch { /* The operation already succeeded. */ }
    return result
  }, [onAction, onSuccess, onError, locked])

  return { state, busy, locked, visualState: busy ? (visualBusy ? (isFppBusy(state) ? state : 'loading') : 'idle') : state, run }
}

export default useFppAction
