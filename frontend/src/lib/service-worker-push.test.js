// @vitest-environment node
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const origin = 'https://fit.example'
const currentTime = Date.parse('2026-10-04T15:00:00Z')
const context = (extra = {}) => ({ ownerId: 'owner-a', deviceKey: 'device-a', enabled: true, ...extra })
const payload = (extra = {}) => ({ id: 'notification-1', ownerId: 'owner-a', deviceKey: 'device-a',
  kind: 'workout_reminder', expiresAt: '2026-10-04T15:01:00Z',
  title: 'FitProPlayer', body: 'Your planned workout is coming up.', href: '/#/workout', ...extra })

// This fixture keeps storage outside the VM, just as IndexedDB survives worker termination.
function durableDatabase() {
  const records = new Map()
  const control = { fail: false, delayWrites: 0 }
  let created = false
  const database = {
    objectStoreNames: { contains: () => created },
    createObjectStore: () => { created = true },
    close() {},
    transaction() {
      const transaction = {
        error: null,
        objectStore: () => ({
          get(key) {
            const request = {}
            queueMicrotask(() => { request.result = structuredClone(records.get(key)); request.onsuccess?.() })
            return request
          },
          put(value, key) {
            const snapshot = structuredClone(value)
            const complete = () => { records.set(key, snapshot); transaction.oncomplete?.() }
            if (control.delayWrites) setTimeout(complete, control.delayWrites)
            else queueMicrotask(complete)
            return {}
          },
        }),
      }
      return transaction
    },
  }
  return {
    control,
    indexedDB: { open() {
      const request = {}
      queueMicrotask(() => {
        if (control.fail) { request.error = new Error('Storage failed'); request.onerror?.(); return }
        request.result = database
        if (!created) request.onupgradeneeded?.()
        request.onsuccess?.()
      })
      return request
    } },
  }
}

