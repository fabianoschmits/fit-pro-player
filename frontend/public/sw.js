/* Fit Pro Player service worker — runtime caching (works with Vite's hashed asset names).
   Media (img/gif) cache-first; everything else network-first with offline fallback.
   Bump CACHE when shipping large asset replacements so activate drops stale entries. */
const CACHE = 'fit-pro-player-rt-v12'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => {
    // Keep one previous shell until the new worker has populated its runtime cache. If an
    // update activates just as the connection drops, caches.match can still serve the old
    // index and its hashed assets instead of leaving the installed PWA blank.
    const runtime = keys.filter(k => k.startsWith('fit-pro-player-rt-'))
    const version = key => Number(key.match(/-v(\d+)$/)?.[1] || 0)
    const previous = runtime.filter(k => k !== CACHE).sort((a, b) => version(b) - version(a))[0]
    const keep = new Set([CACHE, previous].filter(Boolean))
    return Promise.all(runtime.filter(k => !keep.has(k)).map(k => caches.delete(k)))
      .then(() => self.clients.claim())
  }))
})
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET') return
  const sameOrigin = url.origin === location.origin
  if (!sameOrigin) return
  const isMedia = url.pathname.includes('/img/') || url.pathname.includes('/gif/')
  if (isMedia) {
    e.respondWith(caches.open(CACHE).then(c => c.match(e.request).then(hit =>
      hit || fetch(e.request).then(res => {
        if (res.ok || res.type === 'opaque') c.put(e.request, res.clone())
        return res
      })
    )))
  } else {
    const req = e.request.mode === 'navigate' || e.request.destination === 'document'
      ? new Request(e.request, { cache: 'no-store' })
      : e.request
    e.respondWith(fetch(req).then(res => {
      if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
      return res
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match('index.html'))))
  }
})
