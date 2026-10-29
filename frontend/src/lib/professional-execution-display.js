import { EXIDX, exerciseName } from './exercises.js'

const timestamp = value => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}
const durationBetween = (start, end) => {
  const from = timestamp(start), to = timestamp(end)
  return from != null && to != null && to > from ? to - from : null
}

export function professionalExecutionDurationMs(execution) {
  const payload = execution?.payload || {}
  return durationBetween(payload.start, payload.end)
    ?? durationBetween(execution?.startedAt, execution?.completedAt)
}

export function professionalExecutionExercises(execution) {
  const entries = execution?.payload?.entries
  if (!Array.isArray(entries)) return []
  return [...new Set(entries.map(entry => {
    const id = String(entry?.id || '').trim()
    return id ? exerciseName(EXIDX[id] || { id, n: id }) : ''
  }).filter(Boolean))]
}
