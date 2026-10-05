import { create } from 'zustand'
import { buildNotificationSchedule, normalizeNotificationPreferences } from './notification-preferences.js'

const INITIAL_STATUS = { supported: false, native: false, enabled: false, permission: 'default', busy: false, error: null, ready: false }
export const useNotificationStatus = create(() => ({ ...INITIAL_STATUS }))
let currentCoordinator = null
const hidden = doc => doc?.hidden || doc?.visibilityState === 'hidden'
const browserEnvironment = () => ({ document: globalThis.document, navigator: globalThis.navigator, Notification: globalThis.Notification,
  storage: globalThis.localStorage, crypto: globalThis.crypto, now: () => Date.now() })
const bytes = value => Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=')), c => c.charCodeAt(0))
const messageWorker = (registration, message) => new Promise(resolve => {
  if (!registration?.active || !globalThis.MessageChannel) return resolve(null)
  const channel = new MessageChannel()
  const finish = value => { clearTimeout(timeout); channel.port1.close(); resolve(value) }
  const timeout = setTimeout(() => finish(null), 2000)
  channel.port1.onmessage = event => finish(event.data)
  try { registration.active.postMessage(message, [channel.port2]) } catch { finish(null) }
})

// Browser-only device metadata never enters backups or an account snapshot.
export function createNotificationCoordinator({ client, userId, getState, notify = () => {}, onStatus = () => {}, environment = browserEnvironment() }) {
  const env = environment
  const key = `fpp_push_device_v1:${userId || 'anonymous'}`
  let saved = null
  try { saved = JSON.parse(env.storage?.getItem(key) || 'null') } catch { /* damaged device metadata is rebuilt */ }
  let deviceKey = saved?.deviceKey || env.crypto?.randomUUID?.()
  let disposed = false, generation = 0, registration = null, config = null, heartbeat = null, syncTimeout = null, syncRunning = null
  let status = { ...INITIAL_STATUS, native: !!env.nativePush, permission: env.Notification?.permission || 'default',
    supported: !!(env.nativePush || env.Notification && env.navigator?.serviceWorker?.getRegistration) }
  let lastFingerprint = saved?.fingerprint || null
  let mutationQueue = Promise.resolve()
  const mutate = operation => { const result = mutationQueue.then(operation); mutationQueue = result.catch(() => {}); return result }
  const seenEvents = new Set()
  let contextWrite = Promise.resolve(true)
  const preferences = () => {
    const { rest, timedSet, ...remote } = normalizeNotificationPreferences(getState()?.notifications, getState()?.reminder)
    return remote
  }
  const hasRemoteCategories = () => {
    const prefs = preferences()
    return prefs.workoutReminder || prefs.weightReminder || prefs.measurementReminder || prefs.professional
  }
  const publish = patch => { if (disposed) return; status = { ...status, ...patch }; onStatus(status) }
  const persist = enabled => { try { env.storage?.setItem(key, JSON.stringify({ deviceKey, enabled, fingerprint: lastFingerprint })) } catch { /* local preferences remain usable */ } }
  const rpc = async (name, args) => {
    if (!client?.rpc || !userId || disposed) throw new Error('notifications-unavailable')
    const { data, error } = await client.rpc(name, args)
    if (error) throw error
    return data
  }
  const workerContext = (enabled = status.enabled && !disposed) => {
    const message = { type: 'NOTIFICATION_CONTEXT', context: { ownerId: userId, deviceKey, enabled } }
    contextWrite = (env.nativePush ? env.nativePush.writeContext(message.context) : env.writeWorkerContext ? env.writeWorkerContext(registration, message) : messageWorker(registration, message)).then(result => result === true || result?.stored === true)
    return contextWrite
  }
  const acknowledge = async events => {
    const ids = []
    const prefs = preferences()
    const category = { workout_reminder: 'workoutReminder', weight_reminder: 'weightReminder', measurement_reminder: 'measurementReminder' }
    for (const event of Array.isArray(events) ? events : []) {
      if (!event?.id || disposed || hidden(env.document)) continue
      ids.push(event.id)
      if (!seenEvents.has(event.id)) {
        seenEvents.add(event.id)
        if (prefs[category[event.kind] || 'professional']) notify(event.kind)
      }
    }
    if (ids.length) await rpc('consume_notification_events', { p_device_key: deviceKey, p_event_ids: ids }).catch(() => { publish({ error: 'notification-sync-failed' }) })
  }
  const startHeartbeat = () => {
    clearTimeout(heartbeat); heartbeat = null
    if (disposed || !status.enabled || hidden(env.document) || !hasRemoteCategories()) return
    heartbeat = setTimeout(async () => { await presence(); startHeartbeat() }, 45000)
  }
  const presence = async () => {
    if (!status.enabled || disposed || env.navigator?.onLine === false || !hasRemoteCategories()) return
    try {
      const events = await rpc('set_notification_presence', { p_device_key: deviceKey, p_foreground: !hidden(env.document) })
      if (!disposed) await acknowledge(events)
    } catch { publish({ error: 'notification-sync-failed' }) }
  }
  const register = async (subscription, token = generation) => {
    if (disposed || token !== generation) return false
    const S = getState(), prefs = preferences()
    const schedule = prefs.workoutReminder || prefs.weightReminder || prefs.measurementReminder ? buildNotificationSchedule(S, new Date(env.now())) : {}
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', lang = S.lang || 'pt'
    const serialized = subscription.toJSON ? subscription.toJSON() : subscription
    const fingerprint = JSON.stringify([serialized, prefs, schedule, timezone, lang])
    if (fingerprint !== lastFingerprint || !saved?.enabled) {
      const result = await mutate(() => {
        if (disposed || token !== generation) return false
        return rpc('register_notification_device', { p_device_key: deviceKey, p_subscription: serialized,
          p_preferences: prefs, p_timezone: timezone, p_lang: lang, p_schedule: schedule })
      })
      if (result === false) return false
      if (disposed || token !== generation) return false
      lastFingerprint = fingerprint
    }
    return true
  }
  const getRegistration = async () => {
    if (env.nativePush) return env.nativePush.registration()
    const reg = await env.navigator.serviceWorker.getRegistration()
    if (!reg?.pushManager) throw new Error('push-unsupported')
    const capabilities = env.checkWorkerSupport ? await env.checkWorkerSupport(reg) : await messageWorker(reg, { type: 'NOTIFICATION_CAPABILITIES' })
    if (!(capabilities === true || capabilities?.supported === true)) throw new Error('push-worker-unavailable')
    return reg
  }
  const initialize = async () => {
    const token = generation
    publish({ permission: env.Notification?.permission || 'default' })
    if (!client || !userId || disposed || !status.supported) return
    try {
      registration = await getRegistration()
      if (disposed || token !== generation) return
      if (env.nativePush) publish({ permission: await env.nativePush.checkPermission() })
      config = await rpc('notification_config')
      if (disposed || token !== generation) return
      publish({ ready: !!(config?.ready && (!env.nativePush || config?.nativeReady)), error: null })
      if (!saved?.enabled || status.permission !== 'granted' || !status.ready) return
      const subscription = await registration.pushManager.getSubscription()
      if (disposed || token !== generation) return
      if (!subscription) { persist(false); return }
      if (!await workerContext(true)) throw new Error('push-worker-unavailable')
      if (!(await register(subscription, token)) || disposed || token !== generation) return
      publish({ enabled: true }); persist(true)
      if (!await workerContext()) throw new Error('push-worker-unavailable')
      await presence(); startHeartbeat()
      if (env.nativePush) void env.nativePush.refresh().catch(() => publish({ error: 'notification-sync-failed' }))
    } catch (error) { publish({ error: 'notifications-unavailable', enabled: false, ...(error.message === 'push-unsupported' ? { supported: false } : {}) }); void workerContext() }
  }
  const enable = async () => {
    if (!status.ready || !userId || status.busy || disposed) return false
    publish({ busy: true, error: null })
    const token = ++generation
    try {
      // Permission is requested directly from the user's click, before any network wait.
      const permission = env.nativePush ? await env.nativePush.requestPermission() : env.Notification.permission === 'granted' ? 'granted' : await env.Notification.requestPermission()
      if (disposed || token !== generation) return false
      publish({ permission })
      if (permission !== 'granted') return false
      registration = await getRegistration()
      if (disposed || token !== generation) return false
      let subscription = await registration.pushManager.getSubscription()
      if (disposed || token !== generation) return false
      if (!subscription) subscription = await registration.pushManager.subscribe(env.nativePush ? undefined : { userVisibleOnly: true, applicationServerKey: bytes(config.vapidPublicKey) })
      if (disposed || token !== generation) return false
      if (!await workerContext(true) || disposed || token !== generation) throw new Error('push-worker-unavailable')
      if (!(await register(subscription, token)) || disposed || token !== generation) return false
      publish({ enabled: true }); saved = { enabled: true }; persist(true)
      if (!await workerContext()) throw new Error('push-worker-unavailable')
      await presence(); startHeartbeat(); return true
    } catch { publish({ error: 'notification-registration-failed', enabled: false }); void workerContext(); return false }
    finally { publish({ busy: false }) }
  }
  const disable = async () => {
    const token = ++generation; clearTimeout(heartbeat); heartbeat = null
    saved = { enabled: false }; lastFingerprint = null
    publish({ enabled: false, busy: true }); persist(false); await workerContext()
    let success = true
    if (userId && deviceKey && client) {
      try { await mutate(async () => {
        const result = await client.rpc('disable_notification_device', { p_device_key: deviceKey })
        if (result.error) throw result.error
      }) } catch { success = false }
    }
    try {
      if (!disposed && token === generation) {
        const subscription = await registration?.pushManager?.getSubscription()
        if (subscription && !disposed && token === generation) await subscription.unsubscribe()
      }
    } catch { success = false }
    publish({ busy: false, error: success ? null : 'notification-disable-failed' }); return success
  }
  const visibilityChanged = async () => {
    publish({ permission: env.nativePush ? await env.nativePush.checkPermission() : env.Notification?.permission || 'default' })
    if (status.enabled && status.permission !== 'granted') { await disable(); return }
    clearTimeout(heartbeat); heartbeat = null; await presence(); startHeartbeat()
    if (!hidden(env.document)) sync()
  }
  let syncAgain = false
  const syncNow = async (force = false) => {
      if (disposed || !status.enabled || env.navigator?.onLine === false) return
      if (syncRunning) { syncAgain = true; await syncRunning; return }
      const token = generation
      syncRunning = (async () => {
        try {
          const subscription = await registration.pushManager.getSubscription()
          if (!subscription || disposed || token !== generation) return
          if (force) lastFingerprint = null
          if (!await register(subscription, token) || disposed || token !== generation) return
          persist(true)
          startHeartbeat()
          publish({ error: null })
        } catch { publish({ error: 'notification-sync-failed' }) }
      })()
      await syncRunning; syncRunning = null
      if (syncAgain) { syncAgain = false; sync() }
  }
  const sync = () => {
    clearTimeout(syncTimeout)
    if (!status.enabled || disposed) return
    syncTimeout = setTimeout(() => { void syncNow() }, 500)
  }
  const reconnect = async () => {
    if (!status.enabled || disposed) return
    clearTimeout(syncTimeout)
    await syncNow(true)
    await presence(); startHeartbeat()
  }
  const dispose = () => {
    if (disposed) return
    clearTimeout(heartbeat); clearTimeout(syncTimeout); ++generation
    status = { ...status, enabled: false }; workerContext(); disposed = true
  }
  return { initialize, enable, disable, visibilityChanged, sync, reconnect, dispose, status: () => status }
}

export function startNotificationCoordinator(options) {
  currentCoordinator?.dispose()
  const coordinator = createNotificationCoordinator({ ...options, onStatus: status => useNotificationStatus.setState(status, true) })
  currentCoordinator = coordinator
  useNotificationStatus.setState({ ...INITIAL_STATUS }, true)
  void coordinator.initialize()
  return () => { coordinator.dispose(); if (currentCoordinator === coordinator) { currentCoordinator = null; useNotificationStatus.setState({ ...INITIAL_STATUS }, true) } }
}
export const enableBackgroundNotifications = () => currentCoordinator?.enable() || Promise.resolve(false)
export const disableBackgroundNotifications = () => currentCoordinator?.disable() || Promise.resolve(true)
export const syncNotificationPreferences = () => currentCoordinator?.sync()
export const syncNotificationVisibility = () => currentCoordinator?.visibilityChanged()
export const reconnectNotifications = () => currentCoordinator?.reconnect()
export const refreshNotificationReadiness = () => {
  if (currentCoordinator && !currentCoordinator.status().enabled && !currentCoordinator.status().busy) void currentCoordinator.initialize()
}
export const hasBackgroundNotifications = () => !!currentCoordinator?.status().enabled
