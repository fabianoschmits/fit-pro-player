/* Fit Pro Player service worker — runtime caching (works with Vite's hashed asset names).
   Media (img/gif) cache-first; everything else network-first with offline fallback.
   Bump CACHE when shipping large asset replacements so activate drops stale entries. */
const CACHE = 'fit-pro-player-rt-v15'
const MEDIA_LIMIT = 256
async function remember(request, response, media = false) {
  const cache = await caches.open(CACHE)
  await cache.put(request, response)
  if (media) {
    const keys = (await cache.keys()).filter(key => /\.(webp|png|jpg|jpeg|avif)$/.test(new URL(key.url).pathname))
    for (const key of keys.slice(0, Math.max(0, keys.length - MEDIA_LIMIT))) await cache.delete(key)
  }
}

// Existing sessions decide when an update may activate. First installation needs no skip.
self.addEventListener('install', () => {})
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
  const isMedia = url.pathname.includes('/img/') || url.pathname.includes('/gif/') || /\.(webp|png|jpg|jpeg|avif)$/.test(url.pathname)
  if (isMedia) {
    e.respondWith(caches.open(CACHE).then(c => caches.match(e.request, { ignoreVary: true }).then(hit =>
      hit || fetch(e.request).then(res => {
        if (res.ok || res.type === 'opaque') e.waitUntil(remember(e.request, res.clone(), true))
        return res
      })
    )))
  } else {
    const req = e.request.mode === 'navigate' || e.request.destination === 'document'
      ? new Request(e.request, { cache: 'no-store' })
      : e.request
    e.respondWith(fetch(req).then(res => {
      if (res.ok) e.waitUntil(remember(e.request, res.clone()))
      return res
    }).catch(() => caches.match(e.request, { ignoreVary: true }).then(async hit => hit || (e.request.mode === 'navigate' ? await caches.match('index.html') : null) || Response.error())))
  }
})
