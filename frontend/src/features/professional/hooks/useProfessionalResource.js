import { useCallback, useEffect, useRef, useState } from 'react'
import { withTimeout } from '../../../lib/professional-ux.js'

/**
 * Account/context scoped reads. Pass no accountId while auth initializes.
 * status: idle | loading (initial skeleton) | refreshing | success | error.
 * Capture isCurrent before an async mutation to guard its local completion.
 * Keep resourceKey stable for the complete resource identity; load may be inline.
 * load(isRequestCurrent) may ignore the additive argument. Staged loaders must
 * check it before each next read; it expires on timeout, retry, context or unmount.
 */
export function useProfessionalResource({ accountId, resourceKey, load }) {
  const identity = useRef(null)
  if (!identity.current || identity.current.accountId !== accountId || identity.current.resourceKey !== resourceKey) {
    identity.current = { accountId, resourceKey }
  }
  const context = identity.current
  const loader = useRef(load); loader.current = load
  const mounted = useRef(false)
  const generation = useRef(0)
  const [state, setState] = useState(null)
  const isCurrent = useCallback(() => mounted.current && identity.current === context, [context])

  const retry = useCallback(async () => {
    if (!accountId || !isCurrent()) return
    const request = ++generation.current
    let active = true
    const current = () => active && isCurrent() && generation.current === request
    setState(previous => ({
      context, data: previous?.context === context ? previous.data : null,
      status: previous?.context === context && previous.hasData ? 'refreshing' : 'loading',
      hasData: previous?.context === context && previous.hasData, error: null,
    }))
    const read = loader.current
    try {
      const data = await withTimeout(Promise.resolve().then(() => current() ? read(current) : undefined), 10000)
      if (current()) setState({ context, data, hasData: true, status: 'success', error: null })
      return current() ? data : undefined
    } catch (error) {
      if (current()) setState(previous => ({ ...previous, status: 'error', error }))
    } finally {
      active = false
    }
  }, [accountId, context, isCurrent])

  useEffect(() => {
    mounted.current = true
    if (accountId) retry()
    return () => { mounted.current = false; generation.current += 1 }
  }, [accountId, context, retry])

  const visible = state?.context === context ? state : null
  return {
    data: visible?.data ?? null,
    status: accountId ? visible?.status || 'loading' : 'idle',
    error: visible?.error || null, retry, isCurrent,
  }
}
