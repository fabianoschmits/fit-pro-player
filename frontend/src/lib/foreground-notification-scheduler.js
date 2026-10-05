import { nextForegroundReminders } from './foreground-reminders.js'

// No network polling: the next calendar event drives one browser timeout.
export function createForegroundNotificationScheduler({ scope, getState, backgroundEnabled, notify, environment = globalThis }) {
  let timer = null, disposed = false
  const key = `fpp_local_notification_ids_v1:${scope}`
  let seen = new Set()
  try { seen = new Set(JSON.parse(environment.localStorage?.getItem(key) || '[]')) } catch { /* rebuild local receipts */ }
  const sync = () => {
    environment.clearTimeout(timer); timer = null
    if (disposed || backgroundEnabled() || environment.document?.hidden || environment.document?.visibilityState === 'hidden') return
    const now = environment.Date.now()
    const next = nextForegroundReminders(getState(), new Date(now)).find(event => !seen.has(event.id))
    if (!next) return
    timer = environment.setTimeout(() => {
      if (disposed || backgroundEnabled() || environment.document?.hidden) return
      // A plan edit, completed workout or updated measurement can invalidate the event.
      const valid = nextForegroundReminders(getState(), new Date(environment.Date.now())).some(event => event.id === next.id && event.dueAt <= environment.Date.now())
      if (valid) {
        seen.add(next.id)
        seen = new Set([...seen].slice(-100))
        try { environment.localStorage?.setItem(key, JSON.stringify([...seen])) } catch { /* in-memory dedupe remains */ }
        notify(next.kind)
      }
      sync()
    }, Math.min(2147483647, Math.max(0, next.dueAt - now)))
  }
  return { sync, dispose() { disposed = true; environment.clearTimeout(timer) } }
}
