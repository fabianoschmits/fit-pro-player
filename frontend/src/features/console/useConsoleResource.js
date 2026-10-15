import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

// Pair every result with its account and resource so navigation cannot expose stale data.
export default function useConsoleResource({ userId, allowed, resourceKey, load }) {
  const { key: navigationKey } = useLocation()
  const identity = `${userId || ''}:${resourceKey}`
  const current = useRef(identity); current.current = identity
  const loader = useRef(load); loader.current = load
  const sequence = useRef(0)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ identity: '', data: null, error: '', busy: true })
  useEffect(() => {
    if (!allowed || !userId) return
    let live = true
    const request = ++sequence.current
    setState({ identity, data: null, error: '', busy: true })
    Promise.resolve().then(() => loader.current()).then(data => {
      if (live && request === sequence.current && current.current === identity) setState({ identity, data, error: '', busy: false })
    }).catch(() => {
      if (live && request === sequence.current && current.current === identity) setState({ identity, data: null, error: 'Não foi possível carregar os dados. Tente novamente.', busy: false })
    })
    return () => { live = false }
  }, [identity, allowed, userId, attempt, navigationKey])
  const refresh = useCallback(() => setAttempt(value => value + 1), [])
  return { ...(state.identity === identity && allowed ? state : { data: null, error: '', busy: true }), refresh }
}
