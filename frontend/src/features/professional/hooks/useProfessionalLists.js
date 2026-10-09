import { useCallback, useEffect, useRef, useState } from 'react'
import { withTimeout } from '../../../lib/professional-ux.js'

const rowId = item => item.id || item.studentUserId
const unique = items => {
  const seen = new Set()
  return items.filter(item => { const id = rowId(item); if (!id) return true; if (seen.has(id)) return false; seen.add(id); return true })
}

/**
 * loadPage receives {...filters, offset, limit} and returns Page<T>.
 * resourceKey should identify students/programs/executions and any detail ID.
 * An optional pageSize supports contextual keys; students default to 30, others 20.
 * total is null until a real server count arrives; data survives background refresh.
 * status: idle | loading | refreshing | loading_more | success | error.
 * setFilters merges a partial object or a functional update and resets pagination.
 */
export function useProfessionalLists({ accountId, resourceKey, loadPage, initialFilters = {}, pageSize }) {
  const owner = useRef(null)
  if (!owner.current || owner.current.accountId !== accountId || owner.current.resourceKey !== resourceKey) {
    owner.current = { accountId, resourceKey, initialFilters }
  }
  const accountContext = owner.current
  const [filterState, setFilterState] = useState(null)
  const filters = filterState?.context === accountContext ? filterState.value : accountContext.initialFilters
  const filtersRef = useRef(null); filtersRef.current = { context: accountContext, value: filters }
  const filterKey = JSON.stringify(filters)
  const identity = useRef(null)
  if (!identity.current || identity.current.owner !== accountContext || identity.current.filterKey !== filterKey) {
    identity.current = { owner: accountContext, filterKey }
  }
  const context = identity.current
  const loader = useRef(loadPage); loader.current = loadPage
  const mounted = useRef(false)
  const generation = useRef(0)
  const cursor = useRef(null)
  const inFlight = useRef(null)
  const [state, setState] = useState(null)
  const limit = pageSize || (/students(?:$|[:/])/.test(String(resourceKey)) ? 30 : 20)

  const execute = useCallback(async (offset = 0) => {
    if (!accountId || !mounted.current || identity.current !== context) return
    const request = ++generation.current
    inFlight.current = { context, request }
    const current = () => mounted.current && identity.current === context && generation.current === request
    const append = offset > 0
    setState(previous => ({
      context, items: previous?.context === context ? previous.items : [],
      total: previous?.context === context ? previous.total : null,
      status: append ? 'loading_more' : previous?.context === context && previous.total !== null ? 'refreshing' : 'loading',
      error: null,
    }))
    const read = loader.current
    try {
      const page = await withTimeout(Promise.resolve().then(() => read({ ...filters, offset, limit })), 10000)
      if (!current()) return
      if (!page || !Array.isArray(page.items) || !Number.isSafeInteger(page.total) || page.total < 0 || page.offset !== offset || typeof page.hasMore !== 'boolean') throw new Error('invalid-page')
      // Advance by raw rows even when concurrent writes cause an overlapping UUID.
      const nextOffset = offset + page.items.length
      cursor.current = { context, nextOffset, hasMore: page.hasMore && page.items.length > 0, failedOffset: null }
      setState(previous => ({ context, items: unique([...(append && previous?.context === context ? previous.items : []), ...page.items]), total: page.total, status: 'success', error: null }))
    } catch (error) {
      if (current()) {
        cursor.current = { ...(cursor.current?.context === context ? cursor.current : {}), context, failedOffset: offset }
        setState(previous => ({ ...previous, status: 'error', error }))
      }
    } finally {
      if (inFlight.current?.request === request) inFlight.current = null
    }
  }, [accountId, context, filterKey, limit])

  useEffect(() => {
    mounted.current = true
    cursor.current = null
    if (accountId) execute(0)
    return () => { mounted.current = false; generation.current += 1; inFlight.current = null }
  }, [accountId, context, execute])

  const setFilters = useCallback(update => {
    if (owner.current !== accountContext) return
    const current = filtersRef.current?.context === accountContext ? filtersRef.current.value : accountContext.initialFilters
    const next = { ...current, ...(typeof update === 'function' ? update(current) : update) }
    if (JSON.stringify(current) === JSON.stringify(next)) return
    filtersRef.current = { context: accountContext, value: next }
    generation.current += 1
    inFlight.current = null
    setFilterState({ context: accountContext, value: next })
  }, [accountContext])
  const loadMore = useCallback(() => {
    if (identity.current !== context || inFlight.current?.context === context || cursor.current?.context !== context || !cursor.current.hasMore) return
    return execute(cursor.current.nextOffset)
  }, [context, execute])
  const retry = useCallback(() => {
    if (identity.current !== context) return
    return execute(cursor.current?.context === context && cursor.current.failedOffset != null ? cursor.current.failedOffset : 0)
  }, [context, execute])

  const visible = state?.context === context ? state : null
  return {
    items: visible?.items || [], total: visible?.total ?? null,
    status: accountId ? visible?.status || 'loading' : 'idle', error: visible?.error || null,
    filters, setFilters, loadMore, retry,
    hasMore: cursor.current?.context === context && Boolean(cursor.current.hasMore),
  }
}
