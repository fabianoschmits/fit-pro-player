/* Fit Pro Player service worker — runtime caching (works with Vite's hashed asset names).
   Media (img/gif) cache-first; everything else network-first with offline fallback.
   Bump CACHE when shipping large asset replacements so activate drops stale entries. */
const CACHE = 'fit-pro-player-rt-v17'
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
  'measurement_reminder', 'program_updated', 'program_removed', 'relationship_accepted',
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
        body: payload.body, icon: '/icon-180.png', tag: `fit-pro-player:${payload.id}`, data,
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
