import { bestWeightForEntry, metricRowsForEntry, isBw } from './history.js'
import { EXIDX } from './exercises.js'
import { modeForEntry } from './workout-model.js'
import { completedWeeklyHistory, validWeeklyNumber, weeklyEntries, workoutCalendarDate, workoutCompletionInstant } from './weekly-progress-core.js'
import { getComparableWeekRange, getNextWeek, normalizeWeekParam } from './weekly-progress-calendar.js'

export function buildWeeklyPerformance({ workouts = [], weekStart = undefined, now = new Date(), timeZone = undefined, exerciseCatalog = undefined, historyComplete = true } = {}) {
  const start = normalizeWeekParam(weekStart, now, timeZone), end = getNextWeek(start, timeZone)
  const previousRange = getComparableWeekRange(start, now, timeZone)
  const catalog = exerciseCatalog instanceof Map ? exerciseCatalog : new Map(Object.entries(exerciseCatalog || EXIDX))
  const selected = new Map(), previous = new Map(), history = new Map(), records = new Map()
  const sorted = completedWeeklyHistory(workouts, now, timeZone).map(workout => ({ workout, date: workoutCalendarDate(workout, timeZone) }))
    .filter(item => item.date < end).sort((a, b) => a.date.localeCompare(b.date) || workoutCompletionInstant(a.workout) - workoutCompletionInstant(b.workout) || a.workout.id.localeCompare(b.workout.id))
  for (const { workout, date } of sorted) {
    const currentWeek = date >= start
    for (const entry of weeklyEntries(workout)) {
      const target = { id: entry.id, ...(entry.target || {}) }
      const exercise = catalog.get(entry.id) || entry.exercise || {}
      if (modeForEntry(entry) !== 'reps' || isBw(target) || target.assisted === true || /assist/i.test(String(exercise.eq || exercise.e || ''))) continue
      const rows = metricRowsForEntry(entry, 'reps').filter(row => validWeeklyNumber(row.w) && validWeeklyNumber(row.r) && row.r > 0).map(row => ({ ...row, workoutId: workout.id }))
      if (!rows.length) continue
      const load = bestWeightForEntry({ id: entry.id, target, sets: rows })
      const key = `${entry.id}:reps:${target.side === true ? 'side' : 'both'}`
      const candidate = { exerciseId: entry.id, workoutId: workout.id, load, rows, date, instant: workoutCompletionInstant(workout) }
      const prior = history.get(key) || []
      if (currentWeek) {
        const earlier = prior.filter(item => item.date < date || (candidate.instant > 0 && item.instant > 0 && item.instant < candidate.instant))
        const previousBest = Math.max(0, ...earlier.map(item => item.load))
        if (historyComplete && earlier.length && previousBest > 0 && load > previousBest) {
          const old = records.get(key)
          if (!old || load > old.current) records.set(key, { exerciseId: entry.id, workoutId: workout.id, type: 'record', previous: previousBest, current: load, unit: 'kg' })
        }
        const current = selected.get(key)
        if (!current || load > current.load) selected.set(key, { ...candidate, rows: [...(current?.rows || []), ...rows], earlierCount: earlier.length })
        else current.rows = [...current.rows, ...rows]
      }
      if (date >= previousRange.start && date < previousRange.end) {
        const old = previous.get(key)
        previous.set(key, { load: Math.max(old?.load || 0, load), rows: [...(old?.rows || []), ...rows] })
      }
      prior.push(candidate); history.set(key, prior)
    }
  }
  const improvements = []
  for (const [key, current] of selected) {
    const prior = previous.get(key)
    const base = { exerciseId: current.exerciseId, workoutId: current.workoutId, unit: 'kg' }
    if (!historyComplete) { improvements.push({ ...base, type: 'available', previous: null, current: current.load }); continue }
    if (!current.earlierCount) { improvements.push({ ...base, type: 'first', previous: null, current: current.load }); continue }
    if (!prior) continue
    if (current.load > prior.load && prior.load > 0) { improvements.push({ ...base, type: 'load', previous: prior.load, current: current.load }); continue }
    let best = null
    for (const row of current.rows) {
      const equivalent = prior.rows.filter(old => Math.abs(old.w - row.w) <= 0.000001)
      if (!equivalent.length) continue
      const before = Math.max(...equivalent.map(old => old.r))
      if (row.r > before && (!best || row.r - before > best.current - best.previous)) best = { ...base, workoutId: row.workoutId, type: 'reps', unit: 'reps', load: row.w, previous: before, current: row.r }
    }
    if (best) improvements.push(best)
  }
  const priority = { load: 0, reps: 1, first: 2, available: 3 }
  improvements.sort((a, b) => priority[a.type] - priority[b.type] || a.exerciseId.localeCompare(b.exerciseId))
  return { improvements, personalRecords: [...records.values()].sort((a, b) => a.exerciseId.localeCompare(b.exerciseId)) }
}
