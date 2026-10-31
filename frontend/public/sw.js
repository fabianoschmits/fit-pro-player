/* Fit Pro Player service worker — multi-cache offline strategy with workbox precache injection.
   Shell assets are precached at install time; exercise sprites go to a dedicated never-evicted
   cache; runtime JS/CSS/fonts and static images use separate stale-while-network caches. */

const SHELL_CACHE = 'fpp-shell-v1'
const RUNTIME_CACHE = 'fpp-runtime-v1'
const EXERCISE_CACHE = 'fpp-exercise-media-v1'
const STATIC_MEDIA_CACHE = 'fpp-static-media-v1'

const SHELL_PRECACHE = self.__WB_MANIFEST || []

// Build a Set of shell URLs for fast lookup
const SHELL_URL_SET = new Set(SHELL_PRECACHE.map(entry => typeof entry === 'string' ? entry : entry.url))

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => {
      const urls = SHELL_PRECACHE.map(entry => typeof entry === 'string' ? entry : entry.url)
      return cache.addAll(urls)
    })
  )
  // Auto-activate only on first install (no existing controller)
  if (!self.registration?.active) self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      const currentCaches = new Set([SHELL_CACHE, RUNTIME_CACHE, EXERCISE_CACHE, STATIC_MEDIA_CACHE])
      // Also keep one previous shell and one previous runtime during transition
      const version = key => Number(key.match(/-v(\d+)$/)?.[1] || 0)
      const shells = keys.filter(k => k.startsWith('fpp-shell-') || k.startsWith('fit-pro-player-rt-'))
      const oldShell = shells.filter(k => k !== SHELL_CACHE).sort((a, b) => version(b) - version(a))[0]
      if (oldShell) currentCaches.add(oldShell)
      const runtimes = keys.filter(k => k.startsWith('fpp-runtime-'))
      const oldRuntime = runtimes.filter(k => k !== RUNTIME_CACHE).sort((a, b) => version(b) - version(a))[0]
      if (oldRuntime) currentCaches.add(oldRuntime)
      return Promise.all(
        keys
          .filter(k => !currentCaches.has(k) && (k.startsWith('fpp-') || k.startsWith('fit-pro-player-')))
          .map(k => caches.delete(k))
      )
    }).then(() => self.clients.claim())
  )
  // Request persistent storage for exercise sprites
  try {
    if (typeof self !== 'undefined' && self.navigator?.storage?.persist) {
      self.navigator.storage.persist().catch?.(() => {})
    }
  } catch {}
})

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting()
  if (!sameOriginMessage(e)) return
  if (e.data?.type === 'NOTIFICATION_CAPABILITIES') e.ports?.[0]?.postMessage({ supported: true })
  if (e.data?.type === 'NOTIFICATION_CONTEXT') {
    e.waitUntil(serializeNotifications(async () => {
      let stored = false
      try { stored = await storeNotificationContext(e.data.context) } catch { /* fail closed without durable context */ }
      e.ports?.[0]?.postMessage({ type: 'NOTIFICATION_CONTEXT_ACK', supported: true, stored })
    }))
  }
})

const NOTIFICATION_KINDS = new Set(['workout_reminder', 'weight_reminder',
  'measurement_reminder', 'program_received','program_updated', 'program_removed', 'relationship_accepted',
  'relationship_ended', 'student_workout_completed', 'student_workout_abandoned', 'verification_changed'])
const NOTIFICATION_ROUTES = new Set(['/home', '/plan', '/workout', '/stats', '/body-progress',
  '/professional-profile', '/professional/profile', '/professional', '/professional/invites',
  '/professional/students', '/professional/programs', '/connect', '/student/professionals',
  '/history', '/library', '/more', '/settings'])
const NOTIFICATION_HISTORY_LIMIT = 256
let notificationTasks = Promise.resolve()
let notificationDatabase

function serializeNotifications(task) {
  const next = notificationTasks.then(task)
  notificationTasks = next.catch(() => {})
  return next
}

function sameOriginMessage(event) {
  try { return new URL(event.source?.url).origin === location.origin } catch { return false }
}

function openNotificationDatabase() {
  if (!notificationDatabase) {
    notificationDatabase = new Promise((resolve, reject) => {
      const request = indexedDB.open('fit-pro-player-notifications', 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('state')) request.result.createObjectStore('state')
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('Notification storage unavailable'))
    }).catch(error => { notificationDatabase = null; throw error })
  }
  return notificationDatabase
}

