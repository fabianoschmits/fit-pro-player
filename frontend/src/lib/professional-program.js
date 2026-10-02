export const DAYS = Object.freeze(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])

const LIMITS = Object.freeze({ sets: 50, reps: 500, load: 10000, weight: 10000, rest: 3600, notes: 500, sec: 86400, min: 1440, speed: 100, rir: 10, rpe: 10 })
const numeric = (value, fallback, max) => Math.min(max, Math.max(0, Number.isFinite(Number(value)) ? Number(value) : fallback))

function normalizeExercise(value) {
  const exerciseId = String(value?.exerciseId || value?.id || '').trim()
  if (!exerciseId) return null
  return {
    exerciseId,
    sets: Math.max(1, Math.round(numeric(value.sets, 1, LIMITS.sets))),
    reps: Math.max(1, Math.round(numeric(value.reps, 1, LIMITS.reps))),
    load: Math.round(numeric(value.load ?? value.weight, 0, LIMITS.load) * 100) / 100,
    ...(value.mode ? { mode: String(value.mode).slice(0, 40) } : {}),
    ...(value.rest != null ? { rest: Math.round(numeric(value.rest, 0, LIMITS.rest)) } : {}),
    ...(value.notes ? { notes: String(value.notes).slice(0, LIMITS.notes) } : {}),
    ...Object.fromEntries(['sec', 'min', 'speed', 'rir', 'rpe'].filter(key => value[key] != null).map(key => [key, numeric(value[key], 0, LIMITS[key])])),
    ...(value.unit ? { unit: value.unit === 'lb' ? 'lb' : 'kg' } : {}),
    ...(value.effort ? { effort: String(value.effort).slice(0, 10) } : {}),
    ...(value.sg ? { sg: String(value.sg).slice(0, 80) } : {}),
  }
}

export function normalizeWeeklyPlan(plan = {}) {
  const source = plan && typeof plan === 'object' && !Array.isArray(plan) ? plan : {}
  return Object.fromEntries(Object.entries(source).flatMap(([day, entries]) => {
    const key = String(day).toLowerCase()
    if (!DAYS.includes(key)) return []
    const list = Array.isArray(entries) ? entries : entries?.exercises
    const exercises = Array.isArray(list) ? list.map(normalizeExercise).filter(Boolean) : []
    return exercises.length ? [[key, exercises]] : []
  }))
}

export function validateWeeklyPlan(plan = {}) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return { ok: false, error: 'weekly-plan-invalid' }
  for (const [day, entries] of Object.entries(plan)) {
    if (!DAYS.includes(String(day).toLowerCase()) || !Array.isArray(entries) || entries.length > 50) return { ok: false, error: 'weekly-plan-day-invalid' }
    for (const entry of entries) {
      if (!String(entry?.exerciseId || entry?.id || '').trim()) return { ok: false, error: 'weekly-plan-exercise-invalid' }
      for (const key of ['sets', 'reps', 'load', 'weight', 'rest', 'sec', 'min', 'speed', 'rir', 'rpe']) {
        if (entry[key] == null && !['sets', 'reps'].includes(key)) continue
        const value = Number(entry[key])
        const minimum = ['sets', 'reps'].includes(key) ? 1 : 0
        if (entry[key] === '' || !Number.isFinite(value) || value < minimum || value > LIMITS[key] || (['sets', 'reps'].includes(key) && !Number.isInteger(value))) return { ok: false, error: 'weekly-plan-number-invalid' }
      }
      if (entry.mode && !['reps', 'time', 'cardio'].includes(entry.mode)) return { ok: false, error: 'weekly-plan-mode-invalid' }
      if (entry.unit && !['kg', 'lb'].includes(entry.unit)) return { ok: false, error: 'weekly-plan-unit-invalid' }
    }
  }
  const value = normalizeWeeklyPlan(plan)
  return Object.keys(value).length ? { ok: true, value } : { ok: false, error: 'weekly-plan-empty' }
}

export function summarizeWeeklyPlan(plan = {}) {
  const value = normalizeWeeklyPlan(plan)
  return { days: Object.keys(value).length, exercises: Object.values(value).reduce((sum, entries) => sum + entries.length, 0) }
}

export function nextScheduledWorkouts(plan = {}, fromDate = new Date(), count = 3) {
  const value = normalizeWeeklyPlan(plan)
  const start = new Date(fromDate)
  const output = []
  for (let offset = 0; offset < 7 && output.length < count; offset += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset, 12)
    const day = DAYS[date.getDay()]
    const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    if (value[day]) output.push({ day, date: localDate, exercises: value[day] })
  }
  return output
}
