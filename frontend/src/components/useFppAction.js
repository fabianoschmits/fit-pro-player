import { useCallback, useEffect, useRef, useState } from 'react'

const BUSY_STATES = new Set(['loading', 'processing', 'uploading', 'syncing'])
const BUSY_VISUAL_DELAY = 220
const SUCCESS_HOLD_MS = 280
const SUCCESS_VISIBLE_MS = 900
export const isFppBusy = state => BUSY_STATES.has(state)
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

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
    const timer = setTimeout(() => setVisualBusy(true), BUSY_VISUAL_DELAY)
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
    if (!reducedMotion()) await wait(SUCCESS_HOLD_MS)
    if (!mounted.current) return result
    resetTimer.current = setTimeout(() => {
      if (mounted.current) setManagedState('idle')
    }, SUCCESS_VISIBLE_MS)
    try { await onSuccess?.(result) } catch { /* The operation already succeeded. */ }
    return result
  }, [onAction, onSuccess, onError, locked])

  return { state, busy, locked, visualState: busy ? (visualBusy ? (isFppBusy(state) ? state : 'loading') : 'idle') : state, run }
}

export default useFppAction