function worker({ db = durableDatabase(), clients = [], show = vi.fn().mockResolvedValue(undefined) } = {}) {
  const listeners = {}
  const openWindow = vi.fn().mockResolvedValue(undefined)
  class ClockDate extends Date { static now() { return currentTime } }
  const runtime = {
    URL, Request, Response, Date: ClockDate, indexedDB: db.indexedDB, location: { origin },
    caches: { keys: vi.fn().mockResolvedValue([]), open: vi.fn(), match: vi.fn(), delete: vi.fn() },
    fetch: vi.fn(),
    self: { addEventListener: (name, callback) => { listeners[name] = callback }, skipWaiting: vi.fn(),
      clients: { claim: vi.fn(), matchAll: vi.fn().mockResolvedValue(clients), openWindow },
      registration: { showNotification: show } },
  }
  vm.runInNewContext(readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8'), runtime)
  const fire = async (name, event) => {
    expect(typeof listeners[name], `${name} must be handled by the real service worker`).toBe('function')
    const pending = []
    listeners[name]({ waitUntil: promise => pending.push(promise), ...event })
    await Promise.all(pending)
  }
  const message = async (data, source = `${origin}/#/settings`) => {
    const replies = []
    await fire('message', { data, source: { url: source }, ports: [{ postMessage: value => replies.push(value) }] })
    return replies[0]
  }
  const setContext = next => message({ type: 'NOTIFICATION_CONTEXT', context: next })
  const push = data => fire('push', { data: { json: () => data } })
  const click = data => { const close = vi.fn(); return fire('notificationclick', { notification: { data, close } }).then(() => close) }
  return { message, setContext, push, click, show, openWindow, db, runtime, fire }
}

describe('durable account-scoped PWA push', () => {
  it('reports push capability and acknowledges context only after durable storage', async () => {
    const w = worker()
    expect(await w.message({ type: 'NOTIFICATION_CAPABILITIES' })).toEqual({ supported: true })
    expect(await w.setContext(context())).toMatchObject({ supported: true, stored: true })
    const restarted = worker({ db: w.db })
    await restarted.push(payload())
    expect(restarted.show).toHaveBeenCalledTimes(1)
    expect(restarted.show.mock.calls[0][0]).toBe('FitProPlayer')
  })

  it('displays every accepted push even when a foreground window exists', async () => {
    const w = worker({ clients: [{ url: `${origin}/#/workout`, visibilityState: 'visible', focused: true }] })
    await w.setContext(context())
    await w.push(payload())
    expect(w.show).toHaveBeenCalledTimes(1)
    expect(w.show.mock.calls[0][1]).toMatchObject({ body: 'Your planned workout is coming up.',
      data: { ownerId: 'owner-a', deviceKey: 'device-a', href: '/#/workout' } })
  })

  it('deduplicates notification ids across worker restart', async () => {
    const w = worker()
    await w.setContext(context())
    await w.push(payload())
    const restarted = worker({ db: w.db })
    await restarted.push(payload())
    await restarted.push(payload({ id: 'notification-2' }))
    expect(w.show).toHaveBeenCalledTimes(1)
    expect(restarted.show).toHaveBeenCalledTimes(1)
  })

  it('drops unknown, expired, malformed, wrong-account and wrong-device pushes', async () => {
    const w = worker()
    await w.setContext(context())
    const cases = [{ kind: 'marketing' }, { ownerId: 'owner-b' }, { deviceKey: 'device-b' },
      { expiresAt: '2026-10-04T14:59:59Z' }, { expiresAt: 'invalid' }, { id: '' },
      { kind: 'rest' }, { kind: 'timed_set' }, { title: null }, { body: null }]
    for (const [i, extra] of cases.entries()) await w.push(payload({ id: `invalid-${i}`, ...extra }))
    await w.fire('push', { data: { json: () => { throw new Error('Broken payload') } } })
    await w.fire('push', { data: null })
    expect(w.show).not.toHaveBeenCalled()
    await w.push(payload({ id: 'valid-control' }))
    expect(w.show).toHaveBeenCalledTimes(1)
  })

  it('accepts the ten fixed reminder/professional kinds without timer context and excludes retired timer metadata', async () => {
    const w = worker()
    await w.setContext(context())
    const kinds = ['workout_reminder', 'weight_reminder', 'measurement_reminder', 'program_updated',
      'program_removed', 'relationship_accepted', 'relationship_ended', 'student_workout_completed',
      'student_workout_abandoned', 'verification_changed']
    for (const kind of kinds) await w.push(payload({ id: kind, kind, timerRevision: 123 }))
    expect(w.show).toHaveBeenCalledTimes(10)
    expect(w.show.mock.calls.every(([, options]) => !Object.hasOwn(options.data, 'timerRevision'))).toBe(true)
  })

  it('logout persists disabled context and an old owner cannot clear the new account', async () => {
    const w = worker()
    await w.setContext(context())
    await w.setContext(context({ enabled: false }))
    const restarted = worker({ db: w.db })
    await restarted.push(payload())
    expect(restarted.show).not.toHaveBeenCalled()
    await restarted.setContext(context({ ownerId: 'owner-b', deviceKey: 'device-b' }))
    expect(await restarted.setContext(context({ enabled: false }))).toMatchObject({ stored: false })
    await restarted.push(payload({ id: 'old-owner' }))
    await restarted.push(payload({ id: 'new-owner', ownerId: 'owner-b', deviceKey: 'device-b', kind: 'program_updated' }))
    expect(restarted.show).toHaveBeenCalledTimes(1)
  })

  it('serializes a durable disable with incoming push reads before accepting re-enabled delivery', async () => {
    const w = worker()
    await w.setContext(context())
    w.db.control.delayWrites = 15
    const update = w.setContext(context({ enabled: false }))
    const stale = w.push(payload())
    await Promise.all([update, stale])
    await w.push(payload({ id: 'still-stale' }))
    await w.setContext(context())
    await w.push(payload({ id: 'current' }))
    expect(w.show).toHaveBeenCalledTimes(1)
  })

  it('ignores cross-origin messages and fails closed when durable storage cannot be written', async () => {
    const w = worker()
    await w.message({ type: 'NOTIFICATION_CONTEXT', context: context() }, 'https://evil.example/')
    await w.push(payload())
    expect(w.show).not.toHaveBeenCalled()
    const failed = worker()
    failed.db.control.fail = true
    expect(await failed.setContext(context())).toMatchObject({ supported: true, stored: false })
    await failed.push(payload())
    expect(failed.show).not.toHaveBeenCalled()
  })

  it('allows a later delivery to show if the first display attempt failed', async () => {
    const show = vi.fn().mockRejectedValueOnce(new Error('OS unavailable')).mockResolvedValue(undefined)
    const w = worker({ show })
    await w.setContext(context())
    await w.push(payload())
    await w.push(payload())
    expect(show).toHaveBeenCalledTimes(2)
  })

  it('focuses and navigates an existing app client using the persisted safe route', async () => {
    const client = { url: `${origin}/#/home`, focus: vi.fn().mockResolvedValue(undefined), navigate: vi.fn().mockResolvedValue(undefined) }
    const w = worker({ clients: [client] })
    await w.setContext(context())
    await w.push(payload({ kind: 'program_updated', href: '/#/professional/students/student-123' }))
    const close = await w.click(w.show.mock.calls[0][1].data)
    expect(close).toHaveBeenCalledTimes(1)
    expect(client.navigate).toHaveBeenCalledWith(`${origin}/#/professional/students/student-123`)
    expect(client.focus).toHaveBeenCalledTimes(1)
    expect(w.openWindow).not.toHaveBeenCalled()
  })

  it('opens a new app window when none exists and normalizes unsafe routes to home', async () => {
    const w = worker()
    await w.setContext(context())
    const cases = ['https://evil.example/#/workout', '//evil.example/#/workout', '/#/unknown',
      '/#/invite/PRIVATE-CODE', '/#/professional/students/../settings', '/#/%2f%2fevil.example', '/\\evil.example']
    for (const [i, href] of cases.entries()) {
      await w.push(payload({ id: `href-${i}`, href }))
      const data = w.show.mock.calls.at(-1)[1].data
      expect(data.href).toBe('/#/home')
      await w.click(data)
    }
    expect(w.openWindow).toHaveBeenCalledTimes(cases.length)
    expect(w.openWindow.mock.calls.every(([url]) => url === `${origin}/#/home`)).toBe(true)
  })

  it('does not navigate an old notification after account switch or its expiry', async () => {
    const w = worker()
    await w.setContext(context())
    await w.push(payload())
    const data = w.show.mock.calls[0][1].data
    await w.setContext(context({ ownerId: 'owner-b', deviceKey: 'device-b' }))
    await w.click(data)
    await w.click({ ...data, ownerId: 'owner-b', deviceKey: 'device-b', expiresAt: '2026-10-04T14:59:59Z' })
    expect(w.openWindow).not.toHaveBeenCalled()
    expect(w.runtime.self.clients.matchAll).not.toHaveBeenCalled()
  })
})
