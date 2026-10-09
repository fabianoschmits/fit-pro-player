// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useProfessionalResource } from './useProfessionalResource.js'
import { useProfessionalLists } from './useProfessionalLists.js'

const pending = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
let root, container, result
function Resource(props) { result = useProfessionalResource(props); return null }
function List(props) { result = useProfessionalLists(props); return null }
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers() })
const render = async (Component, props) => act(async () => root.render(<Component {...props} />))
const page = (items, total = items.length, offset = 0, hasMore = false) => ({ items, total, offset, hasMore })

describe('professional resource generations', () => {
  it('account_switch_discards_response, including a switch back to the original identity', async () => {
    const old = pending(), other = pending(), fresh = pending()
    const load = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(other.promise).mockReturnValueOnce(fresh.promise)
    await render(Resource, { accountId: 'a', resourceKey: 'summary', load })
    const isOld = result.isCurrent
    expect(result.status).toBe('loading')
    await render(Resource, { accountId: 'b', resourceKey: 'summary', load })
    expect(result.data).toBeNull()
    expect(isOld()).toBe(false)
    await render(Resource, { accountId: 'a', resourceKey: 'summary', load })
    await act(async () => { old.resolve('old'); other.resolve('other') })
    expect(result.data).toBeNull()
    await act(async () => fresh.resolve('fresh'))
    expect(result.data).toBe('fresh')
    expect(result.status).toBe('success')
  })

  it('preserves current data during refresh and ignores an older retry', async () => {
    const slow = pending(), fresh = pending()
    const load = vi.fn().mockResolvedValueOnce('initial').mockReturnValueOnce(slow.promise).mockReturnValueOnce(fresh.promise)
    await render(Resource, { accountId: 'a', resourceKey: 'summary', load })
    await act(async () => { result.retry() })
    expect(result.data).toBe('initial')
    expect(result.status).toBe('refreshing')
    await act(async () => { result.retry(); fresh.resolve('new') })
    await act(async () => slow.reject(new Error('obsolete')))
    expect(result.data).toBe('new')
    expect(result.error).toBeNull()
  })

  it('times out after 10 seconds, retries, and does not load an initializing account', async () => {
    vi.useFakeTimers()
    const slow = pending(), load = vi.fn().mockReturnValueOnce(slow.promise).mockResolvedValue('recovered')
    await render(Resource, { accountId: null, resourceKey: 'summary', load })
    expect(load).not.toHaveBeenCalled()
    expect(result.status).toBe('idle')
    await render(Resource, { accountId: 'a', resourceKey: 'summary', load })
    await act(async () => vi.advanceTimersByTimeAsync(10000))
    expect(result.status).toBe('error')
    expect(result.error.message).toBe('request-timeout')
    await act(async () => { result.retry() })
    await act(async () => slow.resolve('too late'))
    expect(result.data).toBe('recovered')
  })
})

describe('professional list pagination', () => {
  it('changing loader callback identity preserves the pending request and its data', async () => {
    const initial = pending()
    await render(List, { accountId: 'a', resourceKey: 'programs', loadPage: () => initial.promise })
    await render(List, { accountId: 'a', resourceKey: 'programs', loadPage: () => { throw new Error('unexpected reload') } })
    await act(async () => initial.resolve(page([{ id: 'p' }], 501)))
    expect(result.items).toEqual([{ id: 'p' }])
    expect(result.total).toBe(501)
    expect(result.error).toBeNull()
  })
  it('a no-op filter update does not discard an in-flight initial page', async () => {
    const initial = pending(), loadPage = vi.fn().mockReturnValue(initial.promise)
    await render(List, { accountId: 'a', resourceKey: 'students', loadPage, initialFilters: { search: '', status: 'all' } })
    await act(async () => result.setFilters({ search: '' }))
    await act(async () => initial.resolve(page([{ studentUserId: 's' }], 210)))
    expect(result.items).toEqual([{ studentUserId: 's' }])
    expect(result.total).toBe(210)
    expect(result.status).toBe('success')
    expect(loadPage).toHaveBeenCalledTimes(1)
  })
  it('list_reset_discards_pending_page when search changes', async () => {
    const more = pending()
    const loadPage = vi.fn().mockResolvedValueOnce(page([{ studentUserId: 's1' }], 240, 0, true)).mockReturnValueOnce(more.promise).mockResolvedValueOnce(page([{ studentUserId: 's2' }], 1))
    await render(List, { accountId: 'a', resourceKey: 'students', loadPage, initialFilters: { search: '' } })
    expect(result.total).toBe(240)
    await act(async () => { result.loadMore(); result.loadMore() })
    expect(loadPage).toHaveBeenCalledTimes(2)
    expect(loadPage.mock.calls[1][0]).toMatchObject({ offset: 1, limit: 30 })
    await act(async () => result.setFilters({ search: 'Ana' }))
    await act(async () => more.resolve(page([{ studentUserId: 'old' }], 240, 1, true)))
    expect(result.items).toEqual([{ studentUserId: 's2' }])
    expect(result.total).toBe(1)
  })

  it('isolates account data and filters, and returns the server total beyond page caps', async () => {
    const old = pending()
    const loadPage = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(page([{ id: 'new' }], 601, 0, true))
    await render(List, { accountId: 'a', resourceKey: 'executions', loadPage, initialFilters: { status: 'all' } })
    await render(List, { accountId: 'b', resourceKey: 'executions', loadPage, initialFilters: { status: 'completed' } })
    await act(async () => old.resolve(page([{ id: 'old' }], 1)))
    expect(result.items).toEqual([{ id: 'new' }])
    expect(result.filters).toEqual({ status: 'completed' })
    expect(result.total).toBe(601)
    expect(loadPage.mock.calls[1][0]).toMatchObject({ limit: 20, offset: 0, status: 'completed' })
  })

  it('keeps rows during refresh, retries a failed next page, and deduplicates overlapping rows', async () => {
    const refresh = pending()
    const loadPage = vi.fn().mockResolvedValueOnce(page([{ id: 'p1' }, { id: 'p2' }], 4, 0, true)).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(page([{ id: 'p2' }, { id: 'p3' }], 4, 2, false)).mockReturnValueOnce(refresh.promise)
    await render(List, { accountId: 'a', resourceKey: 'programs', loadPage })
    await act(async () => { result.loadMore() })
    expect(result.items).toHaveLength(2)
    expect(result.error.message).toBe('offline')
    await act(async () => { result.retry() })
    expect(result.items.map(item => item.id)).toEqual(['p1', 'p2', 'p3'])
    expect(loadPage.mock.calls[2][0]).toMatchObject({ offset: 2, limit: 20 })
    await act(async () => { result.retry() })
    expect(result.items).toHaveLength(3)
    expect(result.status).toBe('refreshing')
    await act(async () => refresh.resolve(page([{ id: 'p4' }], 1)))
    expect(result.items).toEqual([{ id: 'p4' }])
  })
})
