import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { withTimeout } from '../../../lib/professional-ux.js'
/** Mutations retain the page/context guard, with an individual 10s deadline. */
export function useProfessionalMutation(isCurrent) {
  const location = useLocation()
  const latest = useRef(location); latest.current = location
  const mounted = useRef(false), running = useRef(false), generation = useRef(0)
  const [pending, setPending] = useState(false), [error, setError] = useState('')
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++ } }, [])
  const run = async (work, onSuccess, errorMessage) => {
    if (running.current || !isCurrent()) return
    const request = ++generation.current, context = location
    let active = true
    const current = () => active && mounted.current && latest.current.key === context.key && latest.current.pathname === context.pathname && latest.current.search === context.search && latest.current.hash === context.hash && generation.current === request && isCurrent()
    running.current = true; setPending(true); setError('')
    try {
      const result = await withTimeout(Promise.resolve().then(() => current() ? work(current) : undefined), 10000)
      if (current()) onSuccess?.(result)
    } catch {
      if (current()) setError(errorMessage)
    } finally {
      active = false
      if (mounted.current && generation.current === request) { running.current = false; setPending(false) }
    }
  }
  return { pending, error, run }
}
