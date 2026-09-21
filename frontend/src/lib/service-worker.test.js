// @vitest-environment node
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

describe('PWA update safety', () => {
  it('keeps the newest previous runtime cache and leaves unrelated caches alone', async () => {
    const listeners = {}
    const deleted = []
    const context = {
      URL,
      Request,
      fetch: vi.fn(),
      location: { origin: 'https://fit.example' },
      caches: {
        keys: vi.fn().mockResolvedValue(['other-product', 'fit-pro-player-rt-v8', 'fit-pro-player-rt-v10']),
        delete: vi.fn(async key => { deleted.push(key); return true }),
        open: vi.fn(),
        match: vi.fn(),
      },
      self: {
        addEventListener: (name, handler) => { listeners[name] = handler },
        skipWaiting: vi.fn(),
        clients: { claim: vi.fn().mockResolvedValue(undefined), matchAll: vi.fn(), openWindow: vi.fn() },
        registration: { showNotification: vi.fn() },
      },
    }
    vm.runInNewContext(readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8'), context)
    let activation
    listeners.activate({ waitUntil: promise => { activation = promise } })
    await activation

    expect(deleted).toEqual(['fit-pro-player-rt-v8'])
    expect(context.self.clients.claim).toHaveBeenCalledTimes(1)
    expect(context.self.clients.matchAll).not.toHaveBeenCalled()
  })

  it('does not clear the active offline cache before an update reload', () => {
    const mainSource = readFileSync(new URL('../main.jsx', import.meta.url), 'utf8')
    const workerSource = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8')
    expect(mainSource).not.toContain("postMessage({ type: 'CLEAR_RUNTIME_CACHE' })")
    // Tabs still running the previous release may send this legacy message to the new worker.
    // Ignoring it is what makes the first upgrade to this fix safe as well.
    expect(workerSource).not.toContain("e.data?.type === 'CLEAR_RUNTIME_CACHE'")
  })
})
