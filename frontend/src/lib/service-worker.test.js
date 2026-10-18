// @vitest-environment node
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

function createFetchWorker(path, cachedBody, networkFetch) {
  const origin = 'https://fit.example'
  const request = new Request(new URL(path, origin))
  const previousEntries = new Map([[request.url, new Response(cachedBody)]])
  const runtimeEntries = new Map()
  const listeners = {}
  const keyFor = value => typeof value === 'string' ? new URL(value, origin).href : value.url
  const cache = {
    put: async (key, response) => { runtimeEntries.set(keyFor(key), response) },
    keys: async () => [...runtimeEntries.keys()].map(url => new Request(url)),
    delete: async key => runtimeEntries.delete(keyFor(key)),
  }
  const context = {
    URL,
    Request,
    Response,
    fetch: networkFetch,
    location: { origin },
    caches: {
      open: async () => cache,
      match: async key => (runtimeEntries.get(keyFor(key)) || previousEntries.get(keyFor(key)))?.clone(),
    },
    self: { addEventListener: (name, handler) => { listeners[name] = handler } },
  }
  vm.runInNewContext(readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8'), context)

  return async () => {
    let response
    const pending = []
    listeners.fetch({
      request,
      respondWith: promise => { response = promise },
      waitUntil: promise => { pending.push(promise) },
    })
    const result = await response
    await Promise.all(pending)
    return result
  }
}

describe('PWA update safety', () => {
  it.each([
    '/icons/app-icon.png',
    '/favicon.ico',
    '/favicon-32x32.png',
    '/apple-touch-icon.png',
    '/apple-touch-icon-180x180.png',
    '/icon-512-v22.png',
    '/brand-logo.png',
    '/manifest.json',
  ])('serves fresh branding bytes over a previous cached response for %s', async path => {
    const networkFetch = vi.fn().mockResolvedValue(new Response('current branding bytes'))
    const fetchResource = createFetchWorker(path, 'old lion branding bytes', networkFetch)

    const response = await fetchResource()

    expect(await response.text()).toBe('current branding bytes')
    expect(networkFetch).toHaveBeenCalledTimes(1)
    const [networkRequest] = networkFetch.mock.calls[0]
    expect(networkRequest.url).toBe(new URL(path, 'https://fit.example').href)
    expect(networkRequest.cache).toBe('no-cache')
  })

  it.each(['/icon-512-v22.png', '/manifest.json'])('serves cached branding bytes when offline for %s', async path => {
    const networkFetch = vi.fn().mockRejectedValue(new TypeError('Network unavailable'))
    const fetchResource = createFetchWorker(path, 'offline branding bytes', networkFetch)

    const response = await fetchResource()

    expect(await response.text()).toBe('offline branding bytes')
    expect(networkFetch).toHaveBeenCalledTimes(1)
  })

  it('serves cached exercise artwork without requesting the network', async () => {
    const networkFetch = vi.fn().mockResolvedValue(new Response('network exercise bytes'))
    const fetchResource = createFetchWorker('/img/exercises/squat.webp', 'cached exercise bytes', networkFetch)

    const response = await fetchResource()

    expect(await response.text()).toBe('cached exercise bytes')
    expect(networkFetch).not.toHaveBeenCalled()
  })

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
