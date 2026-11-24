// Small shared aggregation for previews. No anatomy, ranking, records or network.
import { workoutDuration } from './format.js'
import { isWarmupRow, modeForSet } from './workout-model.js'
import { addCalendarDays, calendarDate, getComparableWeekRange, getWeekDays, getWeekStart, normalizeWeekParam, resolveWeeklyTimeZone } from './weekly-progress-calendar.js'

export const validWeeklyNumber = value => typeof value === 'number' && Number.isFinite(value) && value >= 0
export const completedWeeklyRows = entry => Array.isArray(entry?.sets) ? entry.sets.filter(row => row && typeof row === 'object' && row.done === true && !isWarmupRow(row)) : []
export const weeklyEntries = workout => Array.isArray(workout?.entries) ? workout.entries.filter(entry => entry && typeof entry.id === 'string' && entry.id && Array.isArray(entry.sets)) : []

// Calendar-only legacy dates have no reliable ordering within a day.
export function workoutCompletionInstant(workout) {
  const value = workout?.completedAt ?? workout?.end
  if (value == null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))) return 0
  const instant = new Date(value).getTime()
  return Number.isFinite(instant) ? instant : 0
}

export function workoutCalendarDate(workout, timeZone) {
  const completion = workout?.completedAt ?? workout?.end
  return completion != null ? calendarDate(completion, timeZone) : calendarDate(workout?.d, timeZone)
}

export function completedWeeklyHistory(workouts, now, timeZone) {
  const today = calendarDate(now, timeZone), instant = new Date(now).getTime()
  const byId = new Map()
  for (const workout of Array.isArray(workouts) ? workouts : []) {
    if (!workout || typeof workout.id !== 'string' || !workout.id || !Array.isArray(workout.entries)
      || (workout.status != null && workout.status !== 'completed') || workout.cancelled === true || workout.discarded === true) continue
    const date = workoutCalendarDate(workout, timeZone)
    const completion = workout.completedAt ?? workout.end
    if (!date || date > today || (completion != null && new Date(completion).getTime() > instant)) continue
    const existing = byId.get(workout.id)
    // Store/domain reconciliation is authoritative. Defensive duplicates choose
    // their latest version using revision/update/completion, never date or title.
    const rank = item => [Number(item?.revision) || 0, Date.parse(item?.updatedAt || '') || 0, workoutCompletionInstant(item)]
    const left = rank(existing), right = rank(workout)
    if (!existing || right[0] > left[0] || (right[0] === left[0] && (right[1] > left[1] || (right[1] === left[1] && right[2] >= left[2])))) byId.set(workout.id, workout)
  }
  return [...byId.values()]
}

export function weeklyWorkoutMetrics(workout) {
  let completedSets = 0, completedReps = 0, exerciseOccurrences = 0
  const exerciseIds = new Set()
  for (const entry of weeklyEntries(workout)) {
    const rows = completedWeeklyRows(entry)
    if (!rows.length) continue
    completedSets += rows.length
    exerciseOccurrences++
    exerciseIds.add(entry.id)
    for (const row of rows) {
      if (modeForSet(row, entry.target || entry) === 'reps' && validWeeklyNumber(row.r)) completedReps += row.r
    }
  }
  const known = validWeeklyNumber(workout?.durationMs)
    || (validWeeklyNumber(workout?.start) && validWeeklyNumber(workout?.end) && workout.end >= workout.start)
  return { completedSets, completedReps, exerciseOccurrences, exerciseIds, durationSeconds: known ? workoutDuration(workout) / 1000 : null }
}

export function buildMetricDelta(current, previous) {
  const comparable = validWeeklyNumber(current) && validWeeklyNumber(previous)
  const absolute = comparable ? current - previous : null
  return { current, previous, absolute, percentage: !comparable ? null : previous > 0 ? Math.round(absolute / previous * 10000) / 100 : current === 0 ? 0 : null,
    direction: !comparable ? 'unavailable' : absolute > 0 ? 'up' : absolute < 0 ? 'down' : 'same', comparable }
}

function aggregate(records, start, end, timeZone, cache) {
  const selected = [], dates = new Set(), exercises = new Set()
  const metrics = { workouts: 0, activeDays: 0, durationSeconds: null, durationKnownWorkouts: 0, completedSets: 0, completedReps: 0, exerciseOccurrences: 0, uniqueExercises: 0 }
  const byDay = new Map()
  for (const workout of records) {
    const date = cache.get(workout).date
    if (date < start || date >= end) continue
    const detail = cache.get(workout).detail
    selected.push(workout); dates.add(date)
    for (const id of detail.exerciseIds) exercises.add(id)
    metrics.workouts++
    for (const key of ['completedSets', 'completedReps', 'exerciseOccurrences']) metrics[key] += detail[key]
    if (detail.durationSeconds !== null) { metrics.durationKnownWorkouts++; metrics.durationSeconds = (metrics.durationSeconds || 0) + detail.durationSeconds }
    const day = byDay.get(date) || { workouts: 0, completedSets: 0, durationSeconds: null, durationKnownWorkouts: 0, workoutIds: [] }
    day.workouts++; day.completedSets += detail.completedSets; day.workoutIds.push(workout.id)
    if (detail.durationSeconds !== null) { day.durationSeconds = (day.durationSeconds || 0) + detail.durationSeconds; day.durationKnownWorkouts++ }
    byDay.set(date, day)
  }
  metrics.activeDays = dates.size; metrics.uniqueExercises = exercises.size
  return { metrics, selected, byDay }
}

export function buildWeeklyBase({ workouts = [], weekStart = undefined, now = new Date(), timeZone = undefined } = {}) {
  const zone = resolveWeeklyTimeZone(timeZone), start = normalizeWeekParam(weekStart, now, zone)
  const today = calendarDate(now, zone), end = addCalendarDays(start, 7)
  const isCurrentWeek = start === getWeekStart(now, zone)
  const comparisonPeriod = getComparableWeekRange(start, now, zone)
  const records = completedWeeklyHistory(workouts, now, zone)
  const cache = new Map(records.map(workout => {
    const date = workoutCalendarDate(workout, zone)
    const included = (date >= start && date < end) || (date >= comparisonPeriod.start && date < comparisonPeriod.end)
    return [workout, { date, detail: included ? weeklyWorkoutMetrics(workout) : null }]
  }))
  const current = aggregate(records, start, end, zone, cache)
  const previous = aggregate(records, comparisonPeriod.start, comparisonPeriod.end, zone, cache)
  const deltas = Object.fromEntries(Object.keys(current.metrics).map(key => [key, buildMetricDelta(current.metrics[key], previous.metrics[key])]))
  if (current.metrics.durationKnownWorkouts !== current.metrics.workouts || previous.metrics.durationKnownWorkouts !== previous.metrics.workouts) deltas.durationSeconds = buildMetricDelta(null, null)
  const days = getWeekDays(start, zone).map(date => ({ date, isFuture: isCurrentWeek && date > today, isToday: date === today,
    ...(current.byDay.get(date) || { workouts: 0, completedSets: 0, durationSeconds: null, durationKnownWorkouts: 0, workoutIds: [] }) }))
  return { schemaVersion: 1, period: { start, end, isCurrentWeek, isComplete: !isCurrentWeek, elapsedDays: comparisonPeriod.comparableDays, timeZone: zone },
    comparisonPeriod, metrics: current.metrics, previousMetrics: previous.metrics, deltas, days,
    workouts: current.selected, records, cache }
}

export function buildWeeklyPreview(options = {}) {
  const { records: _records, cache: _cache, workouts: _workouts, ...preview } = buildWeeklyBase(options)
  return preview
}
