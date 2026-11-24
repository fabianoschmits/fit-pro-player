import { useEffect, useState } from 'react'
import { addCalendarDays, calendarDate, calendarTimestamp, resolveWeeklyTimeZone } from './weekly-progress-calendar.js'

// One boundary timer, plus foreground/connection events. No recurring polling.
export function useWeeklyClock(timeZone = undefined) {
  const zone = resolveWeeklyTimeZone(timeZone)
  const [now, setNow] = useState(() => new Date())
  const [online, setOnline] = useState(() => navigator.onLine !== false)
  useEffect(() => {
    let timer
    const refresh = () => {
      clearTimeout(timer)
      const instant = new Date()
      setNow(instant); setOnline(navigator.onLine !== false)
      const next = calendarTimestamp(addCalendarDays(calendarDate(instant, zone), 1), zone)
      timer = setTimeout(refresh, Math.max(1000, Math.min(2147483647, next - instant.getTime() + 100)))
    }
    refresh()
    const visible = () => { if (!document.hidden) refresh() }
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh); window.addEventListener('offline', refresh)
    document.addEventListener('visibilitychange', visible)
    return () => { clearTimeout(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); window.removeEventListener('offline', refresh); document.removeEventListener('visibilitychange', visible) }
  }, [zone])
  return { now, online, timeZone: zone }
}
