// Mobile build (VITE_MOBILE=1) — the standalone app-store version (Capacitor native shell).
//
// Native persistence mirrors the scoped training state to a private JSON file, because
// WebView localStorage can be evicted under storage pressure. Account and guest data use
// separate paths. Rest/timed-set deadlines are device-local OS notifications; account
// reminders and professional updates use the separate background notification client.
// Obsolete repeating weekly alerts are cancelled once on boot; current preferences
// and calendar reminders belong to the notification coordinator.
//
// Like the demo build, MOBILE is replaced at build time, so all of this folds away in
// web bundles; the Capacitor plugins are only ever imported behind it.
import { ANONYMOUS_SCOPE, nativePathForScope } from './local-state-scope.js'
import { serializeStateOnly } from './account-cache.js'
import { validateBackup } from './backup-state.js'

export const MOBILE = import.meta.env.VITE_MOBILE === '1'
const nativeWrites = new Map()

function enqueueNative(scope, work) {
  const key = nativePathForScope(scope)
  const pending = (nativeWrites.get(key) || Promise.resolve()).then(work, work)
  nativeWrites.set(key, pending)
  pending.finally(() => { if (nativeWrites.get(key) === pending) nativeWrites.delete(key) })
  return pending
}

export async function nativeLoad(scope = ANONYMOUS_SCOPE) {
  try {
    await (nativeWrites.get(nativePathForScope(scope)) || Promise.resolve())
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    const r = await Filesystem.readFile({ path: nativePathForScope(scope), directory: Directory.Data, encoding: Encoding.UTF8 })
    const state = validateBackup(JSON.parse(r.data))
    if (scope.kind === 'account') state.pendingProfessionalEvents = (state.pendingProfessionalEvents || []).filter(event => event.accountId === scope.userId)
    else state.pendingProfessionalEvents = []
    return state
  } catch (e) { return null }   // first launch, or unreadable — localStorage copy takes over
}

export function nativeSave(scope = ANONYMOUS_SCOPE, state) {
  let data
  try { data = serializeStateOnly(state) } catch { return Promise.resolve(false) }
  return enqueueNative(scope, async () => {
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
      await Filesystem.writeFile({ path: nativePathForScope(scope), directory: Directory.Data, data, encoding: Encoding.UTF8 })
      return true
    } catch { return false }
  })
}

// A timestamped empty snapshot survives WebView eviction and supersedes old queued writes.
export function nativeClear(scope = ANONYMOUS_SCOPE, emptyState = { routines: [], workouts: [], _ts: Date.now() }) {
  return nativeSave(scope, emptyState)
}

// Retire alerts from the old weekly-reminder control without requesting permissions.
// IDs 100..106 are disjoint from the current rest/timed-set IDs 2001/2002.
export async function clearLegacyReminders() {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: Array.from({ length: 7 }, (_, day) => ({ id: 100 + day })) })
    return true
  } catch { return false }
}

// WKWebView can't do blob-URL downloads, so the backup goes out through the OS share sheet
// (Files, AirDrop, mail, …) from a temp file instead.
export async function shareExport(json, filename) {
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')
  const w = await Filesystem.writeFile({ path: filename, directory: Directory.Cache, data: json, encoding: Encoding.UTF8 })
  await Share.share({ title: filename, url: w.uri })
}
