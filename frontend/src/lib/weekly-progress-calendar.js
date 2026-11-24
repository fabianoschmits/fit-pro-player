// Calendar keys are local dates, not UTC instants. UTC is used only for arithmetic
// over those keys; timestamps are always interpreted in the resolved user zone.
const formatters = new Map()
const DAY = 86400000
const keyOf = date => `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`

export function resolveWeeklyTimeZone(value) {
  for (const candidate of [value, Intl.DateTimeFormat().resolvedOptions().timeZone, 'America/Sao_Paulo']) {
    if (typeof candidate !== 'string' || !candidate) continue
    try { new Intl.DateTimeFormat('en', { timeZone: candidate }); return candidate } catch { /* try the local zone */ }
  }
  return 'America/Sao_Paulo'
}

export function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(parsed.getTime()) && keyOf(parsed) === value
}

function partsOf(date, timeZone) {
  const zone = resolveWeeklyTimeZone(timeZone)
  if (!formatters.has(zone)) formatters.set(zone, new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }))
  return Object.fromEntries(formatters.get(zone).formatToParts(date).map(part => [part.type, part.value]))
}

export function calendarDate(value, timeZone) {
  if (isCalendarDate(value)) return value
  if (value == null || value === '' || typeof value === 'boolean') return null
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  const parts = partsOf(date, timeZone)
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function addCalendarDays(value, days) {
  if (!isCalendarDate(value) || !Number.isInteger(days)) return null
  return keyOf(new Date(new Date(`${value}T12:00:00Z`).getTime() + days * DAY))
}

export function getWeekStart(date, timeZone) {
  const key = calendarDate(date, timeZone)
  if (!key) return null
  const day = new Date(`${key}T12:00:00Z`).getUTCDay()
  return addCalendarDays(key, -((day + 6) % 7))
}
export const getWeekEnd = (date, timeZone) => addCalendarDays(getWeekStart(date, timeZone), 6)
export const getPreviousWeek = (date, timeZone) => addCalendarDays(getWeekStart(date, timeZone), -7)
export const getNextWeek = (date, timeZone) => addCalendarDays(getWeekStart(date, timeZone), 7)
export const getWeekDays = (date, timeZone) => Array.from({ length: 7 }, (_, index) => addCalendarDays(getWeekStart(date, timeZone), index))

// Solve the zone offset independently at each boundary: a DST week need not be 168h.
export function calendarTimestamp(key, timeZone) {
  if (!isCalendarDate(key)) return null
  const nominal = Date.parse(`${key}T00:00:00Z`)
  let result = nominal
  for (let index = 0; index < 4; index++) {
    const p = partsOf(new Date(result), timeZone)
    const represented = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`)
    const next = result + nominal - represented
    if (next === result) break
    result = next
  }
  const resolved = partsOf(new Date(result), timeZone)
  if (`${resolved.year}-${resolved.month}-${resolved.day}` === key && resolved.hour === '00') return result
  // Some historical DST transitions skipped midnight. The day begins at its
  // first existing instant; do not accidentally return 23:00 on the prior day.
  let low = nominal - 36 * 3600000, high = nominal + 36 * 3600000
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2)
    if (calendarDate(middle, timeZone) >= key) high = middle
    else low = middle
  }
  return high
}

export function getWeekRange(weekStart, timeZone) {
  const start = getWeekStart(weekStart, timeZone)
  const end = addCalendarDays(start, 7)
  return { start, end, startTimestamp: calendarTimestamp(start, timeZone), endTimestamp: calendarTimestamp(end, timeZone) }
}

export function normalizeWeekParam(value, now = new Date(), timeZone = undefined) {
  const current = getWeekStart(now, timeZone)
  const requested = isCalendarDate(value) ? getWeekStart(value, timeZone) : null
  return requested && requested <= current ? requested : current
}

export function getComparableWeekRange(weekStart, now = new Date(), timeZone = undefined) {
  const selected = normalizeWeekParam(weekStart, now, timeZone)
  const current = getWeekStart(now, timeZone)
  const today = calendarDate(now, timeZone)
  const comparableDays = selected === current ? Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${selected}T12:00:00Z`)) / DAY) + 1 : 7
  const start = getPreviousWeek(selected, timeZone)
  return { start, end: addCalendarDays(start, comparableDays), comparableDays, mode: selected === current ? 'same-elapsed-days' : 'full-week' }
}