async function readNotificationState() {
  const database = await openNotificationDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('state', 'readonly')
    const request = transaction.objectStore('state').get('current')
    request.onsuccess = () => resolve(request.result || { context: null, seen: [] })
    request.onerror = () => reject(request.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

async function writeNotificationState(state) {
  const database = await openNotificationDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('state', 'readwrite')
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
    transaction.objectStore('state').put(state, 'current')
  })
}

const notificationIdentity = value => typeof value === 'string' && value.length > 0 && value.length <= 256

async function storeNotificationContext(next) {
  if (!next || !notificationIdentity(next.ownerId) || !notificationIdentity(next.deviceKey)
    || typeof next.enabled !== 'boolean') return false
  const state = await readNotificationState()
  const previous = state.context
  const sameOwnerDevice = previous?.ownerId === next.ownerId && previous?.deviceKey === next.deviceKey
  // A disposed coordinator from the previous account cannot disable a new account.
  if (!next.enabled && previous && !sameOwnerDevice) return false
  state.context = { ownerId: next.ownerId, deviceKey: next.deviceKey, enabled: next.enabled }
  state.seen = Array.isArray(state.seen) ? state.seen.filter(item => item.expiresAt > Date.now()).slice(-NOTIFICATION_HISTORY_LIMIT) : []
  await writeNotificationState(state)
  return true
}

function safeNotificationHref(href) {
  if (typeof href !== 'string' || href.length > 512 || !href.startsWith('/#/')) return '/#/home'
  const route = href.slice(2)
  const dynamicRoute = /^\/(?:professional\/students|plan\/r)\/[A-Za-z0-9_-]{1,128}$/.test(route)
  return NOTIFICATION_ROUTES.has(route) || dynamicRoute ? href : '/#/home'
}

function currentNotification(payload, context) {
  if (!payload || !context?.enabled || !notificationIdentity(payload.id)
    || payload.ownerId !== context.ownerId || payload.deviceKey !== context.deviceKey
    || !NOTIFICATION_KINDS.has(payload.kind) || typeof payload.expiresAt !== 'string'
    || !Number.isFinite(Date.parse(payload.expiresAt)) || Date.parse(payload.expiresAt) <= Date.now()) return false
  return true
}

