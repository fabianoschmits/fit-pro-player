import { expect, it, vi } from 'vitest'
import { createAccountDomainSync } from './account-domain-sync.js'

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

const initial = () => ({
  planMode: 'weekly', week: {}, dayPlan: {}, routines: [], profile: { startWeight: 72 },
  bodyweight: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', d: '2026-10-20', w: 72, t: 1 }],
  bodyMeasurements: [], workouts: [], displayUnit: 'kg', _pendingSync: { body: true },
})

const bodyResponse = weight => ({ weights: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', date: '2026-10-20', weightKg: weight, updatedAt: '2026-10-20T12:00:00Z' }], measurements: [] })

function harness({ online = true, saveBody = vi.fn(async ({ weights }) => bodyResponse(weights[0].weightKg)) } = {}) {
  let state = initial()
  let connected = online
  const statuses = []
  const repository = { saveBody, savePlan: vi.fn(), savePreferences: vi.fn() }
  const sync = createAccountDomainSync({
    repository,
    getState: () => state,
    replaceState: next => { state = next },
    isCurrent: () => true,
    isOnline: () => connected,
    onStatus: status => statuses.push(status),
  })
  return { sync, repository, statuses, state: () => state, setState: next => { state = next }, setOnline: value => { connected = value } }
}

it('sends an online weight immediately and confirms saved only after the database responds', async () => {
  const pending = deferred()
  const h = harness({ saveBody: vi.fn(() => pending.promise) })
  const flush = h.sync.start()
  expect(h.repository.saveBody).toHaveBeenCalledTimes(1)
  expect(h.state()._pendingSync.body).toBe(true)
  expect(h.statuses.at(-1).state).toBe('saving')
  pending.resolve(bodyResponse(72))
  await flush
  expect(h.state()._pendingSync.body).toBe(false)
  expect(h.statuses.at(-1).state).toBe('saved')
})

it('keeps the local pending weight offline and sends it when the connection returns', async () => {
  const h = harness({ online: false })
  await h.sync.start()
  expect(h.repository.saveBody).not.toHaveBeenCalled()
  expect(h.state()._pendingSync.body).toBe(true)
  expect(h.statuses.at(-1).state).toBe('queued')
  h.setOnline(true)
  await h.sync.retry()
  expect(h.repository.saveBody).toHaveBeenCalledTimes(1)
  expect(h.state()._pendingSync.body).toBe(false)
})

it('preserves a failed write and retries it without claiming success', async () => {
  const saveBody = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(bodyResponse(72))
  const h = harness({ saveBody })
  await h.sync.start()
  expect(h.state()._pendingSync.body).toBe(true)
  expect(h.statuses.at(-1).state).toBe('error')
  await h.sync.retry()
  expect(saveBody).toHaveBeenCalledTimes(2)
  expect(h.state()._pendingSync.body).toBe(false)
})

it('automatically retries a transient server failure while online', async () => {
  vi.useFakeTimers()
  try {
    const failure = Object.assign(new Error('temporary outage'), { kind: 'request-failed', retryable: true })
    const saveBody = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(bodyResponse(72))
    const h = harness({ saveBody })
    await h.sync.start()
    expect(h.state()._pendingSync.body).toBe(true)
    await vi.advanceTimersByTimeAsync(2000)
    expect(saveBody).toHaveBeenCalledTimes(2)
    expect(h.state()._pendingSync.body).toBe(false)
  } finally { vi.useRealTimers() }
})

it('serializes body replacements and sends a newer weight after an in-flight write', async () => {
  const first = deferred()
  const saveBody = vi.fn().mockImplementationOnce(() => first.promise).mockImplementationOnce(async ({ weights }) => bodyResponse(weights[0].weightKg))
  const h = harness({ saveBody })
  const flush = h.sync.start()
  h.setState({ ...h.state(), bodyweight: [{ ...h.state().bodyweight[0], w: 73 }] })
  const later = h.sync.changed()
  expect(saveBody).toHaveBeenCalledTimes(1)
  first.resolve(bodyResponse(72))
  await Promise.all([flush, later])
  expect(saveBody).toHaveBeenCalledTimes(2)
  expect(h.state().bodyweight[0].w).toBe(73)
  expect(h.state()._pendingSync.body).toBe(false)
})

it('does not replace an unsent local weight with a remote refresh', async () => {
  const h = harness({ online: false })
  await h.sync.start()
  h.sync.acceptRemote('body', bodyResponse(70))
  expect(h.state().bodyweight[0].w).toBe(72)
  expect(h.state()._pendingSync.body).toBe(true)
})

it('recovers a legacy local weigh-in when the account has no weight in the database', async () => {
  const h = harness({ online: false })
  h.setState({ ...h.state(), _pendingSync: {} })
  h.sync.acceptRemote('body', { weights: [], measurements: [] })
  expect(h.state().bodyweight[0].w).toBe(72)
  expect(h.state()._pendingSync.body).toBe(true)
})

it('keeps a failed domain visible when another domain saves successfully', async () => {
  const preference = deferred()
  const h = harness({ saveBody: vi.fn(async () => { throw new Error('body rejected') }) })
  h.setState({ ...h.state(), _pendingSync: { body: true, preferences: true } })
  h.repository.savePreferences.mockReturnValue(preference.promise)
  const flush = h.sync.start()
  await Promise.resolve()
  preference.resolve({ revision: 1, values: { profile: { startWeight: 72 } }, displayUnit: 'kg', massUnit: 'kg' })
  await flush
  expect(h.state()._pendingSync.body).toBe(true)
  expect(h.state()._pendingSync.preferences).toBe(false)
  expect(h.statuses.at(-1).state).toBe('error')
})

it('does not apply an old account response after switching accounts', async () => {
  const response = deferred()
  let current = true
  let state = initial()
  const sync = createAccountDomainSync({
    repository: { saveBody: () => response.promise },
    getState: () => state,
    replaceState: next => { state = next },
    isCurrent: () => current,
    isOnline: () => true,
  })
  const flush = sync.start()
  current = false
  response.resolve(bodyResponse(72))
  await flush
  expect(state._pendingSync.body).toBe(true)
})
