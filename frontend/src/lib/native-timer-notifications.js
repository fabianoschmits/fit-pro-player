import { MOBILE } from './mobile.js'
import { t } from './i18n-core.js'
import { Capacitor } from '@capacitor/core'

const TIMER_IDS = Object.freeze({ rest: 2001, timed_set: 2002 })
const unsupportedStatus = () => ({ supported: false, permission: 'unavailable', exactPermission: 'unavailable', error: null })

// The OS keeps these deadlines while a native WebView is suspended. Android may still
// defer an inexact alarm; allowWhileIdle is also limited by Doze (once per nine minutes).
// Exact-alarm access is inspected only. Starting a timer never opens Android Settings.
export function createNativeTimerNotifications({ localNotifications, now = Date.now, translate = value => value, platform = 'android' }) {
  const revisions = new Map(), ownership = new Map(), channels = new Map()
  let operations = Promise.resolve(), permissionRequest = null
  const supported = platform !== 'web' && Boolean(localNotifications?.schedule && localNotifications?.cancel)
  const validKind = kind => Object.hasOwn(TIMER_IDS, kind)
  const revise = kind => { const next = (revisions.get(kind) || 0) + 1; revisions.set(kind, next); ownership.delete(kind); return next }
  const enqueue = work => { const result = operations.then(work, work); operations = result.catch(() => {}); return result }
  const remove = kind => localNotifications.cancel({ notifications: [{ id: TIMER_IDS[kind] }] })

  async function displayPermission(interactive, current) {
    let permission = await localNotifications.checkPermissions()
    if (permission.display !== 'granted' && interactive && current()) {
      if (!permissionRequest) {
        permissionRequest = Promise.resolve().then(() => localNotifications.requestPermissions())
        permissionRequest.finally(() => { permissionRequest = null }).catch(() => {})
      }
      permission = await permissionRequest
    }
    return permission.display === 'granted'
  }

  async function channelFor(sound) {
    if (platform !== 'android' || !localNotifications.createChannel) return undefined
    const id = sound ? 'fpp_timer_alerts_v1' : 'fpp_timer_alerts_quiet_v1'
    if (!channels.has(id)) {
      const creation = Promise.resolve().then(() => localNotifications.createChannel({
        id,
        name: `${translate('Local timer alerts')} · ${translate(sound ? 'Sounds' : 'Off')}`,
        importance: sound ? 4 : 2,
        vibration: sound,
        visibility: 0,
      })).then(() => id).catch(error => {
        // Android 6/7 supports deadlines but predates channels. On those versions the
        // plugin uses the OS notification sound settings instead of per-channel sounds.
        if (error?.code === 'UNAVAILABLE') return undefined
        channels.delete(id)
        throw error
      })
      channels.set(id, creation)
    }
    return channels.get(id)
  }

  async function schedule(kind, endsAt, { interactive = true, enabled = true, sound = true } = {}) {
    if (!supported || !validKind(kind)) return false
    const revision = revise(kind), current = () => revisions.get(kind) === revision
    // Cancel independently of the permission dialog, so a later stop never waits for it.
    const removed = enqueue(() => remove(kind)).catch(() => false)
    if (!enabled || !Number.isFinite(endsAt) || endsAt <= now()) { await removed; return false }
    try {
      const permitted = await displayPermission(interactive, current)
      await removed
      if (!permitted || !current() || endsAt <= now()) return false
      return await enqueue(async () => {
        if (!current() || endsAt <= now()) return false
        const channelId = await channelFor(sound)
        if (!current() || endsAt <= now()) return false
        const title = translate(kind === 'rest' ? 'Rest over — next set!' : 'Your timed set is complete.')
        await localNotifications.schedule({ notifications: [{
          id: TIMER_IDS[kind], title, body: title,
          schedule: { at: new Date(endsAt), allowWhileIdle: true },
          smallIcon: 'ic_stat_notification', iconColor: '#0F8B8D',
          ...(channelId ? { channelId } : {}),
          extra: { kind },
        }] })
        if (!current()) { await remove(kind); return false }
        ownership.set(kind, revision)
        return true
      })
    } catch { return false }
  }

  async function cancel(kind) {
    if (!supported || !validKind(kind)) return false
    revise(kind)
    try { await enqueue(() => remove(kind)); return true } catch { return false }
  }

  async function status() {
    if (!supported) return unsupportedStatus()
    try {
      const permission = (await localNotifications.checkPermissions()).display
      const exactPermission = platform === 'android' && localNotifications.checkExactNotificationSetting
        ? (await localNotifications.checkExactNotificationSetting()).exact_alarm : 'unavailable'
      return { supported: true, permission, exactPermission, error: null }
    } catch { return { supported: true, permission: 'unavailable', exactPermission: 'unavailable', error: 'unavailable' } }
  }

  return { schedule, cancel, status, ownsAlert: kind => validKind(kind) && ownership.get(kind) === revisions.get(kind) && ownership.has(kind) }
}

let nativeController = null, loadingController = null
const nativeRevisions = new Map(), nativeOwnership = new Map()
const reviseNative = kind => { const revision = (nativeRevisions.get(kind) || 0) + 1; nativeRevisions.set(kind, revision); nativeOwnership.delete(kind); return revision }

async function getNativeController() {
  if (!MOBILE) return null
  if (!loadingController) {
    loadingController = import('@capacitor/local-notifications')
      .then(({ LocalNotifications }) => {
        nativeController = createNativeTimerNotifications({ localNotifications: LocalNotifications, platform: Capacitor.getPlatform(), translate: t })
        return nativeController
      }).catch(() => { loadingController = null; return null })
  }
  return loadingController
}

export async function scheduleNativeTimer(kind, endsAt, options = {}) {
  if (!MOBILE || !Object.hasOwn(TIMER_IDS, kind)) return false
  const revision = reviseNative(kind)
  const controller = await getNativeController()
  if (!controller || nativeRevisions.get(kind) !== revision) return false
  const scheduled = await controller.schedule(kind, endsAt, options)
  if (nativeRevisions.get(kind) !== revision) return false
  if (scheduled && controller.ownsAlert(kind)) nativeOwnership.set(kind, revision)
  return scheduled
}

export async function cancelNativeTimer(kind) {
  if (!MOBILE || !Object.hasOwn(TIMER_IDS, kind)) return false
  reviseNative(kind)
  // Revise an already loaded controller synchronously before any awaiting wrapper work.
  if (nativeController) return nativeController.cancel(kind)
  const controller = await getNativeController()
  return controller ? controller.cancel(kind) : false
}

export function nativeTimerOwnsAlert(kind) {
  return MOBILE && nativeOwnership.has(kind) && nativeOwnership.get(kind) === nativeRevisions.get(kind) && Boolean(nativeController?.ownsAlert(kind))
}

export async function getNativeTimerNotificationStatus() {
  const controller = await getNativeController()
  return controller ? controller.status() : unsupportedStatus()
}