self.addEventListener('push', event => {
  let payload
  try { payload = event.data?.json() } catch { return }
  if (!payload) return
  event.waitUntil(serializeNotifications(async () => {
    try {
      const state = await readNotificationState()
      if (!currentNotification(payload, state.context)
        || typeof payload.title !== 'string' || !payload.title || payload.title.length > 200
        || typeof payload.body !== 'string' || !payload.body || payload.body.length > 500) return
      const seen = (Array.isArray(state.seen) ? state.seen : []).filter(item => item.expiresAt > Date.now())
      if (seen.some(item => item.id === payload.id)) return
      const data = { id: payload.id, ownerId: payload.ownerId, deviceKey: payload.deviceKey,
        kind: payload.kind, expiresAt: payload.expiresAt,
        href: safeNotificationHref(payload.href) }
      // Apple's userVisibleOnly subscription requires visible feedback for accepted pushes.
      await self.registration.showNotification(payload.title, {
        body: payload.body, icon: '/icons/lion-794daf1cde13-192.png', tag: `fit-pro-player:${payload.id}`, data,
      })
      state.seen = [...seen, { id: payload.id, expiresAt: Date.parse(payload.expiresAt) }].slice(-NOTIFICATION_HISTORY_LIMIT)
      await writeNotificationState(state)
    } catch { /* unreadable storage or an OS failure cannot produce an unsafe account notification */ }
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(serializeNotifications(async () => {
    try {
      const data = event.notification.data
      const state = await readNotificationState()
      if (!currentNotification(data, state.context)) return
      const href = safeNotificationHref(data.href)
      const target = new URL(href, location.origin).href
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const appClients = clients.filter(client => {
        try { const url = new URL(client.url); return url.origin === location.origin && url.pathname === '/' } catch { return false }
      })
      const client = appClients.find(item => item.focused) || appClients[0]
      if (client) {
        const navigated = await client.navigate?.(target)
        await (navigated || client).focus()
      } else await self.clients.openWindow(target)
    } catch { /* a closed window or unavailable storage leaves the notification dismissed */ }
  }))
})

async function exerciseCacheFirst(request) {
  const url = new URL(request.url)
  const cache = await caches.open(EXERCISE_CACHE)
  const hit = await cache.match(url.href, { ignoreVary: true, ignoreSearch: true })
    || await cache.match(request, { ignoreVary: true })
    || await caches.match(url.href, { ignoreVary: true })
  if (hit) return hit
  try {
    const res = await fetch(request)
    if (res.ok || res.type === 'opaque') {
      await cache.put(url.href, res.clone())
      await cache.put(request, res.clone())
    }
    return res
  } catch {
    const fallback = await cache.match(url.href, { ignoreVary: true, ignoreSearch: true })
      || await cache.match(request, { ignoreVary: true })
      || await caches.match(url.href, { ignoreVary: true })
    return fallback || Response.error()
  }
}

async function staticMediaCacheFirst(request) {
  const hit = await caches.match(request, { ignoreVary: true })
  if (hit) return hit
  try {
    const res = await fetch(request)
    if (res.ok || res.type === 'opaque') {
      const cache = await caches.open(STATIC_MEDIA_CACHE)
      await cache.put(request, res.clone())
    }
    return res
  } catch {
    return Response.error()
  }
}

async function shellCacheFirst(request) {
  const hit = await caches.match(request, { ignoreVary: true, cacheName: SHELL_CACHE })
  if (hit) return hit
  try {
    const res = await fetch(request)
    if (res.ok) {
      const cache = await caches.open(RUNTIME_CACHE)
      await cache.put(request, res.clone())
    }
    return res
  } catch {
    return caches.match(request, { ignoreVary: true }).then(h => h || Response.error())
  }
}

async function navigateFetch(request) {
  try {
    const res = await fetch(new Request(request, { cache: 'no-store' }))
    if (res.ok) return res
  } catch { /* offline */ }
  // Serve index.html from shell cache for SPA navigation
  const shellHit = await caches.open(SHELL_CACHE).then(c => c.match('index.html'))
    .catch(() => null)
  if (shellHit) return shellHit
  return caches.match(request, { ignoreVary: true }).then(h => h || Response.error())
}

async function runtimeFetch(request) {
  try {
    const res = await fetch(request)
    if (res.ok) {
      const cache = await caches.open(RUNTIME_CACHE)
      await cache.put(request, res.clone())
    }
    return res
  } catch {
    return caches.match(request, { ignoreVary: true }).then(h => h || Response.error())
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  let url
  try { url = new URL(event.request.url) } catch { return }
  if (url.origin !== location.origin) return

  // Exercise frames and frame loader chunks → cache-first, no eviction
  if (/\/assets\/(frame-[^/]+\.(webp|png)|frames-[^/]+\.js)$/.test(url.pathname)) {
    event.respondWith(exerciseCacheFirst(event.request))
    return
  }

  // Brand assets (icons, manifest) → network-first + fallback (existing behavior)
  const isBrand = url.pathname.startsWith('/icons/')
    || url.pathname === '/manifest.json'
    || /^\/(favicon[^/]*\.(ico|png)|apple-touch-icon[^/]*\.png|icon-[^/]*\.png|brand-logo\.png)$/.test(url.pathname)
  if (isBrand) {
    event.respondWith(
      fetch(new Request(event.request, { cache: 'no-cache' })).then(res => {
        if (res.ok) caches.open(STATIC_MEDIA_CACHE).then(c => c.put(event.request, res.clone()))
        return res
      }).catch(() => caches.match(event.request, { ignoreVary: true }).then(hit => hit || Response.error()))
    )
    return
  }

  // Static images (backgrounds, avatars) → cache-first in STATIC_MEDIA_CACHE
  const isStaticImage = /\.(webp|png|jpg|jpeg|avif|gif|svg)$/.test(url.pathname)
    && !url.pathname.includes('/assets/frame-')
  if (isStaticImage) {
    event.respondWith(staticMediaCacheFirst(event.request))
    return
  }

  // HTML navigation → try network (no-store), fallback to shell cache index.html
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(navigateFetch(event.request))
    return
  }

  // Shell precached JS/CSS → cache-first from SHELL_CACHE
  if (SHELL_URL_SET.has(url.pathname) || SHELL_URL_SET.has(url.href)) {
    event.respondWith(shellCacheFirst(event.request))
    return
  }

  // Other JS/CSS/fonts → runtime cache with network fallback
  event.respondWith(runtimeFetch(event.request))
})
