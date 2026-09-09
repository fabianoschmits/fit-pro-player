/* Fit Pro Player service worker — runtime caching (works with Vite's hashed asset names).
   Media (img/gif) cache-first; everything else network-first with offline fallback.
   Bump CACHE when shipping large asset replacements so activate drops stale entries. */
const CACHE = 'fit-pro-player-rt-v10'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => {
    const oldRuntimeCache = keys.some(k => k.startsWith('fit-pro-player-rt-') && k !== CACHE)
    return Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
      .then(() => self.clients.claim())
      .then(() => oldRuntimeCache ? self.clients.matchAll({ type: 'window' }) : [])
      .then(clients => Promise.all(clients.map(client => client.navigate(client.url))))
  }))
})
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {}
  e.waitUntil(self.registration.showNotification(data.title || 'Fit Pro Player', {
    body: data.body || '',
    icon: 'icon-512.png',
    badge: 'icon-180.png',
    tag: data.tag || 'fitproplayer',
    renotify: true
  }))
})
self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(clients => {
    const c = clients.find(c => 'focus' in c)
    return c ? c.focus() : self.clients.openWindow('./')
  }))
})

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting()
  if (e.data?.type === 'CLEAR_RUNTIME_CACHE') {
    e.waitUntil(caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith('fit-pro-player-rt-')).map(k => caches.delete(k)))
    ))
  }
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET') return
  const sameOrigin = url.origin === location.origin
  if (!sameOrigin) return
  if (sameOrigin && url.pathname.startsWith('/api/')) return    // never cache auth/data

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
