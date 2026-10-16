import { useEffect, useRef, useState } from 'react'
import { FPP_ACTIVATION_MS, fppActionInput, shouldAnimateFppAction } from './fpp-action-timing.js'

// A pointer activation gets a real presentation phase before its callback can
// change the page. The event snapshot keeps React's currentTarget available;
// the original default is cancelled now and native submit is resumed explicitly.
function activationEvent(event) {
  const snapshot = { ...event, currentTarget: event.currentTarget, fppInput: fppActionInput(event), defaultPrevented: false }
  snapshot.preventDefault = () => { snapshot.defaultPrevented = true }
  snapshot.isDefaultPrevented = () => snapshot.defaultPrevented
  snapshot.stopPropagation = () => event.stopPropagation()
  return snapshot
}

export function useFppActivation({ onActivate, disabled = false, intent = 'primary', activation = 'animated' }) {
  const [pressed, setPressed] = useState(false)
  const timer = useRef(null)
  const latest = useRef(null)
  latest.current = { onActivate, disabled }

  const cancel = () => { clearTimeout(timer.current); timer.current = null; setPressed(false) }
  useEffect(() => {
    if (!pressed) return undefined
    const leave = () => cancel()
    window.addEventListener('hashchange', leave)
    window.addEventListener('popstate', leave)
    return () => {
      clearTimeout(timer.current)
      timer.current = null
      window.removeEventListener('hashchange', leave)
      window.removeEventListener('popstate', leave)
    }
  }, [pressed])
  useEffect(() => { if (disabled) cancel() }, [disabled])

  const run = event => {
    if (latest.current.disabled || timer.current !== null) { event.preventDefault(); return }
    if (event.defaultPrevented) return
    if (intent === 'quick' || activation === 'immediate' || !shouldAnimateFppAction(event)) {
      return latest.current.onActivate?.(event, false)
    }
    const snapshot = activationEvent(event)
    const element = event.currentTarget
    const openedAt = window.location.href
    event.preventDefault()
    setPressed(true)
    timer.current = setTimeout(() => {
      timer.current = null
      setPressed(false)
      if (!element.isConnected || latest.current.disabled || window.location.href !== openedAt) return
      latest.current.onActivate?.(snapshot, true)
    }, FPP_ACTIVATION_MS)
  }

  return { pressed, run }
}
