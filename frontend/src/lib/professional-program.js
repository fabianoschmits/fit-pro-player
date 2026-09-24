export const DAYS = Object.freeze(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])

const LIMITS = Object.freeze({ sets: 50, reps: 500, load: 10000, rest: 3600, notes: 500 })
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
      if (Number(entry.sets) < 1 || Number(entry.sets) > LIMITS.sets || Number(entry.reps) < 1 || Number(entry.reps) > LIMITS.reps) return { ok: false, error: 'weekly-plan-number-invalid' }
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
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + offset))
    const day = DAYS[date.getUTCDay()]
    if (value[day]) output.push({ day, date: date.toISOString().slice(0, 10), exercises: value[day] })
  }
  return output
}
