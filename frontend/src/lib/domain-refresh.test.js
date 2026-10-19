import { describe, expect, it, vi } from 'vitest'

const load = () => import('./domain-refresh.js')

const accountA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const accountB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const deferred = () => {
  let resolve
  const promise = new Promise(next => { resolve = next })
  return { promise, resolve }
}

function repository(overrides = {}) {
  return {
    loadPreferences: vi.fn(async () => ({ values: { lang: 'pt' }, displayUnit: 'kg' })),
    loadPlan: vi.fn(async () => ({ routines: [], schedule: null })),
    loadHistory: vi.fn(async () => []),
    loadBody: vi.fn(async () => ({ weights: [], measurements: [] })),
    ...overrides,
  }
}

describe('domain refresh coordinator', () => {
  it('loads every domain independently on boot and reports the ready domains', async () => {
    const { createDomainRefresh } = await load()
    const repo = repository()
    const applied = []
    const refresh = createDomainRefresh({ accountId: accountA, repository: repo, apply: (domain, value) => applied.push([domain, value]) })

    await expect(refresh.boot()).resolves.toMatchObject({ state: 'ready', domains: { preferences: 'ready', plan: 'ready', history: 'ready', body: 'ready' } })
    expect(applied.map(([domain]) => domain).sort()).toEqual(['body', 'history', 'plan', 'preferences'])
  })

  it('refreshes only the requested domain without reading unrelated account records', async () => {
    const { createDomainRefresh } = await load()
    const repo = repository()
    const refresh = createDomainRefresh({ accountId: accountA, repository: repo, apply: vi.fn() })
    await refresh.refresh('plan')
    expect(repo.loadPlan).toHaveBeenCalledTimes(1)
    expect(repo.loadPreferences).not.toHaveBeenCalled()
    expect(repo.loadHistory).not.toHaveBeenCalled()
    expect(repo.loadBody).not.toHaveBeenCalled()
  })

  it('refreshes the requested domains when the window regains focus', async () => {
    const { attachDomainFocusRefresh } = await load()
    const target = new EventTarget()
    const refresh = vi.fn(async () => {})
    const detach = attachDomainFocusRefresh({ target, refresh, domains: ['plan', 'history'] })
    target.dispatchEvent(new Event('focus'))
    await Promise.resolve()
    expect(refresh).toHaveBeenCalledWith('plan')
    expect(refresh).toHaveBeenCalledWith('history')
    detach()
    target.dispatchEvent(new Event('focus'))
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('rejects a stale response after the account generation changes', async () => {
    const { createDomainRefresh } = await load()
    const pending = deferred()
    let currentAccount = accountA
    const apply = vi.fn()
    const refresh = createDomainRefresh({
      accountId: accountA,
      repository: repository({ loadPlan: () => pending.promise }),
      apply,
      isCurrent: accountId => accountId === currentAccount,
    })
    const result = refresh.refresh('plan')
    currentAccount = accountB
    pending.resolve({ routines: [], schedule: null })
    await expect(result).resolves.toMatchObject({ state: 'stale', domain: 'plan' })
    expect(apply).not.toHaveBeenCalled()
  })

  it('keeps existing data when a focused refresh fails and exposes the domain error', async () => {
    const { createDomainRefresh } = await load()
    const error = new Error('network down')
    const apply = vi.fn()
    const refresh = createDomainRefresh({ accountId: accountA, repository: repository({ loadHistory: async () => { throw error } }), apply })
    await expect(refresh.refresh('history')).resolves.toMatchObject({ state: 'error', domain: 'history', error })
    expect(apply).not.toHaveBeenCalled()
    expect(refresh.status()).toMatchObject({ domains: { history: { state: 'error', error } } })
  })

  it('does not let an old account coordinator apply data after a switch', async () => {
    const { createDomainRefresh } = await load()
    const oldRead = deferred()
    let active = accountA
    const oldApply = vi.fn()
    const old = createDomainRefresh({ accountId: accountA, repository: repository({ loadPreferences: () => oldRead.promise }), apply: oldApply, isCurrent: id => id === active })
    const request = old.refresh('preferences')
    active = accountB
    const newApply = vi.fn()
    const next = createDomainRefresh({ accountId: accountB, repository: repository(), apply: newApply, isCurrent: id => id === active })
    oldRead.resolve({ values: { lang: 'pt' }, displayUnit: 'kg' })
    await request
    await next.refresh('preferences')
    expect(oldApply).not.toHaveBeenCalled()
    expect(newApply).toHaveBeenCalledWith('preferences', expect.objectContaining({ displayUnit: 'kg' }))
  })
})
